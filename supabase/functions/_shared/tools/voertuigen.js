// @ts-check
// Tool-pack van de Voertuigen-module (assistent-skill-file, guidelines §1; AI-19 fase A).
// Vooralsnog alleen lezen: overzicht met km-stand, APK-datum en vaste lasten per maand.
// De write (onderhoud loggen) volgt in fase B; financiële boekingen (uitgave/rit-kosten)
// blijven bewust búíten de assistent (plan 27). Contract: zie taken.js.
// Bewust géén import van lib/vehicleCosts.js (date-fns hoort niet in de edge-bundel);
// monthlyCents hieronder spiegelt monthlyEquivalentCents voor de drie recur-freqs.

import { addDays, dayLabel, fmtEuro, throwOnError } from './helpers.js';

/**
 * Maandelijks equivalent (centen) van een terugkerend bedrag — spiegel van
 * lib/vehicleCosts.js monthlyEquivalentCents (daily/weekly/monthly, CHECK 0017).
 * Onbekende frequentie of kapot bedrag → 0 (nooit een verzonnen kostenpost).
 * @param {number|null|undefined} amountCents
 * @param {string|null|undefined} freq
 * @param {number|null|undefined} [interval]
 * @returns {number}
 */
export function monthlyCents(amountCents, freq, interval = 1) {
  if (!Number.isFinite(amountCents) || /** @type {number} */ (amountCents) <= 0) return 0;
  const per = Number.isInteger(interval) && /** @type {number} */ (interval) > 0 ? /** @type {number} */ (interval) : 1;
  const amount = /** @type {number} */ (amountCents) / per;
  if (freq === 'monthly') return Math.round(amount);
  if (freq === 'weekly') return Math.round((amount * 52) / 12);
  if (freq === 'daily') return Math.round((amount * 365) / 12);
  return 0;
}

/**
 * Voertuigen + vaste lasten + laatste onderhoud → data + kaart per voertuig.
 * APK op of vóór `soonHorizon` (YYYY-MM-DD) wordt expliciet benoemd.
 * @param {Array<{id:string, name:string, license_plate?:string|null, mileage?:number|null, apk_expires_on?:string|null}>} [vehicles]
 * @param {Array<{vehicle_id?:string|null, amount_cents?:number|null, recur_freq?:string|null, recur_interval?:number|null}>} [recurring]
 * @param {Array<{vehicle_id?:string|null, title?:string|null, performed_on?:string|null}>} [logs] nieuwste eerst
 * @param {string} [soonHorizon] APK-attentiegrens (bv. vandaag + 60 dagen)
 */
export function renderVehiclesOverview(vehicles = [], recurring = [], logs = [], soonHorizon = '') {
  const fixedByVehicle = /** @type {Record<string, number>} */ ({});
  for (const r of recurring) {
    if (!r?.vehicle_id) continue;
    fixedByVehicle[r.vehicle_id] = (fixedByVehicle[r.vehicle_id] ?? 0) + monthlyCents(r.amount_cents, r.recur_freq, r.recur_interval);
  }
  const lastLogByVehicle = /** @type {Record<string, {title:string, performed_on:string}>} */ ({});
  for (const l of logs) {
    if (l?.vehicle_id && typeof l.title === 'string' && typeof l.performed_on === 'string' && !(l.vehicle_id in lastLogByVehicle)) {
      lastLogByVehicle[l.vehicle_id] = { title: l.title, performed_on: l.performed_on };
    }
  }
  const entries = vehicles.map((v) => ({
    name: v.name,
    license_plate: v.license_plate ?? null,
    mileage: Number.isFinite(v.mileage) ? v.mileage : null,
    apk_expires_on: v.apk_expires_on ?? null,
    fixed_monthly_cents: fixedByVehicle[v.id] ?? 0,
    last_maintenance: lastLogByVehicle[v.id] ?? null,
  }));
  const data = { count: vehicles.length, vehicles: entries };
  if (entries.length === 0) {
    return { data, render: [{ type: 'card', title: 'Voertuigen', lines: ['Er staan nog geen voertuigen in de app.'] }] };
  }
  const render = entries.map((e) => {
    const pairs = [];
    if (e.license_plate) pairs.push({ k: 'Kenteken', v: e.license_plate });
    if (e.mileage != null) pairs.push({ k: 'Km-stand', v: `${e.mileage}` });
    if (e.apk_expires_on) {
      const soon = soonHorizon && e.apk_expires_on <= soonHorizon;
      pairs.push({ k: 'APK', v: `${dayLabel(e.apk_expires_on)}${soon ? ' — binnenkort!' : ''}` });
    }
    if (e.fixed_monthly_cents > 0) pairs.push({ k: 'Vaste lasten', v: `${fmtEuro(e.fixed_monthly_cents)}/mnd` });
    if (e.last_maintenance) pairs.push({ k: 'Laatste onderhoud', v: `${e.last_maintenance.title} (${dayLabel(e.last_maintenance.performed_on)})` });
    return pairs.length > 0
      ? { type: 'keyvalue', title: e.name, pairs }
      : { type: 'card', title: e.name, lines: ['Nog geen gegevens vastgelegd.'] };
  });
  return { data, render };
}

export const MAX_PROPOSED_MAINTENANCE = 5;

/**
 * Puur voorstel-bouwwerk van voertuigen_onderhoud_loggen (fase B, HITL).
 * Bewust GEEN kosten/expense-koppeling: geld boeken blijft buiten de assistent
 * (plan 27). performed_on default = vandaag (env.today).
 * @param {{ items?: Array<{vehicle_name?:string, title?:string, performed_on?:string, mileage?:number}> }} [args]
 * @param {{ today?: string }} [env]
 * @returns {{ ok:true, summary:string, items:string[], args:{items:object[]} } | { ok:false, error:string }}
 */
export function proposeLogMaintenance(args = {}, env = {}) {
  const raw = Array.isArray(args.items) ? args.items : [];
  if (raw.length === 0) return { ok: false, error: 'Geen onderhoud om te loggen.' };
  if (raw.length > MAX_PROPOSED_MAINTENANCE) return { ok: false, error: `Maximaal ${MAX_PROPOSED_MAINTENANCE} regels per voorstel.` };
  const items = [];
  const norm = [];
  for (const it of raw) {
    const vehicleName = typeof it?.vehicle_name === 'string' ? it.vehicle_name.trim() : '';
    if (!vehicleName) return { ok: false, error: 'Zeg erbij om wélk voertuig het gaat.' };
    const title = typeof it?.title === 'string' ? it.title.trim() : '';
    if (!title) return { ok: false, error: 'Wat voor onderhoud was het? Geef een korte titel.' };
    if (title.length > 120) return { ok: false, error: 'Een onderhouds-titel mag maximaal 120 tekens zijn.' };
    const performedOn = typeof it?.performed_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.performed_on)
      ? it.performed_on
      : (env.today ?? null);
    if (!performedOn) return { ok: false, error: 'Ongeldige datum (gebruik YYYY-MM-DD).' };
    const mileage = Number.isInteger(it?.mileage) && /** @type {number} */ (it.mileage) >= 0 ? /** @type {number} */ (it.mileage) : null;
    norm.push({ vehicle_name: vehicleName, title, performed_on: performedOn, mileage });
    items.push([vehicleName, title, dayLabel(performedOn), mileage != null ? `${mileage} km` : null].filter(Boolean).join(' · '));
  }
  const summary = norm.length === 1
    ? `Onderhoud "${norm[0].title}" loggen (${norm[0].vehicle_name})`
    : `${norm.length} onderhouds-regels loggen`;
  return { ok: true, summary, items, args: { items: norm } };
}

// Module-brief (guidelines §1).
export const VOERTUIGEN_BRIEF = {
  moduleKey: 'voertuigen',
  label: 'Voertuigen',
  brief: 'de voertuigen van het huishouden; kan km-stand, APK en kosten tonen en onderhoud loggen',
};

export const VOERTUIGEN_TOOLS = [
  {
    name: 'voertuigen_overzicht',
    moduleKey: 'voertuigen',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Voertuiggegevens erbij pakken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt naar een auto of ander voertuig: km-stand, wanneer de APK verloopt, wat een voertuig per maand kost of wat het laatste onderhoud was. Toont per voertuig een compact overzicht.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    async run(ctx) {
      const [vehicles, recurring, logs] = await Promise.all([
        ctx.db.from('vehicles').select('id, name, license_plate, mileage, apk_expires_on').eq('household_id', ctx.householdId).order('name').limit(20),
        ctx.db.from('recurring_expenses').select('vehicle_id, amount_cents, recur_freq, recur_interval')
          .eq('household_id', ctx.householdId).eq('active', true).not('vehicle_id', 'is', null).limit(100),
        ctx.db.from('vehicle_log').select('vehicle_id, title, performed_on').order('performed_on', { ascending: false }).limit(60),
      ]);
      // APK-attentiegrens: binnen ~2 maanden.
      return renderVehiclesOverview(throwOnError(vehicles), throwOnError(recurring), throwOnError(logs), addDays(ctx.today, 60));
    },
  },
  {
    name: 'voertuigen_onderhoud_loggen',
    moduleKey: 'voertuigen',
    kind: 'write',
    risk: 'write',
    destructive: false, // additief: alleen nieuwe historie-regels
    idempotent: false,  // nogmaals uitvoeren = dubbele regels
    statusLabel: 'Onderhoud klaarzetten…',
    description: 'Roep dit aan wanneer de gebruiker uitgevoerd onderhoud aan een voertuig wil vastleggen (bv. "de Volvo heeft nieuwe banden gekregen op 123456 km"). Alleen de historie-regel — kosten boeken hoort hier niet bij. De gebruiker beslist op de bevestigingskaart.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De te loggen onderhouds-regels (meestal één, maximaal 5).',
          items: {
            type: 'object',
            properties: {
              vehicle_name: { type: 'string', description: 'De naam van het voertuig, zoals het in de app heet' },
              title: { type: 'string', description: 'Wat er is gedaan, bv. "Grote beurt" of "Nieuwe banden"' },
              performed_on: { type: 'string', description: 'Optioneel: de datum als YYYY-MM-DD (default vandaag)' },
              mileage: { type: 'integer', description: 'Optioneel: de km-stand op dat moment' },
            },
            required: ['vehicle_name', 'title'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    propose: proposeLogMaintenance,
    async execute(ctx, args) {
      const vehicles = throwOnError(
        await ctx.db.from('vehicles').select('id, name').eq('household_id', ctx.householdId).limit(20)
      );
      const inserted = [];
      for (const it of args.items) {
        const wanted = it.vehicle_name.trim().toLowerCase();
        const hits = vehicles.filter((v) => (v.name ?? '').trim().toLowerCase() === wanted);
        if (hits.length !== 1) throw new Error(`"${it.vehicle_name}" is niet (eenduidig) gevonden bij de voertuigen.`);
        const rows = throwOnError(
          await ctx.db.from('vehicle_log').insert({
            vehicle_id: hits[0].id,
            created_by: ctx.userId,
            title: it.title,
            performed_on: it.performed_on,
            ...(it.mileage != null ? { mileage: it.mileage } : {}),
          }).select('id')
        );
        inserted.push(...rows.map((r) => ({ table: 'vehicle_log', id: r.id })));
      }
      return {
        summary: inserted.length === 1 ? 'Onderhoud gelogd.' : `${inserted.length} onderhouds-regels gelogd.`,
        inserted,
      };
    },
  },
];

// Manifest: de enige declaratie per module (guidelines §1).
export const VOERTUIGEN_MANIFEST = {
  moduleKey: VOERTUIGEN_BRIEF.moduleKey,
  label: VOERTUIGEN_BRIEF.label,
  brief: VOERTUIGEN_BRIEF.brief,
  tools: VOERTUIGEN_TOOLS,
};

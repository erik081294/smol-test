// @ts-check
// Pure capability-policy van de assistent (fundament AI-actie-laag, blinde vlek B4).
// Bepaalt WELKE AI-acties een gebruiker mag laten uitvoeren — een aparte laag naast:
//   - RLS            → regelt rij-toegang (mag deze gebruiker déze rij zien/muteren);
//   - module-toggle  → regelt of een module überhaupt meedoet (lib/modules.js).
// Deze laag regelt iets wat geen van beide dekt: mag de assistent namens deze gebruiker
// een actie van een bepaald risico uitvoeren (bv. "kinderen mogen niets laten boeken").
//
// DEFAULT-ON, net als de module-toggles: een capability geldt tenzij hij expliciet is
// ingetrokken — huishouden-breed door de owner, of door de gebruiker voor zichzelf. Een
// huishouden-intrekking wint vanzelf van een gebruiker die niets heeft gezet (spiegelt
// isModuleEnabled). Alleen intrekkingen worden opgeslagen (user_ai_capabilities).
//
// De policy leunt op de risk-tier die elke tool declareert (manifest, guidelines §1):
//   read        → geen capability nodig (laag risico; RLS beschermt de data)
//   write       → ai:write                  (assistent mag namens de gebruiker wijzigen)
//   financial   → ai:write + ai:spend        (geld boeken/verrekenen)
//   destructive → ai:write + ai:destructive  (onomkeerbaar verwijderen)

// De instelbare capabilities (reads staan hier bewust niet: die zijn altijd toegestaan
// binnen een ingeschakelde module). Volgorde = weergavevolgorde in de beheer-UI.
export const AI_CAPABILITIES = ['ai:write', 'ai:spend', 'ai:destructive'];

/**
 * De capabilities die een tool vereist, afgeleid van kind + risk. Reads vereisen niets.
 * Een write met onbekende/afwezige risk valt veilig terug op alléén ai:write (nooit
 * minder streng dan het basis-schrijfrecht).
 * @param {{ kind?: string, risk?: string }} [tool]
 * @returns {string[]}
 */
export function requiredCapabilities(tool) {
  if (!tool || tool.kind !== 'write') return [];
  const caps = ['ai:write'];
  if (tool.risk === 'financial') caps.push('ai:spend');
  else if (tool.risk === 'destructive') caps.push('ai:destructive');
  return caps;
}

/**
 * De verleende capabilities gegeven de intrekkingen (default-on). Een capability is
 * verleend tenzij hij op huishouden- óf gebruiker-niveau is ingetrokken.
 * @param {{ householdRevoked?: string[], userRevoked?: string[] }} [revocations]
 * @returns {Set<string>}
 */
export function grantedCapabilities({ householdRevoked = [], userRevoked = [] } = {}) {
  const revoked = new Set([...householdRevoked, ...userRevoked]);
  return new Set(AI_CAPABILITIES.filter((c) => !revoked.has(c)));
}

/**
 * Mag de gebruiker deze tool laten uitvoeren, gegeven zijn verleende capabilities?
 * Elke vereiste capability moet verleend zijn; reads (lege eis) mogen altijd. Dit is
 * het enige beslispunt — filterTools (het model ziet de tool niet) én de her-check
 * vóór execute (een stale voorstel glipt niet door) leunen hier allebei op.
 * @param {{ kind?: string, risk?: string }} tool
 * @param {Set<string>|string[]} [granted]
 * @returns {boolean}
 */
export function canUseTool(tool, granted) {
  const set = granted instanceof Set ? granted : new Set(granted ?? []);
  return requiredCapabilities(tool).every((c) => set.has(c));
}

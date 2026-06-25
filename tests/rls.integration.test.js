// RLS-integratietest tegen een ECHTE Supabase-database. Bewijst dat het
// zichtbaarheidscontract niet alleen in JS klopt (zie visibility.test.js) maar
// ook echt door Postgres' Row Level Security wordt afgedwongen.
//
// Draaien (env-gated; slaat netjes over zonder deze variabelen):
//   SUPABASE_URL=... \
//   SUPABASE_ANON_KEY=... \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   npm test
//
// De service-role-key staat BEWUST niet in de repo. Hij is alleen nodig om
// testgebruikers aan te maken/op te ruimen; de feitelijke RLS-checks draaien via
// de anon-client als die gebruikers. Gebruik een test-/staging-project.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENABLED = Boolean(URL && ANON && SERVICE);

const opts = { skip: ENABLED ? false : 'zet SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY om RLS te testen' };

// Admin-client (service role: omzeilt RLS) — alleen voor setup/teardown.
const admin = ENABLED ? createClient(URL, SERVICE, { auth: { persistSession: false } }) : null;

const created = []; // user-ids om op te ruimen
const tag = `rlstest+${Date.now()}`;

// INF-12 — auth-rate-limit dempen. De gehoste Supabase-auth limiteert het
// sign-in-/token-endpoint; een volledige run doet ~50 logins en zonder demping
// vallen de laatste om op "Request rate limit reached". We (a) serialiseren alle
// auth-calls met een minimale tussentijd zodat de burst de limiet niet raakt en
// (b) herproberen rate-limit-fouten met exponentiële backoff zodat een al getript
// venster netjes uitloopt i.p.v. de test te laten falen. Geen gedragsverandering
// voor de RLS-checks zelf — alleen tempo.
const AUTH_MIN_GAP_MS = 350;   // minimale tijd tussen twee auth-requests
const AUTH_MAX_RETRIES = 8;    // pogingen vóór we de fout doorgeven aan de assert
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRateLimit(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  return err.status === 429 || err.code === 'over_request_rate_limit' || msg.includes('rate limit');
}

let authChain = Promise.resolve(); // serialiseert auth-calls; pauzeert ook de wachtenden tijdens backoff
let lastAuthAt = 0;

// Voert één auth-call (`fn` → `{ data?, error? }`) uit met tussentijd + backoff.
// Serialiseren via een keten houdt ook bij ingeschakelde test-concurrency de
// auth-requests op één rij — en laat een backoff de hele wachtrij meedraaien,
// wat de burst drainset.
function throttledAuth(fn) {
  const run = async () => {
    let res;
    for (let attempt = 0; attempt <= AUTH_MAX_RETRIES; attempt++) {
      const gap = AUTH_MIN_GAP_MS - (Date.now() - lastAuthAt);
      if (gap > 0) await sleep(gap);
      res = await fn();
      lastAuthAt = Date.now();
      if (!isRateLimit(res?.error)) return res;
      // Backoff: 1s, 2s, 4s, … gecapt op 30s, met jitter tegen synchroon herproberen.
      await sleep(Math.min(30000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 400));
    }
    return res; // laatste (nog steeds rate-limited) resultaat → caller-assert faalt netjes
  };
  const result = authChain.then(run, run);
  authChain = result.then(() => {}, () => {});
  return result;
}

// Maakt een bevestigde gebruiker + ingelogde anon-client voor die persoon.
async function makeUser(name) {
  const email = `${tag}.${name}@example.com`;
  const password = 'Test1234!passphrase';
  const { data, error } = await throttledAuth(() => admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: name },
  }));
  assert.ok(!error, `gebruiker aanmaken (${name}): ${error?.message}`);
  created.push(data.user.id);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signErr } = await throttledAuth(() => client.auth.signInWithPassword({ email, password }));
  assert.ok(!signErr, `inloggen (${name}): ${signErr?.message}`);
  return { id: data.user.id, client };
}

after(async () => {
  if (!ENABLED) return;
  for (const id of created) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

test('RLS: huisgenoot ziet household-taak, buitenstaander niet', opts, async () => {
  const alice = await makeUser('alice');
  const bob = await makeUser('bob');       // huisgenoot
  const eve = await makeUser('eve');        // buitenstaander

  // Alice maakt een huishouden (via create_household-RPC) en deelt de code met Bob.
  const hh = await makeHousehold(alice, 'Testhuis');

  const { data: code } = await alice.client
    .from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  // Alice maakt een household-taak.
  const { data: task, error: tErr } = await alice.client.from('tasks')
    .insert({ household_id: hh.id, title: 'Vuilnis', visibility: 'household', created_by: alice.id })
    .select().single();
  assert.ok(!tErr, `taak: ${tErr?.message}`);

  // Bob (huisgenoot) ziet hem; Eve (buitenstaander) niet.
  const bobSees = await bob.client.from('tasks').select('id').eq('id', task.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot moet de household-taak zien');

  const eveSees = await eve.client.from('tasks').select('id').eq('id', task.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander mag de taak NIET zien');
});

test('RLS: custom-taak alleen zichtbaar voor genoemde personen', opts, async () => {
  const alice = await makeUser('alice2');
  const bob = await makeUser('bob2');
  const carol = await makeUser('carol2');

  const hh = await makeHousehold(alice, 'Testhuis2');
  const { data: code } = await alice.client
    .from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });
  await carol.client.rpc('join_household', { code: code.invite_code });

  // Alice deelt alleen met Bob (custom).
  const { data: task, error } = await alice.client.from('tasks')
    .insert({ household_id: hh.id, title: 'Geheim', visibility: 'custom', share_with: [bob.id], created_by: alice.id })
    .select().single();
  assert.ok(!error, `custom-taak: ${error?.message}`);

  const bobSees = await bob.client.from('tasks').select('id').eq('id', task.id);
  assert.equal(bobSees.data?.length, 1, 'genoemde persoon ziet de custom-taak');

  const carolSees = await carol.client.from('tasks').select('id').eq('id', task.id);
  assert.equal(carolSees.data?.length ?? 0, 0, 'niet-genoemde huisgenoot ziet de custom-taak NIET');
});

test('RLS: integriteit — delen met subgroep uit ander huishouden wordt geweigerd', opts, async () => {
  const alice = await makeUser('alice3');

  // Twee huishoudens van Alice.
  const hhA = await makeHousehold(alice, 'Huis A');
  const hhB = await makeHousehold(alice, 'Huis B');

  // Subgroep in huis B.
  const { data: sg } = await alice.client.from('subgroups')
    .insert({ household_id: hhB.id, name: 'B-groep', created_by: alice.id }).select().single();

  // Taak in huis A die naar de B-subgroep wijst -> moet door de trigger geweigerd.
  const { error } = await alice.client.from('tasks').insert({
    household_id: hhA.id, title: 'Lek', visibility: 'subgroup', share_subgroup_id: sg.id, created_by: alice.id,
  });
  assert.ok(error, 'cross-huishouden subgroep-deling had geweigerd moeten worden');
});

// --- SEC-1/SEC-4: tenant-isolatie van huishouden-aanmaak en -beheer ------------

test('RLS: SEC-1 — niemand kan zich als owner aan een vreemd huishouden toevoegen', opts, async () => {
  const alice = await makeUser('alice_sec1');
  const eve = await makeUser('eve_sec1');   // buitenstaander

  const hh = await makeHousehold(alice, 'Forthuis');

  // Directe member-insert is server-side ingetrokken (revoke insert), dus de
  // owner-escalatie uit de audit moet falen — ongeacht de geclaimde rol.
  const { error } = await eve.client.from('household_members')
    .insert({ household_id: hh.id, profile_id: eve.id, role: 'owner' });
  assert.ok(error, 'directe owner-insert in een vreemd huishouden moet geweigerd worden');

  // En Eve krijgt geen lidmaatschap/zicht op het huishouden.
  const eveMembers = await eve.client.from('household_members').select('profile_id').eq('household_id', hh.id);
  assert.equal(eveMembers.data?.length ?? 0, 0, 'Eve mag geen lidmaatschap op het huishouden krijgen');
});

test('RLS: SEC-1 — create_household maakt huishouden + owner-membership atomair', opts, async () => {
  const alice = await makeUser('alice_sec1b');
  const hh = await makeHousehold(alice, 'RPC-huis');
  assert.ok(hh?.id, 'create_household geeft de huishoudrij terug');
  assert.ok(hh?.invite_code, 'huishouden krijgt een invite_code');

  const { data: mine } = await alice.client.from('household_members')
    .select('role').eq('household_id', hh.id).eq('profile_id', alice.id).single();
  assert.equal(mine?.role, 'owner', 'de maker is owner');
});

test('RLS: SEC-4 — alleen de owner mag het huishouden bewerken (invite_code/naam)', opts, async () => {
  const alice = await makeUser('alice_sec4'); // owner
  const bob = await makeUser('bob_sec4');     // gewoon lid

  const hh = await makeHousehold(alice, 'Beheerhuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  // Bob (lid, geen owner) probeert te wijzigen → RLS-using filtert de rij weg (0 rijen).
  const { data: bobUpd } = await bob.client.from('households')
    .update({ name: 'Gekaapt' }).eq('id', hh.id).select();
  assert.equal(bobUpd?.length ?? 0, 0, 'een gewoon lid mag het huishouden niet bewerken');

  // Alice (owner) kan het wel.
  const { data: aliceUpd, error: aErr } = await alice.client.from('households')
    .update({ name: 'Beheerhuis 2' }).eq('id', hh.id).select();
  assert.ok(!aErr, `owner-update: ${aErr?.message}`);
  assert.equal(aliceUpd?.length, 1, 'de owner mag het huishouden bewerken');
});

// --- Kosten-module: expenses (via de create_expense RPC) + expense_shares ----
// Verifieert dat (a) de atomaire RPC werkt, (b) de hoofdtabel het contract volgt
// en (c) de kindtabel expense_shares de zichtbaarheid van zijn parent erft.

async function makeHousehold(owner, name) {
  // Huishouden + owner-membership via de DEFINER-RPC (SEC-1): directe inserts op
  // household_members zijn server-side ingetrokken, dus we maken het zo aan.
  const { data: hh, error } = await owner.client.rpc('create_household', { p_name: name });
  assert.ok(!error, `huishouden (${name}): ${error?.message}`);
  return hh;
}

test('RLS: household-uitgave + shares zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_exp');
  const bob = await makeUser('bob_exp');     // huisgenoot
  const eve = await makeUser('eve_exp');      // buitenstaander

  const hh = await makeHousehold(alice, 'Kostenhuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  // Alice maakt een uitgave van €30, gelijk over Alice + Bob, via de RPC.
  const { data: expId, error: rpcErr } = await alice.client.rpc('create_expense', {
    p_household_id: hh.id, p_description: 'Boodschappen', p_amount_cents: 3000,
    p_paid_by: alice.id, p_spent_on: null, p_split_type: 'equal',
    p_visibility: 'household', p_share_subgroup_id: null, p_share_with: null,
    p_shares: [
      { profile_id: alice.id, amount_cents: 1500 },
      { profile_id: bob.id, amount_cents: 1500 },
    ],
  });
  assert.ok(!rpcErr, `create_expense: ${rpcErr?.message}`);
  assert.ok(expId, 'RPC moet het nieuwe expense-id teruggeven');

  // Bob ziet de uitgave én de shares; Eve niets.
  const bobExp = await bob.client.from('expenses').select('id').eq('id', expId);
  assert.equal(bobExp.data?.length, 1, 'huisgenoot moet de household-uitgave zien');
  const bobShares = await bob.client.from('expense_shares').select('profile_id').eq('expense_id', expId);
  assert.equal(bobShares.data?.length, 2, 'huisgenoot moet de shares zien (erft parent-zichtbaarheid)');

  const eveExp = await eve.client.from('expenses').select('id').eq('id', expId);
  assert.equal(eveExp.data?.length ?? 0, 0, 'buitenstaander mag de uitgave NIET zien');
  const eveShares = await eve.client.from('expense_shares').select('profile_id').eq('expense_id', expId);
  assert.equal(eveShares.data?.length ?? 0, 0, 'buitenstaander mag de shares NIET zien');
});

test('RLS: uitgave bijwerken (update_expense) vervangt bedrag + shares; buitenstaander kan niet', opts, async () => {
  const alice = await makeUser('alice_updexp');
  const bob = await makeUser('bob_updexp');     // huisgenoot
  const eve = await makeUser('eve_updexp');      // buitenstaander

  const hh = await makeHousehold(alice, 'Bijwerkhuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  const { data: expId } = await alice.client.rpc('create_expense', {
    p_household_id: hh.id, p_description: 'Etentje', p_amount_cents: 2000,
    p_paid_by: alice.id, p_spent_on: null, p_split_type: 'equal',
    p_visibility: 'household', p_share_subgroup_id: null, p_share_with: null,
    p_shares: [
      { profile_id: alice.id, amount_cents: 1000 },
      { profile_id: bob.id, amount_cents: 1000 },
    ],
  });

  // Alice corrigeert het bedrag naar €40 en herverdeelt.
  const { error: updErr } = await alice.client.rpc('update_expense', {
    p_id: expId, p_household_id: hh.id, p_description: 'Etentje (gecorrigeerd)', p_amount_cents: 4000,
    p_paid_by: alice.id, p_spent_on: null, p_split_type: 'equal',
    p_visibility: 'household', p_share_subgroup_id: null, p_share_with: null,
    p_shares: [
      { profile_id: alice.id, amount_cents: 2000 },
      { profile_id: bob.id, amount_cents: 2000 },
    ],
  });
  assert.ok(!updErr, `update_expense: ${updErr?.message}`);

  const updated = await bob.client.from('expenses').select('description, amount_cents').eq('id', expId).single();
  assert.equal(updated.data?.amount_cents, 4000, 'bedrag moet bijgewerkt zijn');
  assert.equal(updated.data?.description, 'Etentje (gecorrigeerd)', 'omschrijving moet bijgewerkt zijn');
  const shares = await bob.client.from('expense_shares').select('amount_cents').eq('expense_id', expId);
  assert.equal(shares.data?.length, 2, 'shares blijven 2 (volledig vervangen)');
  assert.ok((shares.data ?? []).every((s) => s.amount_cents === 2000), 'shares moeten de nieuwe bedragen zijn');

  // Een buitenstaander mag de uitgave niet bijwerken (is_member-guard).
  const { error: eveErr } = await eve.client.rpc('update_expense', {
    p_id: expId, p_household_id: hh.id, p_description: 'gehackt', p_amount_cents: 1,
    p_paid_by: eve.id, p_spent_on: null, p_split_type: 'equal',
    p_visibility: 'household', p_share_subgroup_id: null, p_share_with: null,
    p_shares: [{ profile_id: eve.id, amount_cents: 1 }],
  });
  assert.ok(eveErr, 'buitenstaander mag update_expense NIET kunnen aanroepen');
  const stillThere = await alice.client.from('expenses').select('amount_cents').eq('id', expId).single();
  assert.equal(stillThere.data?.amount_cents, 4000, 'uitgave moet onveranderd blijven na geweigerde poging');
});

test('RLS: subgroep-uitgave alleen voor subgroepleden (huisgenoot buiten de groep ziet niets)', opts, async () => {
  const alice = await makeUser('alice_sg_exp');
  const bob = await makeUser('bob_sg_exp');   // huisgenoot, NIET in de subgroep

  const hh = await makeHousehold(alice, 'Ouderhuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  // Subgroep met alleen Alice.
  const { data: sg } = await alice.client.from('subgroups')
    .insert({ household_id: hh.id, name: 'Alleen Alice', created_by: alice.id }).select().single();
  await alice.client.from('subgroup_members').insert({ subgroup_id: sg.id, profile_id: alice.id });

  const { data: expId, error } = await alice.client.rpc('create_expense', {
    p_household_id: hh.id, p_description: 'Privé', p_amount_cents: 1000,
    p_paid_by: alice.id, p_spent_on: null, p_split_type: 'equal',
    p_visibility: 'subgroup', p_share_subgroup_id: sg.id, p_share_with: null,
    p_shares: [{ profile_id: alice.id, amount_cents: 1000 }],
  });
  assert.ok(!error, `create_expense (subgroep): ${error?.message}`);

  // Alice (maker + subgroeplid) ziet 'm; Bob (huisgenoot, geen subgroeplid) niet.
  const aliceSees = await alice.client.from('expenses').select('id').eq('id', expId);
  assert.equal(aliceSees.data?.length, 1, 'subgroeplid ziet de uitgave');
  const bobSees = await bob.client.from('expenses').select('id').eq('id', expId);
  assert.equal(bobSees.data?.length ?? 0, 0, 'huisgenoot buiten de subgroep ziet de uitgave NIET');
  const bobShares = await bob.client.from('expense_shares').select('profile_id').eq('expense_id', expId);
  assert.equal(bobShares.data?.length ?? 0, 0, 'huisgenoot buiten de subgroep ziet de shares NIET');
});

// --- Planten-module: plants volgt het standaard zichtbaarheidscontract --------
// (Bewijst dat enable_module_rls('plants') hetzelfde gedrag geeft als tasks.)

test('RLS: household-plant zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_plant');
  const bob = await makeUser('bob_plant');     // huisgenoot
  const eve = await makeUser('eve_plant');      // buitenstaander

  const hh = await makeHousehold(alice, 'Plantenhuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  const { data: plant, error } = await alice.client.from('plants')
    .insert({ household_id: hh.id, name: 'Monstera', visibility: 'household', created_by: alice.id })
    .select().single();
  assert.ok(!error, `plant: ${error?.message}`);

  const bobSees = await bob.client.from('plants').select('id').eq('id', plant.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot moet de household-plant zien');
  const eveSees = await eve.client.from('plants').select('id').eq('id', plant.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander mag de plant NIET zien');
});

test('RLS: subgroep-plant alleen voor subgroepleden', opts, async () => {
  const alice = await makeUser('alice_plant_sg');
  const bob = await makeUser('bob_plant_sg');   // huisgenoot, niet in subgroep

  const hh = await makeHousehold(alice, 'Privéplant');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  const { data: sg } = await alice.client.from('subgroups')
    .insert({ household_id: hh.id, name: 'Alleen Alice', created_by: alice.id }).select().single();
  await alice.client.from('subgroup_members').insert({ subgroup_id: sg.id, profile_id: alice.id });

  const { data: plant, error } = await alice.client.from('plants')
    .insert({ household_id: hh.id, name: 'Geheime orchidee', visibility: 'subgroup', share_subgroup_id: sg.id, created_by: alice.id })
    .select().single();
  assert.ok(!error, `subgroep-plant: ${error?.message}`);

  const aliceSees = await alice.client.from('plants').select('id').eq('id', plant.id);
  assert.equal(aliceSees.data?.length, 1, 'subgroeplid ziet de plant');
  const bobSees = await bob.client.from('plants').select('id').eq('id', plant.id);
  assert.equal(bobSees.data?.length ?? 0, 0, 'huisgenoot buiten de subgroep ziet de plant NIET');
});

// --- Schoonmaak-module: zones zijn household-gescoped (is_member) -------------

test('RLS: zones zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_zone');
  const bob = await makeUser('bob_zone');     // huisgenoot
  const eve = await makeUser('eve_zone');      // buitenstaander

  const hh = await makeHousehold(alice, 'Zonehuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  const { data: zone, error } = await alice.client.from('zones')
    .insert({ household_id: hh.id, name: 'Badkamer', emoji: '🛁' }).select().single();
  assert.ok(!error, `zone: ${error?.message}`);

  const bobSees = await bob.client.from('zones').select('id').eq('id', zone.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot ziet de zone');
  const eveSees = await eve.client.from('zones').select('id').eq('id', zone.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander ziet de zone NIET');
});

// --- Plantendagboek: plant_photos erft de zichtbaarheid van de parent-plant ----

test('RLS: dagboekfoto zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_diary');
  const bob = await makeUser('bob_diary');     // huisgenoot
  const eve = await makeUser('eve_diary');      // buitenstaander

  const hh = await makeHousehold(alice, 'Dagboekhuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  const { data: plant } = await alice.client.from('plants')
    .insert({ household_id: hh.id, name: 'Ficus', visibility: 'household', created_by: alice.id }).select().single();
  const { data: photo, error } = await alice.client.from('plant_photos')
    .insert({ household_id: hh.id, plant_id: plant.id, photo_path: `${hh.id}/${plant.id}/1.jpg`, created_by: alice.id })
    .select().single();
  assert.ok(!error, `dagboekfoto: ${error?.message}`);

  const bobSees = await bob.client.from('plant_photos').select('id').eq('id', photo.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot ziet de dagboekfoto (erft plant-zichtbaarheid)');
  const eveSees = await eve.client.from('plant_photos').select('id').eq('id', photo.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander ziet de dagboekfoto NIET');
});

// --- Voltooiingen-log: task_completions erft de zichtbaarheid van de parent-taak ---
// (Bewijst SCH-3's fundament: wie de taak mag zien, mag ook de voltooiingen zien.)

test('RLS: voltooiing van household-taak zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_compl');
  const bob = await makeUser('bob_compl');     // huisgenoot
  const eve = await makeUser('eve_compl');      // buitenstaander

  const hh = await makeHousehold(alice, 'Voltooiinghuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  const { data: task } = await alice.client.from('tasks')
    .insert({ household_id: hh.id, title: 'Stofzuigen', visibility: 'household', created_by: alice.id })
    .select().single();
  const { data: compl, error } = await alice.client.from('task_completions')
    .insert({ household_id: hh.id, task_id: task.id, completed_by: alice.id })
    .select().single();
  assert.ok(!error, `voltooiing: ${error?.message}`);

  const bobSees = await bob.client.from('task_completions').select('id').eq('id', compl.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot ziet de voltooiing (erft taak-zichtbaarheid)');
  const eveSees = await eve.client.from('task_completions').select('id').eq('id', compl.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander ziet de voltooiing NIET');
});

test('RLS: voltooiing van custom-taak alleen zichtbaar voor genoemde personen', opts, async () => {
  const alice = await makeUser('alice_compl_c');
  const bob = await makeUser('bob_compl_c');     // huisgenoot, genoemd
  const carol = await makeUser('carol_compl_c');  // huisgenoot, niet genoemd

  const hh = await makeHousehold(alice, 'Custom-voltooiinghuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });
  await carol.client.rpc('join_household', { code: code.invite_code });

  // Custom-taak alleen gedeeld met Bob.
  const { data: task } = await alice.client.from('tasks')
    .insert({ household_id: hh.id, title: 'Geheime klus', visibility: 'custom', share_with: [bob.id], created_by: alice.id })
    .select().single();
  const { data: compl, error } = await alice.client.from('task_completions')
    .insert({ household_id: hh.id, task_id: task.id, completed_by: alice.id })
    .select().single();
  assert.ok(!error, `custom-voltooiing: ${error?.message}`);

  const bobSees = await bob.client.from('task_completions').select('id').eq('id', compl.id);
  assert.equal(bobSees.data?.length, 1, 'genoemde persoon ziet de voltooiing');
  const carolSees = await carol.client.from('task_completions').select('id').eq('id', compl.id);
  assert.equal(carolSees.data?.length ?? 0, 0, 'niet-genoemde huisgenoot ziet de voltooiing NIET');
});

// --- Boodschappen-catalogus: purchases (via create_purchase RPC) + purchase_items
// Catalogus/bonnen zijn household-breed (is_member, géén visibility-contract).
// Verifieert dat (a) de atomaire RPC werkt, (b) een huisgenoot de bon + regels ziet
// en (c) een buitenstaander niets ziet — de regels erven de toegang van hun parent.

test('RLS: bon + bonregels zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_boo');
  const bob = await makeUser('bob_boo');       // huisgenoot
  const eve = await makeUser('eve_boo');        // buitenstaander

  const hh = await makeHousehold(alice, 'Boodschappenhuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  // Alice maakt een product in de catalogus en voert een bon met twee regels in via de RPC.
  const { data: product, error: pErr } = await alice.client.from('products')
    .insert({ household_id: hh.id, name: 'Halfvolle melk', search: 'halfvolle melk', created_by: alice.id })
    .select().single();
  assert.ok(!pErr, `product: ${pErr?.message}`);

  const { data: purchaseId, error: rpcErr } = await alice.client.rpc('create_purchase', {
    p_household_id: hh.id, p_store: 'AH', p_purchased_on: null, p_total_cents: 250,
    p_photo_path: null,
    p_items: [
      { product_id: product.id, name: 'Halfvolle melk 1L', quantity: 1, unit: 'l', unit_price_cents: 119, line_total_cents: 119 },
      { product_id: null, name: 'Brood', quantity: 1, unit: 'stuk', unit_price_cents: 131, line_total_cents: 131 },
    ],
  });
  assert.ok(!rpcErr, `create_purchase: ${rpcErr?.message}`);
  assert.ok(purchaseId, 'RPC moet het nieuwe purchase-id teruggeven');

  // Bob ziet de bon, de regels én het product; Eve niets.
  const bobBon = await bob.client.from('purchases').select('id').eq('id', purchaseId);
  assert.equal(bobBon.data?.length, 1, 'huisgenoot moet de bon zien');
  const bobItems = await bob.client.from('purchase_items').select('id').eq('purchase_id', purchaseId);
  assert.equal(bobItems.data?.length, 2, 'huisgenoot moet de bonregels zien (erven parent-toegang)');
  const bobProd = await bob.client.from('products').select('id').eq('id', product.id);
  assert.equal(bobProd.data?.length, 1, 'huisgenoot moet het catalogusproduct zien');

  const eveBon = await eve.client.from('purchases').select('id').eq('id', purchaseId);
  assert.equal(eveBon.data?.length ?? 0, 0, 'buitenstaander mag de bon NIET zien');
  const eveItems = await eve.client.from('purchase_items').select('id').eq('purchase_id', purchaseId);
  assert.equal(eveItems.data?.length ?? 0, 0, 'buitenstaander mag de bonregels NIET zien');
  const eveProd = await eve.client.from('products').select('id').eq('id', product.id);
  assert.equal(eveProd.data?.length ?? 0, 0, 'buitenstaander mag het catalogusproduct NIET zien');
});

// --- Keuken-loop: recipes/recipe_ingredients/meal_plan_entries/pantry_items -----
// Household-brede data (is_member); recipe_ingredients erft via de parent-recipe.

test('RLS: recept + ingrediënt + weekmenu + voorraad household-gescoped', opts, async () => {
  const alice = await makeUser('alice_keuken');
  const bob = await makeUser('bob_keuken');     // huisgenoot
  const eve = await makeUser('eve_keuken');      // buitenstaander

  const hh = await makeHousehold(alice, 'Keukenhuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  const { data: recipe, error: rErr } = await alice.client.from('recipes')
    .insert({ household_id: hh.id, title: 'Pasta pesto', servings: 2, created_by: alice.id }).select().single();
  assert.ok(!rErr, `recept: ${rErr?.message}`);
  const { data: ing, error: iErr } = await alice.client.from('recipe_ingredients')
    .insert({ household_id: hh.id, recipe_id: recipe.id, name: 'Pasta', quantity: 500, unit: 'g' }).select().single();
  assert.ok(!iErr, `ingrediënt: ${iErr?.message}`);
  const { data: meal } = await alice.client.from('meal_plan_entries')
    .insert({ household_id: hh.id, plan_date: '2026-06-20', meal_type: 'diner', recipe_id: recipe.id, servings: 2, created_by: alice.id }).select().single();
  const { data: pantry } = await alice.client.from('pantry_items')
    .insert({ household_id: hh.id, name: 'Olijfolie', quantity: 1, unit: 'l', updated_by: alice.id }).select().single();

  for (const [tbl, row] of [['recipes', recipe], ['recipe_ingredients', ing], ['meal_plan_entries', meal], ['pantry_items', pantry]]) {
    const bobSees = await bob.client.from(tbl).select('id').eq('id', row.id);
    assert.equal(bobSees.data?.length, 1, `huisgenoot ziet ${tbl}`);
    const eveSees = await eve.client.from(tbl).select('id').eq('id', row.id);
    assert.equal(eveSees.data?.length ?? 0, 0, `buitenstaander ziet ${tbl} NIET`);
  }
});

// --- Autodelen: shared_resources (contract) + reservations (erft via parent) ----

test('RLS: gedeeld item + reservering zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_delen');
  const bob = await makeUser('bob_delen');     // huisgenoot
  const eve = await makeUser('eve_delen');      // buitenstaander

  const hh = await makeHousehold(alice, 'Deelhuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  const { data: res, error: resErr } = await alice.client.from('shared_resources')
    .insert({ household_id: hh.id, name: 'De auto', kind: 'auto', visibility: 'household', created_by: alice.id }).select().single();
  assert.ok(!resErr, `resource: ${resErr?.message}`);
  const { data: rsv, error: rsvErr } = await alice.client.from('reservations')
    .insert({ household_id: hh.id, resource_id: res.id, profile_id: alice.id,
      starts_at: '2026-06-20T09:00:00Z', ends_at: '2026-06-20T17:00:00Z' }).select().single();
  assert.ok(!rsvErr, `reservering: ${rsvErr?.message}`);

  const bobSees = await bob.client.from('reservations').select('id').eq('id', rsv.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot ziet de reservering (erft resource-toegang)');
  const eveSees = await eve.client.from('reservations').select('id').eq('id', rsv.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander ziet de reservering NIET');
});

test('RLS: reservering van een custom-resource alleen voor genoemde personen', opts, async () => {
  const alice = await makeUser('alice_delen2');
  const bob = await makeUser('bob_delen2');     // huisgenoot, NIET in de custom-share
  const hh = await makeHousehold(alice, 'Deelhuis2');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  // Resource alleen gedeeld met Alice (de maker). Bob is huisgenoot maar niet genoemd.
  const { data: res } = await alice.client.from('shared_resources')
    .insert({ household_id: hh.id, name: 'Privé boormachine', kind: 'gereedschap',
      visibility: 'custom', share_with: [alice.id], created_by: alice.id }).select().single();
  const { data: rsv } = await alice.client.from('reservations')
    .insert({ household_id: hh.id, resource_id: res.id, profile_id: alice.id,
      starts_at: '2026-06-21T09:00:00Z', ends_at: '2026-06-21T12:00:00Z' }).select().single();

  const aliceSees = await alice.client.from('reservations').select('id').eq('id', rsv.id);
  assert.equal(aliceSees.data?.length, 1, 'maker ziet zijn eigen reservering');
  const bobSees = await bob.client.from('reservations').select('id').eq('id', rsv.id);
  assert.equal(bobSees.data?.length ?? 0, 0, 'huisgenoot buiten de custom-share ziet de reservering NIET');
});

// --- Kosten-inzichten: recurring_expenses (contract) + expenses.category (0019) ----

test('RLS: terugkerende uitgave zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_recur');
  const bob = await makeUser('bob_recur');     // huisgenoot
  const eve = await makeUser('eve_recur');      // buitenstaander

  const hh = await makeHousehold(alice, 'Recurhuis');
  const { data: code } = await alice.client.from('households').select('invite_code').eq('id', hh.id).single();
  await bob.client.rpc('join_household', { code: code.invite_code });

  const { data: tpl, error } = await alice.client.from('recurring_expenses')
    .insert({ household_id: hh.id, description: 'Huur', amount_cents: 120000, paid_by: alice.id,
      next_date: '2026-07-01', visibility: 'household', created_by: alice.id }).select().single();
  assert.ok(!error, `recurring: ${error?.message}`);

  const bobSees = await bob.client.from('recurring_expenses').select('id').eq('id', tpl.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot ziet het sjabloon');
  const eveSees = await eve.client.from('recurring_expenses').select('id').eq('id', tpl.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander ziet het sjabloon NIET');
});

test('RLS: create_expense schrijft de categorie (0019)', opts, async () => {
  const alice = await makeUser('alice_cat');
  const hh = await makeHousehold(alice, 'Categoriehuis');

  const { data: expId, error } = await alice.client.rpc('create_expense', {
    p_household_id: hh.id, p_description: 'AH', p_amount_cents: 2000, p_paid_by: alice.id,
    p_spent_on: '2026-06-20', p_split_type: 'equal', p_visibility: 'household',
    p_share_subgroup_id: null, p_share_with: null,
    p_shares: [{ profile_id: alice.id, amount_cents: 2000 }],
    p_source_type: null, p_source_id: null, p_category: 'boodschappen',
  });
  assert.ok(!error, `create_expense: ${error?.message}`);
  const { data: row } = await alice.client.from('expenses').select('category').eq('id', expId).single();
  assert.equal(row.category, 'boodschappen', 'de categorie is opgeslagen');
});

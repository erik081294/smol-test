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

  // Alice maakt een huishouden (via create_household-RPC) en nodigt Bob uit.
  const hh = await makeHousehold(alice, 'Testhuis');

  await addMember(alice, bob, hh.id);

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
  await addMember(alice, bob, hh.id);
  await addMember(alice, carol, hh.id);

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

  const { data: mine } = await alice.client.from('household_members')
    .select('role').eq('household_id', hh.id).eq('profile_id', alice.id).single();
  assert.equal(mine?.role, 'owner', 'de maker is owner');
});

test('RLS: SEC-4 — alleen de owner mag het huishouden bewerken (naam/budget)', opts, async () => {
  const alice = await makeUser('alice_sec4'); // owner
  const bob = await makeUser('bob_sec4');     // gewoon lid

  const hh = await makeHousehold(alice, 'Beheerhuis');
  await addMember(alice, bob, hh.id);

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

// Voegt `member` toe aan `householdId` via het invite-token-systeem (0053): de owner
// maakt een eenmalige, persoonlijke invite en het lid wisselt 'm in. Vervangt de oude
// statische join_household-route (in 0055 verwijderd — bruteforcebaar). Elk lid krijgt
// z'n eigen invite, want een token is single-use.
async function addMember(owner, member, householdId, role = 'member') {
  const { data: inv, error: cErr } = await owner.client
    .rpc('create_invite', { p_household_id: householdId, p_role: role });
  assert.ok(!cErr, `invite maken: ${cErr?.message}`);
  const { error: aErr } = await member.client.rpc('accept_invite', { p_token: inv.token });
  assert.ok(!aErr, `invite accepteren: ${aErr?.message}`);
}

test('RLS: household-uitgave + shares zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_exp');
  const bob = await makeUser('bob_exp');     // huisgenoot
  const eve = await makeUser('eve_exp');      // buitenstaander

  const hh = await makeHousehold(alice, 'Kostenhuis');
  await addMember(alice, bob, hh.id);

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
  await addMember(alice, bob, hh.id);

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
  await addMember(alice, bob, hh.id);

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
  await addMember(alice, bob, hh.id);

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
  await addMember(alice, bob, hh.id);

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
  await addMember(alice, bob, hh.id);

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
  await addMember(alice, bob, hh.id);

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
  await addMember(alice, bob, hh.id);

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
  await addMember(alice, bob, hh.id);
  await addMember(alice, carol, hh.id);

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
  await addMember(alice, bob, hh.id);

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
  await addMember(alice, bob, hh.id);

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
  await addMember(alice, bob, hh.id);

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
  await addMember(alice, bob, hh.id);

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

// --- Nieuwere moduletabellen (0038/0046/0047) die 0066 op de gedeelde RLS-helper wees:
//     pets/vehicles/groceries volgen het standaard-zichtbaarheidscontract; pet_log/
//     vehicle_log erven via can_view van hun parent (pet/vehicle). Eén huisgenoot-ziet/
//     buitenstaander-geblokkeerd-scenario per tabel, exact naar het bestaande sjabloon.

test('RLS: household-huisdier zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_pet');
  const bob = await makeUser('bob_pet');     // huisgenoot
  const eve = await makeUser('eve_pet');      // buitenstaander

  const hh = await makeHousehold(alice, 'Huisdierhuis');
  await addMember(alice, bob, hh.id);

  const { data: pet, error } = await alice.client.from('pets')
    .insert({ household_id: hh.id, name: 'Rex', type: 'hond', visibility: 'household', created_by: alice.id })
    .select().single();
  assert.ok(!error, `huisdier: ${error?.message}`);

  const bobSees = await bob.client.from('pets').select('id').eq('id', pet.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot moet het household-huisdier zien');
  const eveSees = await eve.client.from('pets').select('id').eq('id', pet.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander mag het huisdier NIET zien');
});

test('RLS: household-voertuig zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_veh');
  const bob = await makeUser('bob_veh');     // huisgenoot
  const eve = await makeUser('eve_veh');      // buitenstaander

  const hh = await makeHousehold(alice, 'Voertuighuis');
  await addMember(alice, bob, hh.id);

  const { data: vehicle, error } = await alice.client.from('vehicles')
    .insert({ household_id: hh.id, name: 'De bus', visibility: 'household', created_by: alice.id })
    .select().single();
  assert.ok(!error, `voertuig: ${error?.message}`);

  const bobSees = await bob.client.from('vehicles').select('id').eq('id', vehicle.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot moet het household-voertuig zien');
  const eveSees = await eve.client.from('vehicles').select('id').eq('id', vehicle.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander mag het voertuig NIET zien');
});

test('RLS: household-boodschap zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_gro');
  const bob = await makeUser('bob_gro');     // huisgenoot
  const eve = await makeUser('eve_gro');      // buitenstaander

  const hh = await makeHousehold(alice, 'Boodschappenlijsthuis');
  await addMember(alice, bob, hh.id);

  // groceries gebruikt `added_by` als creator-kolom (0003/0066), niet created_by.
  const { data: item, error } = await alice.client.from('groceries')
    .insert({ household_id: hh.id, name: 'Melk', visibility: 'household', added_by: alice.id })
    .select().single();
  assert.ok(!error, `boodschap: ${error?.message}`);

  const bobSees = await bob.client.from('groceries').select('id').eq('id', item.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot moet de household-boodschap zien');
  const eveSees = await eve.client.from('groceries').select('id').eq('id', item.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander mag de boodschap NIET zien');
});

test('RLS: huisdier-logboek zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_petlog');
  const bob = await makeUser('bob_petlog');     // huisgenoot
  const eve = await makeUser('eve_petlog');      // buitenstaander

  const hh = await makeHousehold(alice, 'Huisdierlogboekhuis');
  await addMember(alice, bob, hh.id);

  const { data: pet } = await alice.client.from('pets')
    .insert({ household_id: hh.id, name: 'Miauw', type: 'kat', visibility: 'household', created_by: alice.id })
    .select().single();
  const { data: entry, error } = await alice.client.from('pet_log')
    .insert({ household_id: hh.id, pet_id: pet.id, note: 'Dierenarts geweest', created_by: alice.id })
    .select().single();
  assert.ok(!error, `pet_log: ${error?.message}`);

  const bobSees = await bob.client.from('pet_log').select('id').eq('id', entry.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot ziet het logboek (erft pet-zichtbaarheid)');
  const eveSees = await eve.client.from('pet_log').select('id').eq('id', entry.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander ziet het huisdier-logboek NIET');
});

test('RLS: voertuig-logboek zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_vehlog');
  const bob = await makeUser('bob_vehlog');     // huisgenoot
  const eve = await makeUser('eve_vehlog');      // buitenstaander

  const hh = await makeHousehold(alice, 'Voertuiglogboekhuis');
  await addMember(alice, bob, hh.id);

  const { data: vehicle } = await alice.client.from('vehicles')
    .insert({ household_id: hh.id, name: 'De auto', visibility: 'household', created_by: alice.id })
    .select().single();
  const { data: entry, error } = await alice.client.from('vehicle_log')
    .insert({ household_id: hh.id, vehicle_id: vehicle.id, title: 'Grote beurt', note: 'Olie ververst', created_by: alice.id })
    .select().single();
  assert.ok(!error, `vehicle_log: ${error?.message}`);

  const bobSees = await bob.client.from('vehicle_log').select('id').eq('id', entry.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot ziet het logboek (erft vehicle-zichtbaarheid)');
  const eveSees = await eve.client.from('vehicle_log').select('id').eq('id', entry.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander ziet het voertuig-logboek NIET');
});

// --- Kosten-inzichten: recurring_expenses (contract) + expenses.category (0019) ----

test('RLS: terugkerende uitgave zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_recur');
  const bob = await makeUser('bob_recur');     // huisgenoot
  const eve = await makeUser('eve_recur');      // buitenstaander

  const hh = await makeHousehold(alice, 'Recurhuis');
  await addMember(alice, bob, hh.id);

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

// --- Tijdlijn / prikbord (0054) — de nieuwste, hoogste-churn tabel -----------
test('RLS: tijdlijnbericht + foto zichtbaar voor huisgenoot, niet voor buitenstaander', opts, async () => {
  const alice = await makeUser('alice_tl');
  const bob = await makeUser('bob_tl');     // huisgenoot
  const eve = await makeUser('eve_tl');      // buitenstaander

  const hh = await makeHousehold(alice, 'Tijdlijnhuis');
  await addMember(alice, bob, hh.id);

  const { data: post, error } = await alice.client.from('timeline_posts')
    .insert({ household_id: hh.id, author_id: alice.id, body: 'Hoi huis!', visibility: 'household' })
    .select().single();
  assert.ok(!error, `post: ${error?.message}`);

  // Foto-rij (kind-tabel, erft de zichtbaarheid van de parent-post).
  const { error: phErr } = await alice.client.from('timeline_photos')
    .insert({ household_id: hh.id, post_id: post.id, photo_path: `${hh.id}/${post.id}/x.jpg`, position: 0 });
  assert.ok(!phErr, `foto: ${phErr?.message}`);

  const bobSees = await bob.client.from('timeline_posts').select('id').eq('id', post.id);
  assert.equal(bobSees.data?.length, 1, 'huisgenoot ziet het bericht');
  const bobPhoto = await bob.client.from('timeline_photos').select('id').eq('post_id', post.id);
  assert.equal(bobPhoto.data?.length, 1, 'huisgenoot ziet de foto-rij (erft post-zichtbaarheid)');

  const eveSees = await eve.client.from('timeline_posts').select('id').eq('id', post.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander ziet het bericht NIET');
  const evePhoto = await eve.client.from('timeline_photos').select('id').eq('post_id', post.id);
  assert.equal(evePhoto.data?.length ?? 0, 0, 'buitenstaander ziet de foto-rij NIET');
});

// --- Emoji-reacties (0067) — polymorf doel + can_view-lekpreventie op de parent ---
test('RLS: emoji-reactie — lid reageert/toggelt, buitenstaander buitenspel, auteur niet te vervalsen, geen lek op onzichtbare post (0067)', opts, async () => {
  const alice = await makeUser('alice_rx');
  const bob = await makeUser('bob_rx');     // huisgenoot
  const eve = await makeUser('eve_rx');      // buitenstaander

  const hh = await makeHousehold(alice, 'Reactiehuis');
  await addMember(alice, bob, hh.id);

  const { data: post, error: pErr } = await alice.client.from('timeline_posts')
    .insert({ household_id: hh.id, author_id: alice.id, body: 'Reageer maar', visibility: 'household' })
    .select().single();
  assert.ok(!pErr, `post: ${pErr?.message}`);

  // Lid reageert op een zichtbare post → mag, en de huisgenoot ziet de reactie.
  const { data: rx, error: rxErr } = await bob.client.from('timeline_reactions')
    .insert({ household_id: hh.id, author_id: bob.id, target_type: 'post', target_id: post.id, emoji: '👏' })
    .select().single();
  assert.ok(!rxErr, `lid reageert: ${rxErr?.message}`);
  const aliceSees = await alice.client.from('timeline_reactions').select('id, emoji').eq('target_id', post.id);
  assert.equal(aliceSees.data?.length, 1, 'huisgenoot ziet de reactie');
  assert.equal(aliceSees.data?.[0].emoji, '👏', 'de juiste emoji');

  // Buitenstaander: ziet de reactie NIET en mag er zelf geen plaatsen (geen lid).
  const eveSees = await eve.client.from('timeline_reactions').select('id').eq('target_id', post.id);
  assert.equal(eveSees.data?.length ?? 0, 0, 'buitenstaander ziet de reactie NIET');
  const { error: eveInsErr } = await eve.client.from('timeline_reactions')
    .insert({ household_id: hh.id, author_id: eve.id, target_type: 'post', target_id: post.id, emoji: '👏' });
  assert.ok(eveInsErr, 'buitenstaander mag niet reageren (geen lid)');

  // Auteur niet te vervalsen: een lid mag geen reactie op naam van een ander plaatsen.
  const { error: forgeErr } = await bob.client.from('timeline_reactions')
    .insert({ household_id: hh.id, author_id: alice.id, target_type: 'post', target_id: post.id, emoji: '❤️' });
  assert.ok(forgeErr, 'een lid mag geen reactie op naam van een ander plaatsen (author_id = auth.uid())');

  // Togglen-uit: eigen reactie verwijderen → weg voor iedereen.
  const { error: delErr } = await bob.client.from('timeline_reactions').delete().eq('id', rx.id);
  assert.ok(!delErr, `eigen reactie verwijderen: ${delErr?.message}`);
  const gone = await alice.client.from('timeline_reactions').select('id').eq('id', rx.id);
  assert.equal(gone.data?.length ?? 0, 0, 'de reactie is weg na togglen');

  // Lekpreventie: Alice plaatst een custom post die Bob NIET mag zien en reageert er zelf op.
  // Bob (wel lid) mag die reactie niet zien én er niet op reageren (can_view op de parent).
  const { data: secret, error: sErr } = await alice.client.from('timeline_posts')
    .insert({ household_id: hh.id, author_id: alice.id, body: 'Alleen ik', visibility: 'custom', share_with: [alice.id] })
    .select().single();
  assert.ok(!sErr, `custom post: ${sErr?.message}`);
  const { error: aliceSelfRx } = await alice.client.from('timeline_reactions')
    .insert({ household_id: hh.id, author_id: alice.id, target_type: 'post', target_id: secret.id, emoji: '🎉' });
  assert.ok(!aliceSelfRx, `auteur reageert op eigen custom post: ${aliceSelfRx?.message}`);
  const bobSecret = await bob.client.from('timeline_reactions').select('id').eq('target_id', secret.id);
  assert.equal(bobSecret.data?.length ?? 0, 0, 'lid ziet reactie op onzichtbare post NIET (can_view-lekpreventie)');
  const { error: bobSecretIns } = await bob.client.from('timeline_reactions')
    .insert({ household_id: hh.id, author_id: bob.id, target_type: 'post', target_id: secret.id, emoji: '👍' });
  assert.ok(bobSecretIns, 'lid mag niet reageren op een post die het niet mag zien');
});

// --- Uitnodigingen (0053) — de toetredingsroute zelf moet waterdicht zijn -----
test('RLS: alleen de owner maakt invites; token is single-use, buitenstaander buitenspel', opts, async () => {
  const alice = await makeUser('alice_inv');   // owner
  const bob = await makeUser('bob_inv');       // wordt lid
  const eve = await makeUser('eve_inv');        // buitenstaander

  const hh = await makeHousehold(alice, 'Invitehuis');

  // Buitenstaander mag geen invite voor een vreemd huishouden maken (is_owner faalt).
  const { error: eveErr } = await eve.client.rpc('create_invite', { p_household_id: hh.id, p_role: 'member' });
  assert.ok(eveErr, 'een buitenstaander mag geen invite voor een vreemd huishouden maken');

  // Owner maakt een invite; Bob wisselt 'm in (wordt lid).
  const { data: inv, error: cErr } = await alice.client.rpc('create_invite', { p_household_id: hh.id, p_role: 'member' });
  assert.ok(!cErr, `invite maken: ${cErr?.message}`);
  const { error: aErr } = await bob.client.rpc('accept_invite', { p_token: inv.token });
  assert.ok(!aErr, `accept: ${aErr?.message}`);

  // Single-use: Eve kan hetzelfde token niet alsnog inwisselen.
  const { error: reuseErr } = await eve.client.rpc('accept_invite', { p_token: inv.token });
  assert.ok(reuseErr, 'een al gebruikt invite-token mag niet opnieuw worden ingewisseld');
  const eveMember = await eve.client.from('household_members')
    .select('profile_id').eq('household_id', hh.id).eq('profile_id', eve.id);
  assert.equal(eveMember.data?.length ?? 0, 0, 'Eve is geen lid geworden via een gebruikt token');
});

// --- 0070: rekey-guard + aangescherpte insert-policies + share-guards ----------
//     (review-addendum 2026-07-04, Sec-1/Data-10/Data-3). De trigger maakt
//     household_id en de creator-kolom onveranderlijk; de directe inserts op
//     expenses/recurring_expenses eisen creator = de inzender; create_expense
//     weigert negatieve of opgeblazen aandelen.

test('RLS 0070: created_by/household_id zijn na aanmaak onveranderlijk (rekey-guard)', opts, async () => {
  const alice = await makeUser('alice_rekey');
  const bob = await makeUser('bob_rekey');     // huisgenoot
  const hh = await makeHousehold(alice, 'Rekeyhuis');
  await addMember(alice, bob, hh.id);

  const { data: task } = await alice.client.from('tasks')
    .insert({ household_id: hh.id, title: 'Rekey-taak', visibility: 'household', created_by: alice.id })
    .select().single();

  // Legitiem gedeeld bewerken blijft werken (huisgenoot hernoemt/vinkt af).
  const { error: renameErr } = await bob.client.from('tasks')
    .update({ title: 'Hernoemd door huisgenoot' }).eq('id', task.id);
  assert.ok(!renameErr, `huisgenoot mag de taak bewerken: ${renameErr?.message}`);

  // Attributie-spoofing via UPDATE is dicht (de 0066-omzeiling uit het addendum).
  const { error: spoofErr } = await bob.client.from('tasks')
    .update({ created_by: bob.id }).eq('id', task.id);
  assert.ok(spoofErr, 'created_by herschrijven moet worden geweigerd');

  const { error: moveErr } = await alice.client.from('tasks')
    .update({ household_id: hh.id === task.household_id ? task.household_id : hh.id, created_by: bob.id })
    .eq('id', task.id);
  assert.ok(moveErr, 'ook de creator zelf mag de attributie niet herschrijven');

  const after = await alice.client.from('tasks').select('created_by').eq('id', task.id).single();
  assert.equal(after.data?.created_by, alice.id, 'de oorspronkelijke creator staat er nog');
});

test('RLS 0070: directe insert met gespoofte created_by op (recurring_)expenses geweigerd', opts, async () => {
  const alice = await makeUser('alice_spoof');
  const bob = await makeUser('bob_spoof');     // huisgenoot
  const hh = await makeHousehold(alice, 'Spoofhuis');
  await addMember(alice, bob, hh.id);

  // recurring_expenses: de client schrijft deze tabel direct.
  const { error: spoofRecur } = await bob.client.from('recurring_expenses')
    .insert({ household_id: hh.id, description: 'Nep-huur', amount_cents: 1, paid_by: bob.id,
      next_date: '2026-08-01', visibility: 'household', created_by: alice.id });
  assert.ok(spoofRecur, 'recurring_expenses-insert met andermans created_by moet worden geweigerd');

  const { error: okRecur } = await bob.client.from('recurring_expenses')
    .insert({ household_id: hh.id, description: 'Echte huur', amount_cents: 1, paid_by: bob.id,
      next_date: '2026-08-01', visibility: 'household', created_by: bob.id });
  assert.ok(!okRecur, `eigen created_by blijft toegestaan: ${okRecur?.message}`);

  // expenses: het REST-pad om de DEFINER-RPC's heen.
  const { error: spoofExp } = await bob.client.from('expenses')
    .insert({ household_id: hh.id, description: 'Nep', amount_cents: 1, paid_by: bob.id,
      spent_on: '2026-07-04', split_type: 'exact', visibility: 'household', created_by: alice.id });
  assert.ok(spoofExp, 'expenses-insert met andermans created_by moet worden geweigerd');
});

test('RLS 0070: create_expense weigert negatieve en opgeblazen aandelen (share-guard)', opts, async () => {
  const alice = await makeUser('alice_shareguard');
  const hh = await makeHousehold(alice, 'Shareguardhuis');

  const { error: negErr } = await alice.client.rpc('create_expense', {
    p_household_id: hh.id, p_description: 'Negatief aandeel', p_amount_cents: 100,
    p_paid_by: alice.id, p_spent_on: '2026-07-04', p_split_type: 'exact',
    p_visibility: 'household', p_share_subgroup_id: null, p_share_with: null,
    p_shares: [{ profile_id: alice.id, amount_cents: -5 }],
  });
  assert.ok(negErr, 'negatief aandeel moet worden geweigerd');

  const { error: inflateErr } = await alice.client.rpc('create_expense', {
    p_household_id: hh.id, p_description: 'Opgeblazen som', p_amount_cents: 100,
    p_paid_by: alice.id, p_spent_on: '2026-07-04', p_split_type: 'exact',
    p_visibility: 'household', p_share_subgroup_id: null, p_share_with: null,
    p_shares: [{ profile_id: alice.id, amount_cents: 999 }],
  });
  assert.ok(inflateErr, 'som boven het bedrag moet worden geweigerd');

  // Subset-split (som < bedrag) blijft legitiem — de saldologica rekent op de shares.
  const { data: okId, error: okErr } = await alice.client.rpc('create_expense', {
    p_household_id: hh.id, p_description: 'Subset-split', p_amount_cents: 100,
    p_paid_by: alice.id, p_spent_on: '2026-07-04', p_split_type: 'equal',
    p_visibility: 'household', p_share_subgroup_id: null, p_share_with: null,
    p_shares: [{ profile_id: alice.id, amount_cents: 40 }],
  });
  assert.ok(!okErr && okId, `subset-split blijft toegestaan: ${okErr?.message}`);
});

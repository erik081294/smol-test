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
import { test, before, after } from 'node:test';
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

// Maakt een bevestigde gebruiker + ingelogde anon-client voor die persoon.
async function makeUser(name) {
  const email = `${tag}.${name}@example.com`;
  const password = 'Test1234!passphrase';
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: name },
  });
  assert.ok(!error, `gebruiker aanmaken (${name}): ${error?.message}`);
  created.push(data.user.id);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
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

  // Alice maakt een huishouden en deelt de code met Bob.
  const { data: hh, error: hhErr } = await alice.client
    .from('households').insert({ name: 'Testhuis', created_by: alice.id }).select().single();
  assert.ok(!hhErr, `huishouden: ${hhErr?.message}`);
  await alice.client.from('household_members')
    .insert({ household_id: hh.id, profile_id: alice.id, role: 'owner' });

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

  const { data: hh } = await alice.client
    .from('households').insert({ name: 'Testhuis2', created_by: alice.id }).select().single();
  await alice.client.from('household_members')
    .insert({ household_id: hh.id, profile_id: alice.id, role: 'owner' });
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
  const mk = async (name) => {
    const { data: hh } = await alice.client
      .from('households').insert({ name, created_by: alice.id }).select().single();
    await alice.client.from('household_members')
      .insert({ household_id: hh.id, profile_id: alice.id, role: 'owner' });
    return hh;
  };
  const hhA = await mk('Huis A');
  const hhB = await mk('Huis B');

  // Subgroep in huis B.
  const { data: sg } = await alice.client.from('subgroups')
    .insert({ household_id: hhB.id, name: 'B-groep', created_by: alice.id }).select().single();

  // Taak in huis A die naar de B-subgroep wijst -> moet door de trigger geweigerd.
  const { error } = await alice.client.from('tasks').insert({
    household_id: hhA.id, title: 'Lek', visibility: 'subgroup', share_subgroup_id: sg.id, created_by: alice.id,
  });
  assert.ok(error, 'cross-huishouden subgroep-deling had geweigerd moeten worden');
});

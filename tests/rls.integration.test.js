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

// --- Kosten-module: expenses (via de create_expense RPC) + expense_shares ----
// Verifieert dat (a) de atomaire RPC werkt, (b) de hoofdtabel het contract volgt
// en (c) de kindtabel expense_shares de zichtbaarheid van zijn parent erft.

async function makeHousehold(owner, name) {
  const { data: hh } = await owner.client
    .from('households').insert({ name, created_by: owner.id }).select().single();
  await owner.client.from('household_members')
    .insert({ household_id: hh.id, profile_id: owner.id, role: 'owner' });
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

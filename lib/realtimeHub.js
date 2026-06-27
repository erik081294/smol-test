// @ts-check
// Gedeelde realtime-hub (INF-8 "kanalen bundelen tot één household-channel").
//
// Probleem: elke collectie-hook opende vóór dit z'n eigen Supabase-kanaal. Op een
// scherm met veel hooks (de Vandaag-widget-grid) gaf dat een "hook-storm": N kanalen
// + N postgres_changes-abonnementen tegelijk, met duplicaten (Home's boodschappen-
// widget én de Boodschappen-tab luisteren op dezelfde tabel).
//
// Oplossing: één kanaal per `key` (= het actieve huishouden), met per uniek
// (tabel, filter) precies één postgres_changes-listener die naar álle geregistreerde
// callbacks fan-out't. Resultaat: 1 kanaal i.p.v. N, en geen dubbele server-side
// abonnementen meer. Hooks blijven hun eigen `loadFn`/`onChange` houden.
//
// Supabase verbiedt `.on(...)` ná `.subscribe()`, dus we kunnen niet bijplaatsen op
// een lopend kanaal. Daarom: bij een wijziging van de set unieke bronnen bouwen we het
// kanaal opnieuw op (teardown → nieuw kanaal met álle listeners → subscribe). Die
// rebuild is **gedebounced** zodat de mount-burst van een heel scherm in één keer
// samenvalt, en gebeurt alléén als er een bron bíjkomt of verdwijnt — een extra
// abonnee op een al-bekeken tabel verandert niets aan het kanaal.

// sourceKey: identificeert een unieke (tabel, filter)-bron binnen een hub.
const sourceKey = (table, filter) => `${table}|${filter ?? ''}`;

// Maakt een hub bovenop een realtime-client. `client` (supabase) en `schedule` (de
// debounce-strategie) zijn injecteerbaar zodat de bookkeeping puur te unit-testen is.
export function createRealtimeHub(client, { schedule = (fn) => setTimeout(fn, 0) } = {}) {
  const hubs = new Map(); // key -> { sources: Map<sk,{table,filter,cbs:Set}>, channel, version, scheduled, label }

  function rebuild(hub, key) {
    hub.scheduled = false;
    if (hub.channel) { client.removeChannel(hub.channel); hub.channel = null; }
    if (hub.sources.size === 0) { hubs.delete(key); return; }
    hub.version += 1;
    let channel = client.channel(`hub:${hub.label}:${key}:v${hub.version}`);
    for (const src of hub.sources.values()) {
      // Live fan-out: de listener leest src.cbs op het moment van het event, zodat
      // bijkomende/vertrekkende abonnees op een bestaande bron géén rebuild vergen.
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: src.table, ...(src.filter ? { filter: src.filter } : {}) },
        (payload) => { for (const cb of src.cbs) cb(payload); },
      );
    }
    channel.subscribe();
    hub.channel = channel;
  }

  function scheduleRebuild(hub, key) {
    if (hub.scheduled) return;
    hub.scheduled = true;
    schedule(() => rebuild(hub, key));
  }

  // Registreer een set listeners op de hub van `key`. Geeft een cleanup terug die
  // exact deze listeners weer afmeldt.
  //   listeners: [{ table, filter?, cb }]
  function subscribe(key, listeners, label = 'rt') {
    if (!key || !listeners?.length) return () => {};
    let hub = hubs.get(key);
    if (!hub) { hub = { sources: new Map(), channel: null, version: 0, scheduled: false, label }; hubs.set(key, hub); }

    let needsRebuild = false;
    const added = [];
    for (const l of listeners) {
      const sk = sourceKey(l.table, l.filter);
      let src = hub.sources.get(sk);
      if (!src) { src = { table: l.table, filter: l.filter ?? null, cbs: new Set() }; hub.sources.set(sk, src); needsRebuild = true; }
      src.cbs.add(l.cb);
      added.push({ sk, cb: l.cb });
    }
    if (needsRebuild) scheduleRebuild(hub, key);

    return () => {
      const h = hubs.get(key);
      if (!h) return;
      let teardown = false;
      for (const { sk, cb } of added) {
        const src = h.sources.get(sk);
        if (!src) continue;
        src.cbs.delete(cb);
        if (src.cbs.size === 0) { h.sources.delete(sk); teardown = true; }
      }
      if (teardown) scheduleRebuild(h, key);
    };
  }

  // Sloopt álle kanalen van álle huishoudens en wist de staat. Bedoeld voor logout:
  // forceer een schone lei vóór auth.signOut(), zodat geen postgres_changes-callback van
  // het vorige account nog kan vuren (de hub is een module-singleton die clearCache() niet
  // meeneemt). Een nog-lopende per-hook-unsub erna is een veilige no-op (hubs is leeg).
  function teardownAll() {
    for (const hub of hubs.values()) {
      if (hub.channel) client.removeChannel(hub.channel);
    }
    hubs.clear();
  }

  return { subscribe, teardownAll };
}

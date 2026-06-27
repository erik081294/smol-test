# De module-ruggengraat — architectuurcontract

Praktische gids bij de vraag *"hoe houden we de groeiende moduleset modulair i.p.v.
spaghetti?"*. Dit is het **gedeelde contract** dat elke datamodule volgt — net zoals
[`zichtbaarheid.md`](./zichtbaarheid.md) het zichtbaarheidscontract beschrijft. Status
en open guardrail-werk staan in [`huishoek-backlog.md`](../huishoek-backlog.md) §6
(`ARCH-*`); dit document beschrijft het *patroon*, niet de status.

## Waarom dit werkt (en geen spaghetti is)

De angst is "losse modules → onhoudbare verbindingen". De codebase ontkracht dat al op
één punt: er is een **ruggengraat** waar elke module op staat, niet een wirwar van
directe koppelingen. Drie lagen, strikt gescheiden:

| Laag | Waar | Regel |
|------|------|-------|
| **Pure logica** | `lib/*.js` (bv. [`expenses.js`](../lib/expenses.js), [`vehicleCare.js`](../lib/vehicleCare.js), [`formValidation.js`](../lib/formValidation.js)) | Geen React/Supabase. Unit-getest + bewaakt door de [mutatie-ratchet](./mutatietesten.md). |
| **React-schil** | `lib/use*.js` (hooks) + `app/**` (schermen) | Dun. Leunt op de pure laag; valt buiten de mutatietest. |
| **Data + RLS** | `supabase/migrations/*` | Eén RLS-sjabloon (`enable_module_rls`) + de toolkit `is_member`/`is_owner`/`can_view`/`in_subgroup`. |

De winst: logica is testbaar en gedeeld; de dunne React-laag mag "dom" zijn. Zolang
nieuwe modules deze scheiding respecteren, schaalt de set zonder te verstrengelen.

## De ruggengraat: een datamodule toevoegen

Eén pad, drie stappen — niet per module opnieuw uitgevonden:

1. **Descriptor** in [`lib/modules.js`](../lib/modules.js) (`MODULES`): `key`, `route`,
   `table`, `creatorColumn`, `kind: 'data'`, groep.
2. **Hook** bovenop [`useCollection`](../lib/useCollection.js) — die levert gratis:
   huishouden-gescopet laden, realtime-subscription, cache-seed en optimistische CRUD
   met foutafhandeling via [`db.js`](../lib/db.js). Een "rijke" module (planten,
   voertuigen) breidt dit uit; hij vervangt het niet. Geef ook `module: '<key>'` mee
   zodat de datalaag-gating (ARCH-3) de tabel niet laadt als de module uit staat —
   de meta-test [`tests/moduleGating.test.js`](../tests/moduleGating.test.js) bewaakt dat.
3. **Migratie** met `public.enable_module_rls('<table>')` zodat de tabel het
   standaard zichtbaarheidscontract krijgt ([`zichtbaarheid.md`](./zichtbaarheid.md)).

Plus een scherm onder `app/(tabs)/<route>.js`. Meer niet.

## De entity-editor (ARCH-1)

De detail-/editor-schermen (`app/<entiteit>/[id].js`) waren het zwakke punt: 400–570
regels met 20+ losse `useState`'s en een per-scherm **gekopieerd** validatie-blok, in de
laag die níet door tests wordt gedekt. Dat is waar copy-paste-spaghetti ontstaat zodra er
modules bijkomen.

De gedeelde oplossing:

- [`lib/formValidation.js`](../lib/formValidation.js) — **pure** regel-runner
  (`runRules`, `isValid`) + regel-fabrieken (`requiredText`, `positive`, `when`).
  Getest in [`tests/formValidation.test.js`](../tests/formValidation.test.js) en
  ratchet-bewaakt: de validatielogica zit nu één keer, getest, i.p.v. ongetest in elk
  scherm. Domein-regels leven bij hun domein (bv. `visibilityRule` in
  [`lib/visibility.js`](../lib/visibility.js)).
- [`lib/useEntityForm.js`](../lib/useEntityForm.js) — de dunne React-schil: `errors`,
  `busy`, `validate(rules, subject)`, en optioneel `values`/`setField`.

**Twee adoptie-niveaus:**

- **Nieuwe editor → volledig.** Laat de hook óók de veldwaarden beheren (`values` +
  `setField`); geen losse `useState`-zwerm meer.
- **Bestaande editor → incrementeel.** Houd je eigen veld-state en vervang enkel het
  `errors + clearErr + validate`-blok. Zo migreer je **gedragsneutraal**, zonder
  risicovolle herschrijving. Referentie:
  [`app/expense/[id].js`](../app/expense/[id].js) is zo omgezet.

```js
const { errors, clearError: clearErr, busy, setBusy, validate } = useEntityForm();
// …
const ok = validate([
  requiredText('description', t('expense.error.description')),
  when('amount', (v) => v.amountCents > 0, t('expense.error.amount')),
  visibilityRule('visibility'),
], subject);
if (!ok) return; // errors gezet + haptische foutpuls
```

> De `field` van een regel is de **foutsleutel** die het veld uitleest — die mag
> verschillen van de gelezen waarde (bv. fout op `amount`, waarde uit `amountCents`).
> Gebruik daarvoor `when(field, predicate, message)`.

## De afspraken (zo blijft het modulair)

1. **Domeinlogica is een pure `lib/*.js`-functie mét unit-test** (en een
   `GROUPS`-regel in [`scripts/mutation-groups.mjs`](../scripts/mutation-groups.mjs)).
   Geen rekenwerk in een scherm of hook dat niet getest kan worden.
2. **Een nieuwe editor gebruikt `useEntityForm` + `formValidation`-regels.** Geen nieuw
   met-de-hand-validatieblok.
3. **Geen hook importeert een zusterhook.** Vandaag doet alleen
   [`useNotifications`](../lib/useNotifications.js) dat (→ `useTasks`/`useMealPlan`/
   `usePantry`); overzichten horen via een capability-interface elke ingeschakelde
   module om z'n samenvatting te vragen (ARCH-2, gepland).
4. **De datalaag respecteert `effectiveModules()`** — laad geen data van een
   uitgezette module (ARCH-3, **afgerond**): data-hooks gaten via de gedeelde
   [`useGatedHouseholdId`](../lib/household.js)-primitive; een meta-test bewaakt dekking.

## Guardrail-routekaart

Volledige onderbouwing: de architectuur-review (sessie 2026-06-26). Actuele status in
[`huishoek-backlog.md`](../huishoek-backlog.md) §6.

| ID | Guardrail | Kern |
|----|-----------|------|
| **ARCH-1** | Gedeelde entity-editor | `formValidation` + `useEntityForm`; **alle 8 editors gemigreerd** (uitgave/recept/voertuig/vaste-last/plant/huisdier/taak). **Afgerond + device-smoke-getest 2026-06-26** → archief. |
| **ARCH-2** | Capability-interface voor overzichten | Vandaag/Notificaties vragen modules om hun samenvatting i.p.v. zusterhooks te importeren. |
| **ARCH-3** | Module-gating in de datalaag | Data-hooks gaten via de gedeelde `useGatedHouseholdId`-primitive (`isModuleEnabled`); cross-cutting tabellen (tasks/products/tags/zones) bewust uitgezonderd; meta-test-wachter. **Afgerond** → archief. |
| **ARCH-4** | Bestandsgrootte-hotspots splitsen | [`i18n.js`](../lib/i18n.js)/[`ui.js`](../lib/ui.js) per domein-namespace. Puur opruimen. |

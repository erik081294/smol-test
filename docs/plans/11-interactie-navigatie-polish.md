# Plan 11 — Interactie- & navigatie-polish (UX-6 + UX-10)

**Backlog:** UX-6 (eigen dialoog-/actiesheet-systeem i.p.v. native `Alert`), UX-10
("vorige"-lintje: terug-knop mét herkomst-naam). **Soort:** design-systeem + cross-cutting
UX. **Migratie:** nee. **Afhankelijkheden:** geen; sluit aan op de net geleverde UX-12
(back-naar-Meer) en op `lib/toast.js` (zelfde provider-patroon).

## Waarom

De app heeft een sterk eigen design-systeem, maar twee plekken vallen er nog buiten:
1. **Native `Alert`** — 21 aanroepen door `app/` + `lib/` (bevestigingen, foutmeldingen,
   één keuzemenu). Die zien er per platform anders uit, negeren het thema/dark-mode en
   blokkeren. Een **eigen dialoog-/actiesheet-systeem** maakt ze merkvast, thema-bewust en
   toetsbaar (UX-6).
2. **Detailschermen** sluiten met een naamloze ✕; je ziet niet wáár je naar terugkeert. Een
   **"vorige"-lintje** (‹ Boodschappen) geeft herkomst en richting (UX-10), in lijn met UX-12.

## UX-6 — Dialoog/actiesheet-systeem

### Provider + hook (model: `lib/toast.js`)
Bouw een `DialogProvider` + `useDialog()` exact volgens het bestaande toast-patroon
(context op moduleniveau, veilige default `{ confirm: () => {}, menu: () => {} }`, imperatief
tonen/sluiten). **Mount** in `app/_layout.js` direct ná `ToastProvider`:
```
<ToastProvider> <DialogProvider> <Gate/> </DialogProvider> </ToastProvider>
```
API (Promise-based, zodat call-sites `await`-baar blijven):
```js
const dialog = useDialog();
await dialog.confirm({ title, body, confirmLabel, tone:'danger'|'default', cancelLabel });
//  -> true/false
const idx = await dialog.menu({ title, options:[{label, icon?, tone?}] }); // -> index of null
dialog.alert({ title, body });          // enkel "OK" (foutmeldingen)
```
Render met de **bestaande** bouwstenen: `BottomSheet` (sheet-presentatie) of een centrale
`Modal` + `Button`/`ModalHeader` uit `lib/ui.js`. `tone:'danger'` gebruikt de bestaande
`Button variant="danger"`. Respecteer safe-area (BottomSheet doet dit al) en `prefersReducedMotion`.

### Migratie van de 21 call-sites (gefaseerd, in volgorde van waarde)
- **Bevestigingen (2)** — verwijderen/verlaten in `app/(tabs)/huishouden.js` → `dialog.confirm({tone:'danger'})`.
- **Discard-guard (1)** — vervang `confirmDiscard()` in `lib/ui.js` (regel ~570) door
  `dialog.confirm` (web-tak `window.confirm` vervalt; één codepad voor alle platforms).
- **Keuzemenu (1)** — foto-bron in `lib/photoPicker.js` (Camera/Bibliotheek) → `dialog.menu`.
- **Foutmeldingen (~14)** — `app/(tabs)/boodschappen|maaltijden|voorraad|huishouden.js`,
  `app/{purchase,expense,task}/[id].js`, `app/kosten-inzichten.js`, `app/catalog.js`,
  `lib/db.js` → `dialog.alert({ title: t('common.failed'), body: e.message })`. Overweeg voor
  een deel een **toast** i.p.v. dialoog (minder onderbrekend); houd dialoog voor blokkerende fouten.
- **Info (3)** — `app/(auth)/welcome.js`, `app/delen.js` → `dialog.alert`.

`lib/photoPicker.js` en `lib/db.js` zijn geen React-componenten en kunnen `useDialog()` niet
aanroepen; geef daar de dialoog/`toast` mee als argument vanaf de call-site, of verplaats de
foutweergave naar de aanroepende component (db.js gooit al nette NL-fouten — laat de UI die tonen).

### i18n (grotendeels aanwezig)
Hergebruik `common.cancel`, `common.delete`, `common.failed`, `common.discard.*` en de
bestaande domein-strings (`household.subgroup.delete.*`, `household.leave.*`). Nieuw alleen waar
nodig: `dialog.ok` ("OK"). Pure strings in `lib/i18n.js`.

## UX-10 — "Vorige"-lintje (terug mét herkomst-naam)

### Aanpak
Voeg aan `ModalHeader` (`lib/ui.js`) een optionele **`backLabel`**-prop toe: toon links een
‹-chevron + de herkomst-naam i.p.v. (of naast) de ✕. `onClose`/`router.back()` blijft de actie.
Bepaal de herkomst-naam uit een kleine **route→parent-map**:
```js
// lib/navMeta.js  (puur, te unit-testen)
export const DETAIL_PARENT = {
  'task': 'taken', 'expense': 'kosten', 'recurring-expense': 'kosten',
  'kosten-inzichten': 'kosten', 'plant': 'planten', 'purchase': 'boodschappen',
  'product': 'boodschappen', 'catalog': 'boodschappen', 'recipe': 'maaltijden',
  'resource': 'delen', 'herinneringen': 'huishouden', 'beeldstijl': 'huishouden',
};
export const backLabelFor = (routeKey, getModule) => getModule(DETAIL_PARENT[routeKey])?.label ?? null;
```
Gebruik `getModule` uit `lib/modules.js` zodat labels één bron houden ("Taken", "Kosten", …).
Per detailscherm geef je `backLabel={backLabelFor('<routeKey>', getModule)}` aan `ModalHeader`.
Voor schermen die vanaf méér plekken open kunnen (bv. `task/new` vanuit Vandaag óf Agenda):
laat een optionele **`from`-param** (`useLocalSearchParams`) de map overschrijven, anders val
terug op de statische parent.

### Reikwijdte
~12–18 detailroutes onder `app/` (de modal-stack uit `app/_layout.js`). Eén prop per scherm;
geen herstructurering. i18n: `common.backTo` = "Terug naar {label}" voor de `accessibilityLabel`
(zichtbaar label = alleen de naam).

## Edge cases & beslissingen
- **Foutmeldingen: dialoog vs. toast.** Default: blokkerende/handelings-fouten → `dialog.alert`;
  vluchtige fouten → bestaande `toast`. Beslis per call-site; documenteer de keuze kort.
- **Web.** `BottomSheet`/`Modal` werken op web; de nieuwe dialoog vervangt de `window.confirm`-
  tak van `confirmDiscard` → consistent gedrag op alle platforms.
- **Niet-component-call-sites** (`db.js`, `photoPicker.js`): geen hooks; dialoog/toast via
  parameter of laat de UI de fout tonen.
- **Toegankelijkheid**: dialoog krijgt `accessibilityViewIsModal`, focus op de primaire knop,
  knoppen ≥48dp; ‹-lintje met `accessibilityRole="button"` + `common.backTo`-label.

## Acceptatiecriteria
- Geen native `Alert.alert` meer in `app/`/`lib/` (op evt. bewust gelaten randgeval na);
  verwijderen/verlaten, discard-guard en het foto-menu lopen via `useDialog`, thema-/dark-mode-bewust.
- Detailschermen tonen een ‹ Herkomst-lintje; tikken keert terug naar de juiste plek (sluit aan
  op UX-12). `backLabelFor` heeft units.
- `npm test` groen (incl. `tests/navMeta.test.js`). `npx eslint .` 0 errors.

## File-checklist
**Nieuw:** `lib/dialog.js` (`DialogProvider` + `useDialog`) · `lib/navMeta.js` +
`tests/navMeta.test.js`.
**Gewijzigd:** `app/_layout.js` (provider mounten) · `lib/ui.js` (`ModalHeader` `backLabel`-prop;
`confirmDiscard`/`Editor` op `useDialog`) · de ~21 `Alert`-call-sites · de ~12-18 detailschermen
(`backLabel`-prop) · `lib/i18n.js` (`dialog.ok`, `common.backTo`) · `huishoek-backlog.md`
(UX-6/UX-10 status).

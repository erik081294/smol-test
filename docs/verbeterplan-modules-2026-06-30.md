# Verbeterplan — Voertuigen, Bonnen & Catalogus/producteditor (2026-06-30)

> **Bron.** Device-rooktest ronde 2 (moto g72, dev-client, `main`) + twee onafhankelijke subagent-reviews:
> [`ux-review-modules-2026-06-30.md`](ux-review-modules-2026-06-30.md) (UX/interactie) en
> [`visual-design-review-2026-06-30.md`](visual-design-review-2026-06-30.md) (puur visueel).
>
> **Waarheidsgetrouw.** Elke bevinding is na de review **tegen de broncode gelegd** (de agents werkten op
> statische screenshots). De kolom **Verificatie** zegt wat de code daadwerkelijk doet — een paar
> agent-aannames bleken onjuist en zijn als **non-issue** gemarkeerd. Niets in dit plan berust op een
> aanname over de werking.

## A. Al gefixt deze sessie (geverifieerd + DoD groen)

| Bevinding | Bron | Verificatie (code) | Fix |
|---|---|---|---|
| **"1 producten"** — meervoudsfout bij telwoord 1 | UX #3 | `purchases.js:35` gebruikte `t('purchases.items')` = één string `'{n} producten'` | Meervoud-paar `purchases.items.one/other` + `plural()` → "1 product" / "2 producten" |
| **Bon-leesdetail-kop "Annuleer"** i.p.v. "Sluiten" | UX #7 | `purchase/[id].js:179` gaf `onConfirm` zonder `cancelLabel` → `ModalHeader`-default "Annuleer". Recept-leesdetail heeft géén onConfirm-kop → de bon was de uitzondering | `cancelLabel={t('common.close')}` → "Sluiten · APpie · Bewerken" |
| **Bon-regel herhaalt de productnaam** (titel + meta) | Visual #10 | `purchase/[id].js:190` toonde altijd `· {productnaam}`, ook als die == regelnaam | Toon `· productnaam` alleen als die ≠ de regelnaam |

`typecheck` + `eslint` (0 errors) + `npm test` **805 pass / 0 fail** groen.

## B. Beslissingen nodig (geverifieerd waar, maar woord-/ontwerpkeuze — niet unilateraal gewijzigd)

| # | Bevinding | Verificatie (code) | Aanbeveling | Moeite |
|---|---|---|---|---|
| B1 | **"Opslaan" vs "Bewaar"** in de editor-kop | **Bréder dan gedacht:** 5 schermen (vehicle/recipe/voorraad/resource/recurring-expense) geven expliciet `confirmLabel={t('common.save')}`="Opslaan"; de rest valt terug op de `ModalHeader`-default **"Bewaar"** (= de DESIGN.md-conventie "Annuleer · titel · Bewaar"). Reëel inconsistent | Eén woord app-breed kiezen. **Voorkeur: "Bewaar"** (DESIGN.md-default) → de 5 overrides verwijderen. Of: "Opslaan" omarmen → DESIGN.md + default bijwerken | S |
| B2 | **"Splitsen met het huishouden" is een gevulde ocher knop** op het bon-leesdetail | Geverifieerd: `purchase/[id].js:198` `variant="accent"` (ocher); "Naar voorraad" = `variant="soft"`. DESIGN.md: ocher = FAB/accent/highlights, forest = primaire knop | Of forest (als dit de primaire actie is), of beide neutraal — eerst beslissen **welke** bon-actie primair is (splitsen vs. naar voorraad). Spiegelt de schoonmaak-footer-fix (UXR-10 #4) | S |
| B3 | **"Delen met" vs "Delen via Samen"** — twee deel-concepten met bijna gelijke labels boven elkaar | Geverifieerd zichtbaar (`v02`): een zichtbaarheids-rij + een Samen-toggle. Beide beginnen met "Delen" | Hernoem de Samen-toggle naar iets dat niet met "Delen" begint (bv. "Reserveerbaar via Samen") | S |

## C. Groter werk (geverifieerd echte gaps — eigen taak/rij)

| # | Bevinding | Verificatie (code) | Aanbeveling | Moeite |
|---|---|---|---|---|
| C1 | **Voertuig opent direct de editor, geen lees-detail** | **Waar (geverifieerd):** `app/(tabs)/voertuigen.js:67` → `/vehicle/[id]` = `VehicleEditor` met `ModalHeader onConfirm` (Annuleer · titel · Opslaan). Plant/huisdier/recept/bon hebben een **lees-detail** (`ModalHeader` zónder onConfirm) + aparte editor. Voertuigen breekt het DESIGN.md-detail/editor-contract | Een lees-detail-laag voor voertuig toevoegen (rijke read-only kosten/historie) met "Aanpassen" → editor. Grootste item | L |
| C2 | **Catalogus-rij heeft twee tikdoelen** (naam → producteditor, stepper → aantal) zonder affordance | **Waar (geverifieerd):** `app/catalog.js:41` `Pressable onPress={onEdit}` (→ `/product/edit`) om naam/emoji, `app/catalog.js:50` aparte `Stepper`. Geen chevron/affordance op de naam | Affordance op het naam-deel (subtiele chevron/▸), of de editor via een expliciet potlood/lang-indrukken. Raakt BOO-13-vindbaarheid | M |
| C3 | **Voertuig-editor mist `SectionHeader`-groepering** (lang/dicht) | Zichtbaar (`v02`/`v03`); herhaling van de 2026-06-26-bevinding §1.17 | Sectiekoppen (Wat · Delen · Kosten · Historie) — combineert goed met C1 | M |
| C4 | **Schap-grid (18 tegels) altijd volledig uitgeklapt** in de producteditor | Zichtbaar (`c01`); duwt standaard-eenheid/emoji-picker ver omlaag | `Collapsible` met de huidige keuze als samenvatting (spiegelt het VisibilityPicker-patroon) | M |
| C5 | **Kosten-kaart: kop-bedrag en detailregels lopen visueel in elkaar** | Zichtbaar (`v03`); geen typografische trap/divider | Divider of meer ruimte tussen "€/maand" en de uitsplitsing | S |
| C6 | **"Foto toevoegen" heeft twee vormen** (brede knop `v05` vs. vierkante tegel `c01`) | Zichtbaar; twee componenten voor dezelfde affordance | Eén gedeelde foto-affordance-component | S |

## D. Non-issues (agent-aanname onjuist — code-geverifieerd, géén actie)

| Bevinding (agent) | Werkelijkheid in de code |
|---|---|
| Stepper "−" niet duidelijk gedimd op 0 (UX #10) | `lib/ui.js` `Stepper`: `btn('Minder', dec, local <= min, …)` met `opacity: disabled ? 0.35 : 1` → de `−` **is** disabled + gedimd op `min`. Geen actie |
| Bon read/edit-splitsing mogelijk niet correct (UX-vraag) | `purchase/[id].js:173` toont read-only bij `!editing` met "Bewerken" → editor. **Correct**, volgt recepten-patroon |
| Datum-format verschilt per bon-scherm (UX #12) | Lijst (`d MMM yyyy`) / detail (`d MMMM yyyy`) / editor (`EEEE d MMMM`) — bewust per niveau; laag/optioneel |

## E. Nog niet device-getest (toestel halverwege losgekoppeld) — blijven open in §6

`UX-22` (sheets nooit onder het toetsenbord + 3 sluit-routes), `UX-42` (header-drawer-acties),
`FND-5` (huishouden wisselen — vereist 2e huishouden), `HUI-2` (eigen diersoort — vereist een huisdier),
en de **BOO-13-rest** (producteditor opslaan + foto-upload/signed-URL + "even aankleden?"-prompt; ingang
en render zijn wél device-bevestigd).

## Device-bevestigd deze ronde (→ status §6)

- **VTG-1..4** — voertuig-lijst + editor/detail (RDW-verrijking, kosten-uitsplitsing + historie, "Delen via
  Samen" + prijs/km, onderhoud-log-formulier) renderen en accepteren invoer. De log-**write** is bewezen
  door de bestaande historie-entry (een verse write lukte niet via adb door injectie-flakiness — geen
  app-bug). → device-rooktest voldaan.
- **BOO-10** — bonnenlijst → bon-leesdetail → bon-editor renderen volledig (regels/koppeling/eenheden/
  bontotaal). → device-rooktest voldaan (alleen de opslaan-write niet uitgevoerd om de live bon niet te
  muteren; de editor is gewired op `update_purchase`).
- **BOO-13** — ingang (Catalogus → tik op product → producteditor) + render (foto/naam/schap-grid)
  device-bevestigd; opslaan/foto-upload/prompt + de onderkant niet bereikt (toestel weg).
</content>

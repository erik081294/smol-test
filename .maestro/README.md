# Maestro E2E-flows (INF-3)

End-to-end-rooktests voor de kritieke flows, bovenop de pure units (`tests/`). Black-box
via de accessibility-/testID-laag — gekozen boven Detox om de lichte YAML-opzet (zie plan 08 fase D).

Draai ze niet los, maar via de **error-bewuste runner** `npm run rooktest` (start ook
logcat-capture en geeft één pass/fail-oordeel). Volledige procedure: [`../docs/rooktest.md`](../docs/rooktest.md).

## Vereisten
- [Maestro](https://maestro.dev) geïnstalleerd (`curl -fsSL https://get.maestro.mobile.dev | bash`).
- Een **development build** op een toestel/emulator (zie [`../docs/eas-setup.md`](../docs/eas-setup.md)),
  of de app draaiend via `npm run device`.
- Een **ingelogd test-huishouden** (de flows starten op de tabbalk; ze dekken niet
  de auth-/onboarding-flow — die vereist een wegwerp-account en e-mailbevestiging).

## Draaien
```sh
npm run rooktest                        # alle flows + logcat-oordeel (aanbevolen)
maestro test .maestro/                  # alleen de flows, kaal
maestro test .maestro/01-taak.yaml      # één flow
maestro studio                          # interactief selectors kalibreren
```

## Selectors — id boven tekst
Waar een flow een control aantíkt gebruiken we een **`id:`** (`t-…`), niet de NL-tekst,
zodat een copy-wijziging de flow niet breekt (dit beet ons: "Opslaan" vs "Bewaar" voor
dezelfde save-knop, en "Nieuwe taak" → "Nieuwe afspraak"). De id's zitten op de gedeelde
componenten in [`../lib/ui.js`](../lib/ui.js) en de tabs in
[`../app/(tabs)/_layout.js`](../app/(tabs)/_layout.js):

| id | element |
|----|---------|
| `t-tab-<key>` | tab-knop (key uit `lib/modules.js`, bv. `t-tab-taken`) |
| `t-save` / `t-cancel` | de bevestig-/annuleer-knop van élke editor (`ModalHeader`) |
| `t-fab-task` / `t-fab-expense` / `t-fab-vehicle` | "toevoegen"-FAB per module |
| `t-field-title` / `t-field-amount` / `t-field-description` | editor-velden |
| `t-grocery-add` | het boodschap-invoerveld |
| `t-assistant-input` / `t-assistant-send` / `t-assistant-stop` | assistent-composer ([`../lib/AssistantChat.js`](../lib/AssistantChat.js)) |
| `t-assistant-confirm` / `t-assistant-reject` | Doen/Niet doen op de HITL-bevestigingskaart ([`../lib/AssistantMessageView.js`](../lib/AssistantMessageView.js)) |
| `t-error-boundary` | de error-boundary-fallback (voor `assertNotVisible`) |

`assertVisible` op zichtbare **inhoud** (bv. "E2E rooktest taak") blijft op tekst — dat is
juist wat we verifiëren. Voor een assert direct ná een DB-mutatie gebruiken we
`extendedWaitUntil` met een ruime `timeout` (de lijst herlaadt async; `assertVisible` slikt
in Maestro 2.6.1 geen `timeout`). Elke flow eindigt met `assertNotVisible: id=t-error-boundary`.

## De crash-sweep zit in de runner, niet hier
"Boot elk scherm en check op crashes" doet [`../scripts/rooktest.sh`](../scripts/rooktest.sh)
via **deeplinks** (`huishoek://<route>`) + een `uiautomator`-check op `t-error-boundary` —
razendsnel en zonder door "Meer" te tikken. Zie [`../docs/rooktest.md`](../docs/rooktest.md).

## Flows (behavior)
- `01-taak.yaml` — taak toevoegen → terug in de lijst → afvinken (verdwijnt uit de open lijst).
- `02-uitgave.yaml` — uitgave toevoegen (via "Meer" → Kosten), gelijk gesplitst → terug in het overzicht.
- `03-boodschap-undo.yaml` — boodschap toevoegen → verwijderen (veeg links) → **ongedaan maken** (STR-9).
- `04-swipe.yaml` — veeg links = verwijderen op een taak (bewijst de gesture via de "verwijderd"-toast).
- `05-editor-guard.yaml` — het formulier-fundament (ARCH-5): leeg opslaan → inline fout; iets invullen →
  sluiten vraagt om bevestiging (de **discard-guard**, nieuw); "Blijven" behoudt de invoer, "Sluiten zonder
  opslaan" gooit weg → geen rij aangemaakt (self-cleanend). Verifieert het nieuwe full-mode-gedrag.
- `06-assistent.yaml` — assistent-schrijfpad (AI-20): schrijf-verzoek → HITL-bevestigingskaart →
  "Doen" → vervolg-beurt (AI-18). Enige flow met een échte LLM-beurt → ruime timeouts.
  **Nog niet op toestel geverifieerd** (vergt device + ingelogd huishouden + edge/Orq live) — open stap.

Flows 01–05 op toestel geverifieerd (moto g72, groen via `npm run rooktest`). De `E2E…`-rijen
die ze aanmaken worden door de runner op DB-niveau opgeruimd (`scripts/rooktest-cleanup.mjs`) — geen
UI-delete in de flows, want de app verwijdert undo-toast-gestuurd (timer) en dat vuurt na een
editor-`router.back()` niet betrouwbaar af.

## Timing-valkuilen (op toestel geleerd)
- **Undo-toast is vluchtig:** tik "Ongedaan maken" DIRECT na de veeg, zonder tussenliggende
  assert (die kost een trage UI-dump → toast al weg). De racy undo-tik is daarom uit 04 gehaald.
- **Dagweergave verbergt** afgevinkte/uitgestelde taken → assert enkel op wat zichtbaar blijft.
- Nieuwe/gewijzigde flow? Loop 'm de eerste keer met `maestro studio` na.

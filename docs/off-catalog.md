# Productcatalogus uit Open Food Facts — runbook

Hoe de globale productcatalogus (`catalog_products`, migr. 0014/0015) gevuld en
vers gehouden wordt. Operator-handleiding; de status leeft in `huishoek-backlog.md`.

## Beslissing: data-dump, niet de API
Open Food Facts (OFF) raadt voor meer dan een paar honderd producten **expliciet de
data-dump aan** i.p.v. de API:
- > "If you need to fetch more than a few hundred products, we ask you to download the data as a CSV or JSONL file directly." (`openfoodfacts.github.io/openfoodfacts-server/api/`)
- De API is rate-limited (**15 req/min/IP** product-reads, **10 req/min/IP** search) en bedoeld voor **losse** lookups.

Daarom:
- **Bulk-vullen** = de **JSONL-dump** (`scripts/import-off-dump.mjs`). Vervangt de oude API-bulk-import.
- **Losse lookup** = de live API, en alleen voor één net-gescande barcode (`lib/openFoodFacts.fetchOffProduct`, BOO-9). Dat is precies waar de API voor is, en per gebruiker ruim binnen de limiet.

## Importeren
```bash
# node staat off-PATH; zie de project-memory
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"

# 1. Dump ophalen (~7 GB gz). Eén keer downloaden, daarna lokaal hergebruiken.
curl -L -o /tmp/off.jsonl.gz https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz

# 2. Proefdraai (filtert + telt, schrijft niets):
DRY_RUN=1 OFF_DUMP=/tmp/off.jsonl.gz node scripts/import-off-dump.mjs

# 3. Echte import (vereist SUPABASE_SERVICE_ROLE_KEY + EXPO_PUBLIC_SUPABASE_URL in .env):
OFF_DUMP=/tmp/off.jsonl.gz node scripts/import-off-dump.mjs
```
Het script **streamt** de dump regel-voor-regel (nooit ~43 GB in geheugen), filtert naar
de NL-subset + kwaliteit, en **upsert per `code`** (idempotent → herdraaien verfrist).
Opties: `LIMIT` (max rijen, testrun), `BATCH` (upsert-grootte), `MIN_COMPLETENESS`
(OFF completeness-drempel 0..1.1, default 0).

## Opschonen (de filter, puur + unit-getest in `lib/offCatalog.js`)
Een record wordt **bewaard** als: geldige EAN (`code` 8/12/13/14 cijfers) · NL-subset
(`countries_tags` bevat `en:netherlands`) · géén `data_quality_errors_tags` · een naam
(coalesce `product_name_nl → product_name → _en → _fr → generic_name`). Daarna:
categorie via `lib/offCategoryMap` (dezelfde mapping als de live scan), naam
genormaliseerd voor zoeken (`lib/productMatch.normalize`), `popularity` uit `unique_scans_n`.
Foto's worden **gehotlinkt** naar de OFF-CDN (`image_small_url`) — niets in Storage.

## Vers houden
- **Dagelijkse delta's:** `static.openfoodfacts.org/data/delta/index.txt` (14 dagen bewaard,
  JSONL-gz). Toe te passen met dezelfde transform.
- **Belangrijk:** delta's bevatten **geen verwijderingen** → herimporteer periodiek (≤14
  dagen) de volle dump om verwijderde producten op te schonen.
- De volle dump wordt nachtelijk geregenereerd.

## Past in het free tier
~27k NL-rijen ≈ **~23 MB** (886 byte/rij × indexen) op een DB die nu 17 MB is → ~7% van de
500 MB free-limiet. De dump zélf staat niet in Supabase; alleen de gefilterde subset.
(De volledige globale catalogus ~3 mln zou ~2,7 GB zijn → past níét; daarom de NL-subset.)

## Licentie — verplichtingen
- **Data:** ODbL v1.0. **Foto's:** CC-BY-SA (3.0). Beide vereisen **attributie**: de
  catalogus-UI toont "Productdata & foto's: Open Food Facts (ODbL · CC-BY-SA)" met een link
  naar `world.openfoodfacts.org` (`app/catalog.js` + i18n `catalog.attribution`).
- **Share-alike (let op):** ODbL §4.4/4.6 — wie een **publieke app** op een afgeleide
  (opgeschoonde) OFF-database draait, moet die afgeleide database **onder ODbL aanbieden**
  (machine-leesbare kopie aan ontvangers). Puur intern gebruik is vrijgesteld. → **Laat dit
  vóór een publieke launch juridisch toetsen**; het bepaalt of de gecleande DB "van onszelf"
  mag blijven of onder ODbL beschikbaar moet zijn.

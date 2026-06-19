# Bonscan via Orq.ai (BOO-7) — setup

De "Scan bon"-knop in de bon-editor stuurt een foto naar de Supabase Edge Function
[`supabase/functions/scan-receipt`](../supabase/functions/scan-receipt/index.ts), die de foto
via de **Orq.ai AI Gateway** door een multimodaal model laat uitlezen tot gestructureerde
JSON (winkel, datum, regels met prijzen in hele centen). De app vult daarmee de bewerkbare
bon-editor; de gebruiker controleert/corrigeert vóór opslaan (het vangnet — een LLM kan een
prijs mislezen).

**Waarom via een edge function + router:** de `ORQ_API_KEY` blijft server-side (nooit in de
app-bundle), en het model is in het Orq-dashboard te wisselen zonder de functie opnieuw te
deployen. De functie staat achter `verify_jwt` → alleen ingelogde gebruikers kunnen 'm aanroepen.

## Eenmalige setup

### 1. Orq.ai-deployment aanmaken
Maak in je Orq-dashboard een **Deployment** met key **`receipt-extractor`** (of kies een eigen
key en zet die als `ORQ_DEPLOYMENT_KEY`-secret). Configureer:
- **Model:** een vision-capabel model (bv. een Claude- of GPT-vision-model). De router kan dit
  later wisselen.
- **System prompt:** mag leeg — de edge function stuurt de extractie-instructie mee. Wil je 'm
  in Orq beheren, gebruik dezelfde strekking als de `INSTRUCTION` in de functie: lees de bon uit
  en geef **uitsluitend** JSON terug in de vorm
  `{"store": string|null, "purchased_on": "YYYY-MM-DD"|null, "items": [{"name", "quantity", "unit", "unit_price_cents", "line_total_cents"}]}`
  (bedragen in hele centen; statiegeld/kortingen/subtotalen/eindtotaal niet als item).
- **Output:** JSON / "response format: json" indien het model dat ondersteunt (de functie parset
  ook een `json … `-codeblok defensief, dus strikt verplicht is het niet).

### 2. Secrets zetten (Supabase)
```sh
supabase secrets set ORQ_API_KEY=<jouw-orq-api-key>
# optioneel als je een andere deployment-key koos:
supabase secrets set ORQ_DEPLOYMENT_KEY=receipt-extractor
```

### 3. Functie deployen
```sh
supabase functions deploy scan-receipt
```
(De functie staat al gekoppeld aan het project; `verify_jwt` is geconfigureerd in
[`supabase/config.toml`](../supabase/config.toml).)

## Testen
1. Log in de app in, ga naar **Boodschappen → bon-icoon → "Scan bon"**.
2. Kies/maak een foto van een kassabon → de winkel, datum en regels verschijnen ingevuld.
3. Controleer de prijzen, koppel waar gewenst regels aan de catalogus, en sla op.

Lokaal de functie draaien (optioneel): `supabase functions serve scan-receipt --env-file .env`
met `ORQ_API_KEY`/`ORQ_DEPLOYMENT_KEY` in `.env`.

## Kosten & privacy
- Elke scan is één multimodale LLM-aanroep (afgerekend via je Orq-account). Houd dat in de
  gaten bij veel gebruik; de matching/prijstracker zelf is gratis (regelgebaseerd).
- De bon-foto wordt naar Orq.ai (en het achterliggende model) gestuurd voor extractie. Een bon
  bevat doorgaans geen PII buiten de aankoopdata; de foto wordt niet opgeslagen door de functie.

## Buiten scope / later
- Per-keten parsers (BOO-6) als goedkoper/sneller alternatief vóór de LLM-stap.
- Bon-foto bewaren als naslag (bucket `receipts`, migratie 0014) — los van de extractie.

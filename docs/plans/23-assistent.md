# Plan 23 — Huishoek Assistent (AI-1): fase 0 design-verkenning

> Status: fase 0b (design vóór code). Architectuur en fasering: zie het goedgekeurde
> sessieplan (samengevat onderaan) en backlog §6 AI-1. Techniek in het kort:
> agent-loop server-side in een Supabase Edge Function, Orq als gateway
> (deployment `huishoek_assistant`), tools = RLS-gescopete queries + bestaande pure
> `lib/*.js`-functies, writes altijd via propose→confirm→execute (HITL).

## 1. Persona & toon

De assistent is een **behulpzame huisgenoot**, geen callcenter en geen orakel.

- **Naam in de UI:** gewoon "Assistent" (module-label). Geen verzonnen voornaam —
  het is een functie van het huis, geen personage.
- **Toon:** warm en kort, conform DESIGN.md §3/§6. "Ik heb even in de agenda
  gekeken: morgen staan er 3 taken voor jou." Nooit corporate ("Uw verzoek is
  verwerkt"), nooit joviaal-overdreven.
- **Eerlijk over grenzen:** bij twijfel of ontbrekende data zegt hij dat ("Ik zie
  geen kosten in juni — misschien zijn ze nog niet ingevoerd?") in plaats van te
  gokken. Weiger-gedrag (buiten-scope vragen) vriendelijk en kort, met een hint
  wat wél kan.
- **Privacybewust:** antwoordt alleen met wat de *vragende* gebruiker mag zien
  (RLS + `visibility`); gesprekken zijn privé per gebruiker.

## 2. De vijf kernflows

1. **Vraag stellen.** Invoerveld onderaan (inverted chatlijst erboven), plus 3–4
   suggestie-chips bij een leeg gesprek ("Wat staat er vandaag op de planning?",
   "Wiens beurt is het?", "Wat is er bijna op?"). Eén primaire actie: versturen.
2. **Streamend antwoord met kaart.** Tekst streamt in; zodra een tool draait
   verschijnt een rustige statusregel ("even in de agenda kijken…"). Tool-output
   rendert als kaart uit de vaste catalog (`text`, `card`, later `list`/`keyvalue`/
   `link`), in dezelfde visuele taal als de module waar de data vandaan komt
   (emoji + label, nooit kleur alleen).
3. **Actie voorstellen → bevestigen (fase 3).** De bevestigingskaart is hét
   vertrouwensmoment — zie §4.
4. **Fout / limiet.** Rate-limit bereikt, offline, of de gateway hapert: gewone
   taal, wat je kunt doen, nooit een technische code als hoofdboodschap
   (DESIGN.md §7). De invoer blijft staan; opnieuw versturen kan altijd.
5. **Lege staat.** Eigen illustratie via `lib/illustrations.js` (vaste stage,
   platte geometrie) + één zin die uitnodigt + de suggestie-chips. Geen lege
   witte vlakte.

## 3. UI-states (allemaal ontworpen, met copy in `lib/i18n.js` vóór bouw)

| State | Gedrag | Copy-richting |
|---|---|---|
| Leeg gesprek | Illustratie + chips | "Vraag me iets over jullie huishouden." |
| Versturen/typing | Typing-indicator (3 dots, respecteert verminder-beweging) | — |
| Tool bezig | Statusregel per tool | "Even in de agenda kijken…" / "Boodschappenlijst erbij pakken…" |
| Streamend antwoord | Tekst groeit; kaarten verschijnen af | — |
| Rate-limit | Vriendelijke melding + wanneer het weer kan | "Je hebt de assistent even veel gevraagd — over een uurtje kan het weer." |
| Offline | Melding + invoer bewaard | "Geen verbinding. Je vraag staat klaar voor als je weer online bent." |
| Fout gateway | Melding + opnieuw-knop | "Dat lukte even niet. Probeer het nog eens." |
| Actie pending | Bevestigingskaart (§4) | — |
| Actie uitgevoerd | Kaart wordt ✓-samenvatting + toast met **Ongedaan maken** | "Toegevoegd aan de boodschappenlijst." |
| Actie geweigerd | Kaart dimt, "Niet gedaan." | — |
| Actie verlopen (TTL) | Kaart dimt | "Dit voorstel is verlopen — vraag het gerust opnieuw." |

## 4. De bevestigingskaart (fase 3, ontwerp nu al vastleggen)

- Toont in mensentaal **wat** er gebeurt ("Taak *Stofzuigen* aanmaken, voor
  Erik, vrijdag"), **waar** (module-emoji + label) en **wie het ziet**
  (zichtbaarheid, conform `lib/visibility.js`-labels).
- Twee even grote knoppen: **Doen** (gevuld) en **Niet doen** (ghost) — weigeren
  is even makkelijk als bevestigen. Touch-targets ≥ 48dp.
- Nooit meerdere pending-acties stapelen zonder overzicht; één kaart per voorstel.
- Na uitvoeren: toast met undo (`lib/toast.js`) — vergevingsgezind tot het eind.

## 5. Plaatsing & instappunten

- **Module-entry:** descriptor in `lib/modules.js`, start niet-primair (bereikbaar
  via "Meer"), plus een **Vandaag-widget** ("Vraag de assistent") in
  `lib/widgets/registry.js`. Promotie naar primaire tab pas na gebleken gebruik.
- **Contextuele instappunten (fase 2):** per module een "Vraag de assistent"-actie
  met voorgevulde prompt via deep-link `huishoek://assistent?prompt=…`
  (bv. vanuit Inzichten: "Leg deze maand uit"). Zo is de assistent onderdeel van
  de flows, geen chatbot in een hoekje.
- **Waar níet:** geen zwevende assistent-knop over alle schermen, geen ongevraagde
  pop-ups. Proactieve signalen (fase 5) lopen via tijdlijn/notificaties met opt-in.

## 6. Prompt-/gedragsontwerp (leeft in Orq, niet in de app)

Systemprompt, toon en weiger-gedrag staan geversioneerd in de Orq-deployment
`huishoek_assistant` (variabelen: ledennamen, ingeschakelde modules, datum).
Een golden-set van ~20 NL-vragen met verwachte tool-keuze én toon draait als
Orq-eval bij elke promptwijziging. Beheer via de Orq MCP-server.

## 7. Verificatie van het design

Per bouwfase: screenshots op het moto-toestel in licht én donker (let op de
Fabric-stijlcache-valkuil) naast `npm run rooktest`; design-akkoord vóór de
volgende fase start.

---

### Faseringsoverzicht (referentie)

0a Orq-toegang (key in `.env` + MCP) · 0b dit document · 0c spike Orq
tool-calling+SSE · 1 read-only chat mét streaming + evals · 2 gen-UI volledig +
instappunten · 3 write-acties met HITL · 4 geheugen (pgvector) · 5 proactieve
digest · 5b Huisregels (NL-automations, LLM at compile-time) · 6 opschalen
(specialisten/web/A2UI) — details in het sessieplan en backlog §6.

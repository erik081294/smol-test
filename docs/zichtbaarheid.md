# Het zichtbaarheidscontract

Elke datamodule in Huishoek — Taken, Boodschappen, Kosten, Planten, Huisdieren,
Voertuigen, de Tijdlijn — deelt één en hetzelfde model voor **wie wat mag zien**.
Eén item hoort bij een huishouden en kan op drie manieren gedeeld zijn. Dit
document beschrijft dat contract: de vorm in de database, de server-afdwinging via
RLS, en de spiegeling in de client. Wie een nieuwe module bouwt, hoeft alleen de
vijf kolommen toe te voegen en één functie aan te roepen — de rest erft mee.

> **Eén bron van waarheid.** De server (RLS) is de autoriteit; de client spiegelt
> diezelfde regels alleen om lokaal te kunnen filteren en nette meldingen te geven.
> Wijkt de client af, dan is de client fout — nooit andersom.

---

## De drie zichtbaarheidsmodi

| Modus | Wie ziet het | Extra kolom |
|-------|--------------|-------------|
| `household` (default) | iedereen in het huishouden | — |
| `subgroup` | de leden van één gekoppelde subgroep **+ de maker** | `share_subgroup_id` |
| `custom` | een handmatige lijst personen **+ de maker** | `share_with` (uuid[]) |

De **maker ziet z'n eigen item altijd**, ongeacht de modus — anders zou je een
`custom`-item kunnen maken dat je daarna zelf niet meer ziet.

---

## De vijf kolommen

Elke module-tabel draagt dezelfde vijf velden (zie `tasks`/`groceries` in
`0001_init.sql` als blauwdruk):

```sql
household_id       uuid not null references households(id) on delete cascade,
visibility         text not null default 'household'
                     check (visibility in ('household','subgroup','custom')),
share_subgroup_id  uuid references subgroups(id) on delete set null,
share_with         uuid[],                 -- profielen bij visibility = 'custom'
<creator_col>      uuid …                  -- 'created_by', 'added_by', 'author_id' …
```

De naam van de maker-kolom verschilt per module (historisch: `created_by`,
`added_by`, `author_id`). Daarom geef je 'm expliciet mee bij het aanzetten van RLS.

### Consistentie-CHECK

Naast RLS dwingt een CHECK af dat `share_subgroup_id` past bij de modus, zodat een
losse subgroep nooit aan een `household`-item blijft plakken:

```sql
alter table public.<tabel> add constraint <tabel>_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);
```

---

## Server: `enable_module_rls` en `can_view`

Het hele contract zet je met **één aanroep** aan (`0003_module_framework.sql`):

```sql
select public.enable_module_rls('mijn_tabel', 'created_by');
```

Dat doet vijf dingen:

1. **RLS aan** op de tabel.
2. **Vier policies** — `select`/`update`/`delete` via `can_view`, en `insert` via
   alleen `is_member`. Insert checkt **bewust niet** `can_view`: anders kun je nooit
   een item aanmaken dat je daarna zelf nog mag zien.
3. **Integriteitstrigger** `check_subgroup_household` — een `share_subgroup_id` moet
   bij het huishouden van het item horen (anders kun je delen met een subgroep uit
   een vréémd huishouden, want `in_subgroup` kijkt niet naar het huishouden).
4. **Realtime** — de tabel wordt aan de `supabase_realtime`-publicatie toegevoegd.
5. Oude policy-namen worden eerst opgeruimd (idempotent — veilig her-aanroepbaar).

De kern is `public.can_view` — de enige plek waar het zien-recht leeft:

```sql
public.is_member(hh) and (
  coalesce(visibility, 'household') = 'household'    -- iedereen in het huishouden
  or creator = auth.uid()                            -- de maker altijd
  or (visibility = 'subgroup' and public.in_subgroup(sg))
  or (visibility = 'custom'   and auth.uid() = any(share_with))
)
```

### Kind-tabellen (foto's e.d.)

Een subtabel zoals `timeline_photos` of `plant_photos` draagt **geen** eigen
zichtbaarheid: 'ie erft die van z'n ouder-rij. Twee punten:

- **Lezen** scopet via de ouder: de RLS-policy checkt `can_view` op de bijbehorende
  post/plant (of simpelweg `is_member` als de ouder al gescoped is).
- **`household_id` óók op de kind-tabel** — niet voor RLS maar voor **realtime**:
  een gefilterde subscription (`household_id=eq.…`) heeft dat veld nodig op de rij
  die wijzigt. Zonder dat veld zou je de hele tabel moeten volgen.

> **Realtime-valkuil.** Een `DELETE`-event draagt onder de standaard *replica
> identity* alléén de primaire sleutel — **niet** `household_id`. Een op
> `household_id` gefilterde subscription mist dus deletes. Vang dat op met een
> `useFocusEffect`-herlaad of optimistisch verwijderen (zie `pendingDeletes`),
> niet door op het realtime-DELETE te leunen.

---

## Client: pure helpers + picker

De client herhaalt het contract in pure, los te testen helpers (`lib/visibility.js`,
unit-getest, géén React/Supabase) en één gedeelde UI-component.

| Stuk | Doet |
|------|------|
| `visibilityPayload({ visibility, shareSubgroupId, shareWith })` | bouwt de drie kolommen en **gooit de irrelevante velden weg** (een `household`-item houdt nooit een verdwaalde subgroep/share) |
| `validateVisibility({ … })` | NL-melding vóór opslaan (`subgroup` → groep verplicht, `custom` → minstens één persoon), of `null` als het klopt |
| `canView(viewer, item, { householdMemberIds, subgroupMemberIds })` | 1-op-1 spiegel van de SQL `can_view`, zodat de UI lokaal kan filteren zonder serverronde |
| `VisibilityPicker` (`lib/ui`/`lib/VisibilityPicker`) | de keuze-UI; `collapsible` klapt 'm onderaan een editor in en opent vanzelf als de keuze afwijkt van "Hele huishouden" |

In de editor-flow staat "Delen met" bewust als stap 5 — geavanceerd, ingeklapt,
onder de hoofdvelden (zie de sectie "Editor-flow" in [DESIGN.md](../DESIGN.md)).

---

## Een nieuwe module toevoegen — checklist

1. Geef de tabel de **vijf kolommen** (+ `visibility`-CHECK en de consistentie-CHECK).
2. Geef kind-tabellen (foto's) een **`household_id`** voor gescopete realtime.
3. Roep **`select public.enable_module_rls('<tabel>', '<creator_col>');`** aan.
4. Sla op via **`visibilityPayload(...)`**; valideer met **`validateVisibility(...)`**.
5. Toon de **`VisibilityPicker collapsible`** in de editor.
6. Filter lokaal met **`canView(...)`** waar je client-side wilt voorsorteren.
7. Reken **niet** op realtime-DELETE voor opruimen — `useFocusEffect`/`pendingDeletes`.

De Tijdlijn (`0054_tijdlijn.sql`, `lib/useTimeline.js`) is het verste voorbeeld:
posts + een `timeline_photos`-kind-tabel + privébucket, alles via dit ene contract.

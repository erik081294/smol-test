import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { format } from 'date-fns';
import { colors, type, space, radius, categoryMeta } from './theme';
import { Card, SectionHeader, AvatarSelect, Chip, IconButton, Empty } from './ui';
import { Icon } from './icons';
import { dateLocale, t, plural } from './i18n';
import { useTaskCompletions } from './useTaskCompletions';
import { countsByDay, yearGrid, yearSummary } from './yearHeatmap';
import { YearHeatmap } from './YearHeatmapView';

// Jaar-scope van het Taken-scherm (TKN-2): een activiteit-heatmap van voltooiingen
// over een kalenderjaar + een korte jaarsamenvatting. Zelfstandig (eigen data-hook)
// zodat de realtime-subscriptie van de voltooiingen-log alléén leeft wanneer de
// Jaar-scope gemount is (PERF/INF-8). De pure logica zit in lib/yearHeatmap.js;
// de visuele tegel in lib/YearHeatmap.js.

// Eerste letter als hoofdletter (NL-weekdag-/datumnamen komen lowercase uit date-fns;
// als prominent label staat een kapitaal netter).
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Weekdagnaam (0=zo..6=za) in de actieve taal. 1 jan 2023 was een zondag → een
// vaste referentieweek geeft elke dagnaam zonder van "nu" af te hangen.
const weekdayName = (weekday) =>
  cap(format(new Date(2023, 0, 1 + weekday), 'EEEE', { locale: dateLocale() }));

// Eén cijfer + bijschrift, als rustige tegel. Tellingen zijn de "vier de voortgang"-
// kern van dit scherm, dus krijgen ze het grote gewicht.
function StatTile({ value, label, tint = colors.ink }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '47%', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md }}>
      <Text style={[type.h2, { color: tint }]}>{value}</Text>
      <Text style={[type.caption, { color: colors.inkSoft }]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

export function YearActivity({ members = [] }) {
  const { completions, loading, reload } = useTaskCompletions();
  const currentYear = new Date().getFullYear();

  const [year, setYearRaw] = useState(currentYear);
  const [assigneeId, setAssigneeId] = useState(null);
  const [category, setCategory] = useState(null);
  const [selected, setSelected] = useState(null); // { key, date } van een aangetikte dag

  // Alleen een jaarwissel maakt de gemarkeerde dag ongeldig (die hoort bij het oude
  // jaar). Bij een lid-/categoriewissel blijft de selectie staan en updatet de telling
  // live mee — zo zie je direct het effect van het filter op die dag.
  const setYear = (y) => { setYearRaw(y); setSelected(null); };

  const counts = useMemo(
    () => countsByDay(completions, { assigneeId, category }),
    [completions, assigneeId, category],
  );
  const grid = useMemo(() => yearGrid(year, counts), [year, counts]);
  const summary = useMemo(() => yearSummary(counts, year), [counts, year]);

  const memberName = assigneeId
    ? (members.find((m) => m.id === assigneeId)?.display_name?.split(' ')[0] ?? t('common.someone'))
    : t('common.everyone');

  // Telling van de gekozen dag, live uit de huidige (mogelijk gefilterde) counts.
  const selectedCount = selected ? (counts.get(selected.key) ?? 0) : 0;

  const refreshControl = (
    <RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />
  );

  // Nog nooit iets afgevinkt in dit huishouden → uitnodigende lege staat.
  if (!loading && completions.length === 0) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} refreshControl={refreshControl}>
        <Empty
          illustration="agenda"
          title={t('tasks.year.empty.title')}
          subtitle={t('tasks.year.empty.subtitle')}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 40, gap: space.md }}
      refreshControl={refreshControl}
    >
      {/* Jaarkiezer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="back" tint={colors.forest} accessibilityLabel={t('tasks.year.prev')}
          onPress={() => setYear(year - 1)} />
        <Text style={[type.h2]}>{year}</Text>
        <IconButton icon="forward" tint={colors.forest}
          disabled={year >= currentYear} accessibilityLabel={t('tasks.year.next')}
          onPress={() => { if (year < currentYear) setYear(year + 1); }} />
      </View>

      {/* Lid-filter (alleen zinvol bij meerdere leden) */}
      {members.length > 1 ? (
        <AvatarSelect
          members={members}
          includeEveryone
          everyoneLabel={t('common.everyone')}
          selectedId={assigneeId}
          onSelect={setAssigneeId}
        />
      ) : null}

      {/* Categorie-filter (één tegelijk; "Alle" wist 'm) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 2 }} style={{ flexGrow: 0 }}>
        <Chip label={t('common.all')} active={!category} onPress={() => setCategory(null)} />
        {Object.entries(categoryMeta).map(([k, m]) => (
          <Chip key={k} icon={m.icon} color={m.color} label={m.label}
            active={category === k} onPress={() => setCategory(category === k ? null : k)} />
        ))}
      </ScrollView>

      {/* Samenvatting */}
      <View>
        <SectionHeader
          title={memberName}
          action={<Text style={[type.caption, { color: colors.inkSoft }]}>
            {plural(summary.total, 'tasks.year.total.one', 'tasks.year.total.other')}
          </Text>}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <StatTile value={summary.activeDays} label={t('tasks.year.stat.activeDays')} tint={colors.forest} />
          <StatTile value={summary.longestStreak} label={t('tasks.year.stat.longestStreak')} tint={colors.forest} />
          {year === currentYear ? (
            <StatTile value={summary.currentStreak} label={t('tasks.year.stat.currentStreak')} tint={colors.ocher} />
          ) : null}
          {summary.busiestWeekday ? (
            <StatTile
              value={weekdayName(summary.busiestWeekday.weekday)}
              label={t('tasks.year.stat.busiestDay')}
            />
          ) : null}
        </View>
      </View>

      {/* Heatmap */}
      <Card raised={false} style={{ paddingHorizontal: space.md, paddingVertical: space.md }}>
        <YearHeatmap
          grid={grid}
          selectedKey={selected?.key ?? null}
          onSelectDay={(cell) => setSelected({ key: cell.key, date: cell.date })}
        />
        {/* Uitleg van de aangetikte dag */}
        {selected ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line }}>
            <Icon name={selectedCount > 0 ? 'check' : 'agenda'} size={18} color={selectedCount > 0 ? colors.forest : colors.inkFaint} />
            <Text style={[type.body, { flex: 1 }]}>
              <Text style={{ fontWeight: '700' }}>{cap(format(selected.date, 'EEEE d MMMM', { locale: dateLocale() }))}</Text>
              {'  ·  '}
              {plural(selectedCount, 'tasks.year.count.one', 'tasks.year.count.other')}
            </Text>
          </View>
        ) : (
          <Text style={[type.caption, { color: colors.inkFaint, marginTop: space.sm, textAlign: 'center' }]}>
            {t('tasks.year.tapHint')}
          </Text>
        )}
      </Card>
    </ScrollView>
  );
}

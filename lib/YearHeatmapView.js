import React, { memo, useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { format } from 'date-fns';
import { colors, type, space } from './theme';
import { dateLocale, t, plural } from './i18n';

// Visuele jaar-heatmap (TKN-2): een GitHub-achtig bijdrage-raster van voltooiingen.
// Zuiver presentationeel — voed het met `grid` uit lib/yearHeatmap.js (yearGrid).
// Kolommen = weken (maandag-start), rijen = weekdagen. Tikken op een dag (ín het jaar,
// niet in de toekomst) meldt de dag terug via onSelectDay; de container toont de uitleg.
//
//   grid:         { weeks, months, maxCount, year, weekStartsOn }  (uit yearGrid)
//   onSelectDay:  (cell) => void
//   selectedKey:  string | null    — gemarkeerde dag (ring)

const CELL = 14;          // zijde van een dag-vakje
const GAP = 3;            // ruimte tussen vakjes
const COL_W = CELL + GAP; // kolombreedte (week)
const LABEL_W = 26;       // breedte van de weekdag-labelkolom
const MONTH_H = 16;       // hoogte van de maandlabel-rij

// Hex (#rrggbb of #rgb) → rgba-string met alpha.
function rgba(hex, a) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Vijf achtergronden voor niveau 0..4: lege dag (zachte vulling) → oplopend groen
// (alpha over het kaart-oppervlak, dus AA-veilig in licht én donker). Eén keer per
// render samengesteld uit de actuele forest-kleur i.p.v. per cel — scheelt ~366
// parses op een raster van een heel jaar.
function buildRamp(forest) {
  return [colors.surfaceAlt, rgba(forest, 0.28), rgba(forest, 0.5), rgba(forest, 0.74), rgba(forest, 1)];
}

// Eén dag-vakje. Cellen buiten het jaar / in de toekomst zijn rustige, niet-tikbare
// opvulling (er kan daar geen voltooiing zijn). React.memo: bij een dag-selectie
// herrendert de container, maar alleen de twee cellen wier `selected` wijzigt komen
// echt opnieuw aan de beurt — i.p.v. ~365 cellen + evenveel datum-format-calls (jank
// op mid-range Android). Vereist stabiele `ramp` (useMemo) en `onSelectDay` (useCallback).
const DayCell = memo(function DayCell({ cell, ramp, selected, onSelectDay }) {
  if (!cell.inYear || cell.isFuture) {
    return (
      <View style={{
        width: CELL, height: CELL, borderRadius: 3, marginBottom: GAP,
        backgroundColor: 'transparent',
        borderWidth: cell.inYear ? 1 : 0, borderColor: colors.line,
      }} />
    );
  }
  const label = `${format(cell.date, 'd MMMM yyyy', { locale: dateLocale() })} · ${
    plural(cell.count, 'tasks.year.count.one', 'tasks.year.count.other')}`;
  return (
    <Pressable
      onPress={() => onSelectDay?.(cell)}
      // Klein, niet-overlappend tikdoel: het raster heeft een pitch van CELL+GAP, dus
      // een grotere slop zou de buur-cellen overlappen → onvoorspelbaar welke dag je raakt.
      hitSlop={GAP / 2}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={{
        width: CELL, height: CELL, borderRadius: 3, marginBottom: GAP,
        backgroundColor: ramp[cell.level],
        borderWidth: selected ? 2 : (cell.isToday ? 1 : 0),
        borderColor: selected ? colors.focus : colors.ocher,
      }}
    />
  );
});

export function YearHeatmap({ grid, onSelectDay, selectedKey }) {
  // Stabiele ramp-identiteit: anders krijgt elke DayCell elke render een nieuwe `ramp`
  // en valt de memo-bail-out weg. Herbouwt alleen als de forest-kleur (thema) wijzigt.
  const ramp = useMemo(() => buildRamp(colors.forest), [colors.forest]);
  const gridWidth = grid.weeks.length * COL_W;

  // Weekdag-labels uit de eerste kolom (locale-gevoelig); toon Ma/Wo/Vr om de rij
  // luchtig te houden, net als GitHub.
  const weekdayLabels = (grid.weeks[0] ?? []).map((c) => format(c.date, 'EEEEEE', { locale: dateLocale() }));

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: space.lg }}>
        <View>
          {/* Maandlabels, uitgelijnd op de kolom waar de maand begint. */}
          <View style={{ flexDirection: 'row', height: MONTH_H }}>
            <View style={{ width: LABEL_W }} />
            <View style={{ width: gridWidth }}>
              {grid.months.map((m) => (
                <Text
                  key={m.monthIndex}
                  style={[type.caption, { position: 'absolute', left: m.col * COL_W, top: 0, color: colors.inkSoft }]}
                >
                  {format(new Date(grid.year, m.monthIndex, 1), 'MMM', { locale: dateLocale() })}
                </Text>
              ))}
            </View>
          </View>

          {/* Weekdag-labelkolom + het wekenraster. */}
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: LABEL_W }}>
              {weekdayLabels.map((lbl, row) => (
                <View key={row} style={{ height: CELL, marginBottom: GAP, justifyContent: 'center' }}>
                  {row % 2 === 0 ? (
                    <Text style={[type.caption, { color: colors.inkFaint, fontSize: 10 }]}>{lbl}</Text>
                  ) : null}
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row' }}>
              {grid.weeks.map((wk, col) => (
                <View key={col} style={{ marginRight: GAP }}>
                  {wk.map((cell) => (
                    <DayCell
                      key={cell.key}
                      cell={cell}
                      ramp={ramp}
                      selected={!!selectedKey && cell.key === selectedKey}
                      onSelectDay={onSelectDay}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Legenda: minder → meer. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: space.sm }}>
        <Text style={[type.caption, { color: colors.inkFaint }]}>{t('tasks.year.legend.less')}</Text>
        {ramp.map((bg, lvl) => (
          <View key={lvl} style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: bg }} />
        ))}
        <Text style={[type.caption, { color: colors.inkFaint }]}>{t('tasks.year.legend.more')}</Text>
      </View>
    </View>
  );
}

import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { format } from 'date-fns';
import { colors, type, space, hitSlopFor } from './theme';
import { dateLocale, t, plural } from './i18n';

// Visuele jaar-heatmap (TKN-2): een GitHub-achtig bijdrage-raster van voltooiingen.
// Zuiver presentationeel — voed het met `grid` uit lib/yearHeatmap.js (yearGrid).
// Kolommen = weken (maandag-start), rijen = weekdagen. Tikken op een dag meldt de
// dag terug via onSelectDay (de container toont dan de uitleg-callout).
//
//   grid:         { weeks, months, maxCount, year, weekStartsOn }  (uit yearGrid)
//   onSelectDay:  (cell) => void   — alleen voor dagen ín het jaar
//   selectedKey:  string | null    — gemarkeerde dag (ring)

const CELL = 14;          // zijde van een dag-vakje
const GAP = 3;            // ruimte tussen vakjes
const COL_W = CELL + GAP; // kolombreedte (week)
const LABEL_W = 26;       // breedte van de weekdag-labelkolom
const MONTH_H = 16;       // hoogte van de maandlabel-rij

// Hex (#rrggbb of #rgb) → rgba-string met alpha. Leest de actuele forest-kleur op
// rendertijd, zodat de tinten meebewegen met licht/donker thema.
function rgba(hex, a) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Achtergrond per intensiteitsniveau. 0 = lege dag (zachte vulling); 1..4 = oplopend
// groen (alpha over het kaart-oppervlak, dus AA-veilig in beide thema's).
function levelColor(level) {
  if (level <= 0) return colors.surfaceAlt;
  return rgba(colors.forest, [0, 0.28, 0.5, 0.74, 1][level]);
}

// Eén dag-vakje. Cellen buiten het jaar zijn rustige, niet-tikbare opvulling.
function DayCell({ cell, selected, onSelectDay }) {
  if (!cell.inYear) {
    return <View style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: 'transparent' }} />;
  }
  const bg = cell.isFuture ? 'transparent' : levelColor(cell.level);
  const label = `${format(cell.date, 'd MMMM yyyy', { locale: dateLocale() })} · ${
    plural(cell.count, 'tasks.year.count.one', 'tasks.year.count.other')}`;
  return (
    <Pressable
      onPress={() => onSelectDay?.(cell)}
      hitSlop={hitSlopFor(CELL)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={{
        width: CELL, height: CELL, borderRadius: 3, backgroundColor: bg,
        borderWidth: selected ? 2 : (cell.isToday || cell.isFuture ? 1 : 0),
        borderColor: selected ? colors.focus : (cell.isToday ? colors.ocher : colors.line),
      }}
    />
  );
}

export function YearHeatmap({ grid, onSelectDay, selectedKey }) {
  const weekCount = grid.weeks.length;
  const gridWidth = weekCount * COL_W;

  // Weekdag-labels uit de eerste kolom (locale-gevoelig); toon Ma/Wo/Vr om de rij
  // luchtig te houden, net als GitHub.
  const weekdayLabels = (grid.weeks[0] ?? []).map((c) => format(c.date, 'EEEEEE', { locale: dateLocale() }));

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: space.lg }}
      >
        <View>
          {/* Maandlabels, uitgelijnd op de kolom waar de maand begint. */}
          <View style={{ flexDirection: 'row', height: MONTH_H }}>
            <View style={{ width: LABEL_W }} />
            <View style={{ width: gridWidth }}>
              {grid.months.map((m) => (
                <Text
                  key={m.monthIndex}
                  style={[type.caption, {
                    position: 'absolute', left: m.col * COL_W, top: 0, color: colors.inkSoft,
                  }]}
                >
                  {format(new Date(grid.year, m.monthIndex, 1), 'MMM', { locale: dateLocale() })}
                </Text>
              ))}
            </View>
          </View>

          {/* Weekdag-labelkolom + het wekenraster. */}
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: LABEL_W, justifyContent: 'space-between' }}>
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
                    <View key={cell.key} style={{ marginBottom: GAP }}>
                      <DayCell
                        cell={cell}
                        selected={!!selectedKey && cell.key === selectedKey}
                        onSelectDay={onSelectDay}
                      />
                    </View>
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
        {[0, 1, 2, 3, 4].map((lvl) => (
          <View key={lvl} style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: levelColor(lvl) }} />
        ))}
        <Text style={[type.caption, { color: colors.inkFaint }]}>{t('tasks.year.legend.more')}</Text>
      </View>
    </View>
  );
}

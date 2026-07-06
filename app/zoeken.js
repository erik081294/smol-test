import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, SectionList, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { run } from '../lib/db';
import { useHousehold } from '../lib/household';
import { MODULES } from '../lib/modules';
import { rankResults, routeForHit, moduleForKind } from '../lib/searchRank';
import { ModalHeader, SectionHeader, ItemRow, Empty, ListSkeleton } from '../lib/ui';
import { Icon } from '../lib/icons';
import { SearchField } from '../lib/SearchField';
import { colors, space, type, screenPadding } from '../lib/theme';
import { t, dateLocale } from '../lib/i18n';

const DEBOUNCE_MS = 300;

// Globaal zoeken (PLT-3): één zoekvak over alle modules heen. De RPC
// global_search (migratie 0075, SECURITY INVOKER → RLS scopet per tabel) filtert
// server-side goedkoop voor; lib/searchRank.js rangschikt (exact > prefix >
// woordgrens > substring, recentste wint bij gelijke rang) en dit scherm groepeert
// de hits per module. Tik op een hit → het detailscherm (of de module-tab als er
// geen detail bestaat, bv. een boodschappen-item).
export default function Zoeken() {
  const router = useRouter();
  const { activeId } = useHousehold();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  // Volgnummer tegen out-of-order antwoorden: alleen het antwoord van de laatste
  // (gedebouncede) aanvraag mag de lijst zetten.
  const seq = useRef(0);

  const q = query.trim();

  // Debounced zoeken: pas 300 ms na de laatste toetsaanslag één RPC-call, zodat
  // we niet per letter het netwerk op gaan. run() vangt fouten (logt + fallback
  // []) zodat een offline-moment geen crash of stille hang wordt.
  useEffect(() => {
    const mine = ++seq.current;
    if (!activeId || !q) { setRows([]); setBusy(false); return undefined; }
    setBusy(true);
    const timer = setTimeout(async () => {
      const data = await run(
        supabase.rpc('global_search', { p_household: activeId, p_query: q }),
        { fallback: [], context: t('search.error') },
      );
      if (seq.current !== mine) return; // er is al een nieuwere zoekterm onderweg
      setRows(rankResults(data ?? [], q));
      setBusy(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [activeId, q]);

  // Groepeer per module, in de vaste MODULES-volgorde (tabbalk-volgorde); binnen
  // een groep blijft de rangschik-volgorde van rankResults staan.
  const sections = useMemo(() => {
    const byModule = new Map();
    for (const hit of rows) {
      const key = moduleForKind(hit.kind);
      if (!key) continue;
      if (!byModule.has(key)) byModule.set(key, []);
      byModule.get(key).push(hit);
    }
    return MODULES
      .filter((m) => byModule.has(m.key))
      .map((m) => ({ key: m.key, title: m.label, icon: m.icon, data: byModule.get(m.key) }));
  }, [rows]);

  const openHit = (hit) => {
    const route = routeForHit(hit);
    if (route) router.push(route);
  };

  // Datum rechts in de rij ("6 jul") — kleine context zonder de rij te verzwaren.
  const dateLabel = (hit) => {
    if (!hit.happened_on) return null;
    try { return format(parseISO(hit.happened_on), 'd MMM', { locale: dateLocale() }); } catch { return null; }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ModalHeader title={t('search.title')} onClose={() => router.back()} />

      {/* Zoekveld bovenaan, met autofocus: zoeken is dé actie van dit scherm. */}
      <View style={{ paddingHorizontal: screenPadding }}>
        <SearchField value={query} onChangeText={setQuery} label={t('search.placeholder')} autoFocus />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(hit) => `${hit.kind}:${hit.id}`}
        contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: space.xs, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        removeClippedSubviews={Platform.OS === 'android'}
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.md }}>
            <Icon name={section.icon} size={16} color={colors.inkSoft} />
            <View style={{ flex: 1 }}>
              <SectionHeader title={section.title} count={section.data.length} />
            </View>
          </View>
        )}
        renderItem={({ item: hit }) => (
          <ItemRow
            title={hit.title}
            meta={hit.subtitle ? <Text style={type.caption} numberOfLines={1}>{hit.subtitle}</Text> : null}
            trailing={dateLabel(hit) ? <Text style={type.caption}>{dateLabel(hit)}</Text> : null}
            chevron
            onPress={() => openHit(hit)}
          />
        )}
        ListEmptyComponent={
          !q ? (
            // Lege staat: nog geen zoekterm — vertel wat je hier kunt vinden.
            <Empty icon="search" title={t('search.empty.title')} subtitle={t('search.empty.subtitle')} />
          ) : busy ? (
            // Eerste antwoord is nog onderweg → skeleton i.p.v. een flitsende
            // "geen resultaten" die meteen weer verdwijnt.
            <ListSkeleton count={3} />
          ) : (
            <Empty icon="search" title={t('search.none.title')} subtitle={t('search.none.subtitle', { q })} />
          )
        }
      />
    </SafeAreaView>
  );
}

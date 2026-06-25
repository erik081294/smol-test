import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, SectionList, RefreshControl, Modal, ScrollView, Platform } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, addDays, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { usePantry } from '../../lib/usePantry';
import { useProducts } from '../../lib/useProducts';
import { useGroceries } from '../../lib/useGroceries';
import { useToast } from '../../lib/toast';
import { status, daysUntil, sortByUrgency, PANTRY_STATUS } from '../../lib/pantry';
import {
  Empty, ScreenHeader, SectionHeader, ItemRow, IconButton, ListSkeleton, Chip, Row,
  Badge, Banner, FAB, Field, Stepper, Button, ModalHeader, SwipeRow,
} from '../../lib/ui';
import { colors, space, type, radius } from '../../lib/theme';
import { animateNextLayout } from '../../lib/motion';
import { success } from '../../lib/haptics';
import { PANTRY_LOCATIONS, UNITS } from '../../lib/constants';
import { t } from '../../lib/i18n';

// Status → badge-tint.
const STATUS_TONE = {
  [PANTRY_STATUS.EXPIRED]: 'danger',
  [PANTRY_STATUS.SOON]: 'warning',
  [PANTRY_STATUS.LOW]: 'warning',
  [PANTRY_STATUS.FRESH]: 'neutral',
};
const STATUS_DOT = {
  [PANTRY_STATUS.EXPIRED]: colors.danger,
  [PANTRY_STATUS.SOON]: colors.warning,
  [PANTRY_STATUS.LOW]: colors.warning,
  [PANTRY_STATUS.FRESH]: colors.done,
};

// Houdbaarheids-meta tekst.
function bestBeforeLabel(item) {
  if (!item.best_before) return null;
  const d = daysUntil(item.best_before);
  if (d < 0) return t('pantry.bestBefore.expired', { n: -d });
  if (d === 0) return t('pantry.bestBefore.today');
  return t('pantry.bestBefore.days', { n: d });
}

// Gememoïseerde voorraadrij op moduleniveau (PERF-5, `GroceryRow`-patroon): alleen de
// rij waarvan het item wijzigt hertekent. De handlers komen als stabiele callbacks binnen.
const PantryRow = React.memo(function PantryRow({ item, onRemove, onEdit, onAdjust, onToList }) {
  const st = status(item);
  const bb = bestBeforeLabel(item);
  return (
    <SwipeRow
      left={{ icon: 'delete', label: t('common.delete'), color: colors.danger, onTrigger: () => onRemove(item) }}>
      <ItemRow
        leading={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: STATUS_DOT[st] }} />}
        title={item.name}
        meta={
          <Row gap={space.sm}>
            <Text style={type.caption}>{(+item.quantity).toLocaleString('nl-NL')} {item.unit}</Text>
            {bb ? <Badge label={bb} tone={STATUS_TONE[st]} /> : null}
          </Row>
        }
        onPress={() => onEdit(item)}
        accessibilityHint={t('pantry.editHint')}
        trailing={
          <Row gap={2}>
            <IconButton icon="back" size={18} tint={colors.inkSoft}
              accessibilityLabel={t('pantry.less')} onPress={() => onAdjust(item, -1)} />
            <IconButton icon="forward" size={18} tint={colors.forest}
              accessibilityLabel={t('pantry.more')} onPress={() => onAdjust(item, +1)} />
            <IconButton icon="shopping" size={18} tint={colors.ocher}
              accessibilityLabel={t('pantry.toList')} onPress={() => onToList(item)} />
          </Row>
        }
      />
    </SwipeRow>
  );
});

export default function Voorraad() {
  const dialog = useDialog();
  const { items, loading, reload, add, update, adjustQuantity, remove, removeMany } = usePantry();
  const { suggestFor } = useProducts();
  const { add: addGrocery } = useGroceries();
  const toast = useToast();
  const [view, setView] = useState('urgentie');   // 'urgentie' | 'plaats'
  const [hiddenIds, setHiddenIds] = useState([]);
  const [editor, setEditor] = useState(null);      // null | {} (nieuw) | item (bewerken)

  const visible = useMemo(() => items.filter((i) => !hiddenIds.includes(i.id)), [items, hiddenIds]);
  const sorted = useMemo(() => sortByUrgency(visible), [visible]);
  const expiringCount = useMemo(
    () => visible.filter((i) => [PANTRY_STATUS.EXPIRED, PANTRY_STATUS.SOON].includes(status(i))).length,
    [visible]
  );
  const expired = useMemo(() => visible.filter((i) => status(i) === PANTRY_STATUS.EXPIRED), [visible]);

  // Eén SectionList voor beide views (PERF-5): "plaats" groepeert per bewaarplaats,
  // "urgentie" is één naamloze sectie. Zo blijft alles gevirtualiseerd i.p.v. de hele
  // voorraad in een ListHeaderComponent te monteren.
  const sections = useMemo(() => {
    if (view === 'plaats') {
      return PANTRY_LOCATIONS
        .map((loc) => ({ key: loc, title: t(`location.${loc}`), data: sorted.filter((i) => i.location === loc) }))
        .filter((s) => s.data.length > 0);
    }
    return sorted.length ? [{ key: 'all', title: null, data: sorted }] : [];
  }, [view, sorted]);

  // Op de boodschappenlijst zetten — koppel meteen aan het (catalogus)product
  // zodat de prijsdata blijft groeien. Toevoegen is niet-destructief, dus geen undo.
  const toList = async (item) => {
    try {
      await addGrocery(item.name, item.product_id ?? null, item.catalog_product_id ?? null);
      success();
      toast.show({ message: t('pantry.toList.done', { name: item.name }) });
    } catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
  };

  const removeWithUndo = (item) => {
    animateNextLayout();
    setHiddenIds((h) => [...h, item.id]);
    toast.show({
      message: t('pantry.deleted', { name: item.name }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); setHiddenIds((h) => h.filter((x) => x !== item.id)); },
      onExpire: async () => {
        try { await remove(item.id); }
        catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
        finally { setHiddenIds((h) => h.filter((x) => x !== item.id)); }
      },
    });
  };

  // Alle verlopen producten in één keer opruimen — zelfde undo-vangnet als boodschappen.
  const onClearExpired = () => {
    const ids = expired.map((i) => i.id);
    if (!ids.length) return;
    animateNextLayout();
    setHiddenIds((h) => [...h, ...ids]);
    toast.show({
      message: t('pantry.clearedExpired', { n: ids.length }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); setHiddenIds((h) => h.filter((x) => !ids.includes(x))); },
      onExpire: async () => {
        try { await removeMany(ids); }
        catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
        finally { setHiddenIds((h) => h.filter((x) => !ids.includes(x))); }
      },
    });
  };

  // Stabiele handlers naar de laatste closures (PERF-5, `GroceryRow`-patroon) zodat de
  // gememoïseerde PantryRow niet hertekent door wisselende callback-identiteiten.
  const removeRef = useRef(); const adjustRef = useRef(); const toListRef = useRef();
  useEffect(() => { removeRef.current = removeWithUndo; adjustRef.current = adjustQuantity; toListRef.current = toList; });
  const onRemove = useCallback((item) => removeRef.current(item), []);
  const onAdjust = useCallback((item, d) => adjustRef.current(item, d), []);
  const onToList = useCallback((item) => toListRef.current(item), []);
  const renderItem = useCallback(({ item }) => (
    <PantryRow item={item} onRemove={onRemove} onEdit={setEditor} onAdjust={onAdjust} onToList={onToList} />
  ), [onRemove, onAdjust, onToList]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('pantry.title')} subtitle={t('pantry.subtitle')} />

      <Row gap={space.sm} style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
        <Chip label={t('pantry.view.urgency')} active={view === 'urgentie'} onPress={() => setView('urgentie')} />
        <Chip label={t('pantry.view.place')} active={view === 'plaats'} onPress={() => setView('plaats')} />
      </Row>

      {expiringCount > 0 ? (
        <View style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
          <Banner tone="warning">
            {expiringCount === 1 ? t('pantry.expiring.one') : t('pantry.expiring.other', { n: expiringCount })}
          </Banner>
          {expired.length > 0 ? (
            <Button title={t('pantry.clearExpired', { n: expired.length })} variant="ghost" icon="delete"
              fullWidth={false} onPress={onClearExpired} style={{ marginTop: space.xs, alignSelf: 'flex-start' }} />
          ) : null}
        </View>
      ) : null}

      <SectionList
        contentContainerStyle={{ padding: space.lg, paddingTop: space.xs, paddingBottom: 96 }}
        sections={sections}
        keyExtractor={(i) => i.id}
        stickySectionHeadersEnabled={false}
        // Virtualisatie-afstelling, gelijk aan app/catalog.js (PERF-9).
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          section.title ? <SectionHeader title={section.title} count={section.data.length} /> : null
        )}
        ListEmptyComponent={
          loading && items.length === 0 ? (
            <ListSkeleton count={5} />
          ) : !loading && visible.length === 0 ? (
            <Empty illustration="pantry" title={t('pantry.empty.title')} subtitle={t('pantry.empty.subtitle')}
              actionTitle={t('pantry.empty.action')} onAction={() => setEditor({})} />
          ) : null
        }
      />

      <FAB label={t('fab.pantry')} accessibilityLabel={t('pantry.add')} onPress={() => setEditor({})} />

      <PantryEditor
        editor={editor}
        onClose={() => setEditor(null)}
        onAdd={add}
        onUpdate={update}
        onDelete={removeWithUndo}
        suggestFor={suggestFor}
        toast={toast}
      />
    </SafeAreaView>
  );
}

// Toevoeg-/bewerk-sheet. `editor` = {} (nieuw), een item (bewerken), of een item
// met `_toList` (snel op de lijst zetten — opent met de focus op die actie).
function PantryEditor({ editor, onClose, onAdd, onUpdate, onDelete, suggestFor, toast }) {
  const dialog = useDialog();
  const isNew = editor && !editor.id;
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('stuk');
  const [location, setLocation] = useState('kast');
  const [bbOffset, setBbOffset] = useState(null);   // null=geen, of dagen vanaf nu
  const [bbExisting, setBbExisting] = useState(null);
  const [threshold, setThreshold] = useState('');
  const [busy, setBusy] = useState(false);

  // Sync velden bij openen.
  React.useEffect(() => {
    if (!editor) return;
    setName(editor.name ?? '');
    setQuantity(Number(editor.quantity) || 1);
    setUnit(editor.unit ?? 'stuk');
    setLocation(editor.location ?? 'kast');
    setThreshold(editor.low_threshold != null ? String(editor.low_threshold) : '');
    setBbExisting(editor.best_before ?? null);
    setBbOffset(null);
  }, [editor]);

  const hints = useMemo(() => {
    if (!isNew || name.trim().length < 2) return [];
    return suggestFor(name, 3).filter((s) => s.score >= 0.4).map((s) => s.product);
  }, [isNew, name, suggestFor]);

  const BB_CHOICES = [
    { l: t('pantry.bb.none'), v: null },
    { l: t('pantry.bb.3d'), v: 3 },
    { l: t('pantry.bb.1w'), v: 7 },
    { l: t('pantry.bb.2w'), v: 14 },
    { l: t('pantry.bb.1m'), v: 30 },
  ];

  const resolvedBestBefore = () => {
    if (bbOffset != null) return format(addDays(new Date(), bbOffset), 'yyyy-MM-dd');
    return bbExisting; // ongewijzigd
  };

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const payload = {
      name: name.trim(), quantity, unit, location,
      bestBefore: resolvedBestBefore(),
      lowThreshold: threshold.trim() ? Number(threshold.replace(',', '.')) : null,
    };
    try {
      if (isNew) await onAdd(payload);
      else await onUpdate(editor.id, {
        name: payload.name, quantity, unit, location,
        best_before: payload.bestBefore, low_threshold: payload.lowThreshold,
      });
      onClose();
    } catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={!!editor} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '90%' }}>
          <ModalHeader title={isNew ? t('pantry.add') : name} onClose={onClose} onConfirm={save} busy={busy}
            confirmLabel={t('common.save')} cancelLabel={t('common.cancelLong')} />
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
            <Field label={t('pantry.field.name')} value={name} onChangeText={setName}
              placeholder={t('pantry.field.name.placeholder')} autoFocus={isNew} />
            {hints.length > 0 ? (
              <Row gap={space.xs} wrap style={{ marginTop: -space.sm, marginBottom: space.md }}>
                {hints.map((p) => (
                  <Chip key={p.id} label={p.name} icon="catalog" onPress={() => setName(p.name)} />
                ))}
              </Row>
            ) : null}

            <Text style={[type.label, { marginBottom: space.xs }]}>{t('pantry.field.quantity')}</Text>
            <Row gap={space.md} style={{ marginBottom: space.lg }}>
              <Stepper value={quantity} onChange={setQuantity} min={0} max={999} accessibilityLabel={t('pantry.field.quantity')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {UNITS.map((u) => <Chip key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />)}
              </ScrollView>
            </Row>

            <Text style={[type.label, { marginBottom: space.xs }]}>{t('pantry.field.location')}</Text>
            <Row gap={space.xs} wrap style={{ marginBottom: space.lg }}>
              {PANTRY_LOCATIONS.map((loc) => (
                <Chip key={loc} label={t(`location.${loc}`)} active={location === loc} onPress={() => setLocation(loc)} />
              ))}
            </Row>

            <Text style={[type.label, { marginBottom: space.xs }]}>{t('pantry.field.bestBefore')}</Text>
            <Row gap={space.xs} wrap style={{ marginBottom: space.xs }}>
              {BB_CHOICES.map((c) => (
                <Chip key={c.l} label={c.l}
                  active={bbOffset === c.v && !(c.v === null && bbExisting)}
                  onPress={() => { setBbOffset(c.v); if (c.v !== null) setBbExisting(null); }} />
              ))}
            </Row>
            {(bbOffset != null || bbExisting) ? (
              <Text style={[type.caption, { marginBottom: space.lg }]}>
                {format(parseISO(resolvedBestBefore()), 'EEEE d MMMM', { locale: nl })}
              </Text>
            ) : <View style={{ marginBottom: space.lg }} />}

            <Field label={t('pantry.field.threshold')} value={threshold} onChangeText={setThreshold}
              placeholder="1" keyboardType="numeric" />

            {!isNew ? (
              <Button title={t('common.delete')} variant="ghost"
                onPress={() => { onClose(); onDelete(editor); }}
                style={{ borderColor: 'transparent', marginTop: space.sm }} />
            ) : null}
            <View style={{ height: space.xl }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

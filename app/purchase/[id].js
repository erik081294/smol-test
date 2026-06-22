import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { parseDataUrl } from '../../lib/plantPhoto';
import * as haptics from '../../lib/haptics';
import { usePurchases } from '../../lib/usePurchases';
import { useProducts } from '../../lib/useProducts';
import { usePantry } from '../../lib/usePantry';
import { useToast } from '../../lib/toast';
import { Field, Button, Chip, Stepper, Row, IconButton, ModalHeader, Banner, Editor, DateStepper, T } from '../../lib/ui';
import { colors, radius, type, space } from '../../lib/theme';
import { parseAmountToCents, formatCents } from '../../lib/expenses';
import { t, dateLocale } from '../../lib/i18n';

const UNITS = ['stuk', 'pak', 'kg', 'g', 'l', 'ml'];
const emptyLine = () => ({ name: '', quantity: 1, unit: 'stuk', priceText: '', productId: null });

export default function PurchaseEditor() {
  const dialog = useDialog();
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const { addPurchase, updatePurchase } = usePurchases();
  const { products, addProduct, matchFor } = useProducts();
  const { restockFromPurchase } = usePantry();
  const toast = useToast();

  // ----- Bestaande bon: weergave (read-only) → bewerken -----
  const [existing, setExisting] = useState(null);
  const [editing, setEditing] = useState(false);
  const loadExisting = useCallback(async () => {
    const { data } = await supabase.from('purchases').select('*, purchase_items(*)').eq('id', id).single();
    if (!data) router.back(); else setExisting(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { if (!isNew) loadExisting(); }, [isNew, loadExisting]);

  // ----- Nieuwe bon: formulier -----
  const [store, setStore] = useState('');
  const [date, setDate] = useState(new Date());
  const [lines, setLines] = useState([emptyLine()]);
  const [totalText, setTotalText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);

  const updateLine = (i, patch) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, emptyLine()]);
  const removeLine = (i) => setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i)));

  // Lopend totaal uit de regels (in centen).
  const runningCents = useMemo(
    () => lines.reduce((sum, l) => sum + (parseAmountToCents(l.priceText) ?? 0) * (l.quantity || 0), 0),
    [lines]
  );
  const enteredTotal = parseAmountToCents(totalText);
  const totalMismatch = enteredTotal != null && enteredTotal !== runningCents;

  // Koppel een regel aan een bestaand catalogusproduct.
  const linkProduct = (i, product) => updateLine(i, { productId: product.id, name: product.name });
  const unlink = (i) => updateLine(i, { productId: null });

  // Maak een nieuw catalogusproduct uit de regelnaam en koppel het meteen.
  const createAndLink = async (i, name) => {
    try {
      const p = await addProduct({ name, defaultUnit: lines[i].unit });
      if (p) updateLine(i, { productId: p.id, name: p.name });
    } catch (e) {
      dialog.alert({ title: t('common.failed'), body: e.message });
    }
  };

  // --- Bonscan (BOO-7): foto -> Orq.ai-gateway via de edge function -> prefill ---
  // Het resultaat vult de bewerkbare editor; de gebruiker controleert/corrigeert
  // (totaal-controle + per-regel matching) vóór opslaan. Geen waarheid, een vliegende start.
  const applyScan = (data) => {
    if (data.store) setStore(data.store);
    if (data.purchased_on) {
      const d = parseISO(data.purchased_on);
      if (!Number.isNaN(d.getTime())) setDate(d);
    }
    const scanned = (data.items ?? []).map((i) => ({
      name: i.name,
      quantity: i.quantity || 1,
      unit: UNITS.includes(i.unit) ? i.unit : 'stuk',
      priceText: i.unit_price_cents != null ? (i.unit_price_cents / 100).toFixed(2).replace('.', ',') : '',
      productId: null,
    }));
    setLines(scanned.length ? scanned : [emptyLine()]);
  };

  const runScan = async (asset) => {
    const base64 = asset.base64 ?? parseDataUrl(asset.uri)?.base64;
    if (!base64) { dialog.alert({ title: t('purchase.scan.error'), body: t('purchase.scan.readError') }); return; }
    setScanning(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('scan-receipt', {
        body: { imageBase64: base64, mimeType: 'image/jpeg' },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      applyScan(data);
      haptics.success();
    } catch (e) {
      haptics.error();
      dialog.alert({ title: t('purchase.scan.error'), body: e.message });
    } finally { setScanning(false); }
  };

  const launchScan = async (camera) => {
    try {
      const perm = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm?.granted === false) { dialog.alert({ title: t('purchase.scan.noAccess') }); return; }
      const fn = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const res = await fn({ mediaTypes: ['images'], quality: 0.5, base64: true });
      if (res.canceled) return;
      await runScan(res.assets[0]);
    } catch (e) {
      dialog.alert({ title: t('purchase.scan.error'), body: e.message });
    }
  };

  // Keuze camera/bibliotheek via het eigen actiesheet — één codepad (UX-6).
  const onScanPress = async () => {
    const idx = await dialog.menu({
      title: t('purchase.scan.title'),
      options: [
        { label: t('purchase.scan.camera'), icon: 'photo' },
        { label: t('purchase.scan.library'), icon: 'library' },
      ],
    });
    if (idx === 0) launchScan(true);
    else if (idx === 1) launchScan(false);
  };

  // Vul de form met de bestaande bon en schakel naar bewerk-modus.
  const startEditing = () => {
    setStore(existing.store ?? '');
    setDate(existing.purchased_on ? parseISO(existing.purchased_on) : new Date());
    setTotalText(existing.total_cents != null ? (existing.total_cents / 100).toFixed(2).replace('.', ',') : '');
    setLines((existing.purchase_items ?? []).map((it) => ({
      name: it.name,
      quantity: Number(it.quantity) || 1,
      unit: UNITS.includes(it.unit) ? it.unit : 'stuk',
      priceText: it.unit_price_cents != null ? (it.unit_price_cents / 100).toFixed(2).replace('.', ',') : '',
      productId: it.product_id ?? null,
    })));
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    const filled = lines.filter((l) => l.name.trim());
    if (!filled.length) { setError(t('purchase.error.noLines')); haptics.error(); return; }
    setError(null);
    setBusy(true);
    try {
      const items = filled.map((l) => {
        const unitPrice = parseAmountToCents(l.priceText);
        return {
          product_id: l.productId,
          name: l.name.trim(),
          quantity: l.quantity || 1,
          unit: l.unit,
          unit_price_cents: unitPrice,
          line_total_cents: unitPrice != null ? unitPrice * (l.quantity || 1) : null,
        };
      });
      const payload = { store, purchasedOn: format(date, 'yyyy-MM-dd'), totalCents: enteredTotal, items };
      if (isNew) {
        await addPurchase(payload);
        haptics.success();
        router.back();
      } else {
        await updatePurchase(id, payload);
        haptics.success();
        await loadExisting();   // ververs de read-only weergave
        setEditing(false);
      }
    } catch (e) {
      haptics.error();
      dialog.alert({ title: t('purchase.error.save'), body: e.message });
    } finally { setBusy(false); }
  };

  // ---------- Read-only weergave bestaande bon (met "Bewerken") ----------
  if (!isNew && !editing) {
    if (!existing) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} />;
    const nameOf = (pid) => products.find((p) => p.id === pid)?.name;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title={existing.store || t('purchase.untitled')} onClose={() => router.back()}
          onConfirm={startEditing} confirmLabel={t('common.edit')} />
        <ScrollView contentContainerStyle={{ padding: space.lg }}>
          <Text style={[type.body, { color: colors.inkSoft, marginBottom: space.lg }]}>
            {format(parseISO(existing.purchased_on), 'd MMMM yyyy', { locale: dateLocale() })}
            {existing.total_cents != null ? ` · ${formatCents(existing.total_cents)}` : ''}
          </Text>
          {(existing.purchase_items ?? []).map((it) => (
            <Row key={it.id} justify="space-between" style={{ paddingVertical: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{it.name}</Text>
                <Text style={type.caption}>
                  {it.quantity} {it.unit}{nameOf(it.product_id) ? ` · ${nameOf(it.product_id)}` : ''}
                </Text>
              </View>
              {it.unit_price_cents != null ? <Text style={type.body}>{formatCents(it.unit_price_cents)}</Text> : null}
            </Row>
          ))}
          {(existing.purchase_items ?? []).length > 0 ? (
            <View style={{ marginTop: space.xl, gap: space.sm }}>
              <Button title={t('purchase.split')} icon="expenses" variant="accent"
                onPress={() => {
                  const cents = existing.total_cents
                    ?? (existing.purchase_items ?? []).reduce((s, it) => s + (it.line_total_cents ?? 0), 0);
                  router.push({
                    pathname: '/expense/new',
                    params: {
                      prefillDescription: `${existing.store || t('purchase.untitled')} · ${format(parseISO(existing.purchased_on), 'd MMM', { locale: dateLocale() })}`,
                      prefillAmount: cents ? (cents / 100).toFixed(2).replace('.', ',') : '',
                      sourceType: 'purchase', sourceId: existing.id,
                    },
                  });
                }} />
              <Button title={t('pantry.fromPurchase')} icon="pantry" variant="soft"
                onPress={async () => {
                  try {
                    await restockFromPurchase(existing.purchase_items ?? []);
                    haptics.success();
                    toast.show({ message: t('pantry.fromPurchase.done', { n: (existing.purchase_items ?? []).length }) });
                  } catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
                }} />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------- Nieuwe bon óf bewerken ----------
  return (
    <Editor title={isNew ? t('purchase.new') : t('purchase.edit')}
      onClose={() => { if (editing) setEditing(false); else router.back(); }}
      onConfirm={save} busy={busy}
      contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Bonscan: vult winkel/datum/regels in één keer; daarna controleren. */}
          <Button title={t('purchase.scan')} icon="receipt" variant="soft" onPress={onScanPress}
            loading={scanning} style={{ marginBottom: space.md }} />
          <Text style={[type.caption, { marginBottom: space.lg, textAlign: 'center' }]}>{t('purchase.scan.hint')}</Text>

          <Field label={t('purchase.field.store')} value={store} onChangeText={setStore}
            placeholder={t('purchase.field.store.placeholder')} />

          {/* Datum */}
          <Text style={[type.label, { marginBottom: space.xs }]}>{t('purchase.field.date')}</Text>
          <DateStepper date={date} onChange={setDate} style={{ marginBottom: space.lg }} />

          {/* Regels */}
          <Text style={[type.label, { marginBottom: space.sm }]}>{t('purchase.field.lines')}</Text>
          {lines.map((line, i) => {
            const match = !line.productId && line.name.trim() ? matchFor(line.name) : null;
            return (
              <View key={i} style={{
                backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5,
                borderColor: colors.line, padding: space.md, marginBottom: space.md, gap: space.sm,
              }}>
                <Row justify="space-between">
                  <Text style={type.label}>{t('purchase.line', { n: i + 1 })}</Text>
                  {lines.length > 1 ? (
                    <IconButton icon="delete" size={20} tint={colors.inkFaint}
                      accessibilityLabel={t('purchase.line.remove')} onPress={() => removeLine(i)} />
                  ) : null}
                </Row>
                <Field value={line.name} onChangeText={(v) => updateLine(i, { name: v, productId: null })}
                  placeholder={t('purchase.line.name.placeholder')} style={{ marginBottom: 0 }} />

                {/* Catalogus-koppeling */}
                {line.productId ? (
                  <Row gap={space.xs}>
                    <Chip label={`≈ ${line.name}`} active color={colors.forest} onPress={() => unlink(i)} />
                    <Text style={type.caption}>{t('purchase.linked')}</Text>
                  </Row>
                ) : line.name.trim() ? (
                  <Row gap={space.xs} wrap>
                    {match ? (
                      <Chip label={t('purchase.linkTo', { name: match.product.name })}
                        onPress={() => linkProduct(i, match.product)} />
                    ) : null}
                    <Chip label={t('purchase.newProduct')} icon="add" onPress={() => createAndLink(i, line.name)} />
                  </Row>
                ) : null}

                {/* Aantal + eenheid + prijs */}
                <Row justify="space-between" wrap gap={space.sm}>
                  <Stepper value={line.quantity} onChange={(v) => updateLine(i, { quantity: v })}
                    min={1} max={99} accessibilityLabel={t('purchase.line.quantity')} />
                  <Row gap={space.xs} wrap>
                    {UNITS.map((u) => (
                      <Chip key={u} label={u} active={line.unit === u} onPress={() => updateLine(i, { unit: u })} />
                    ))}
                  </Row>
                </Row>
                <Field label={t('purchase.line.price')} value={line.priceText} onChangeText={(v) => updateLine(i, { priceText: v })}
                  placeholder={t('purchase.line.price.placeholder')} keyboardType="decimal-pad"
                  style={{ marginBottom: 0 }} />
              </View>
            );
          })}

          <Button title={t('purchase.addLine')} icon="add" variant="ghost" onPress={addLine} />

          {/* Totaal-controle */}
          <View style={{ marginTop: space.lg }}>
            <Field label={t('purchase.field.total')} value={totalText} onChangeText={setTotalText}
              placeholder={t('purchase.field.total.placeholder')} keyboardType="decimal-pad"
              helper={t('purchase.runningTotal', { amount: formatCents(runningCents) })} />
            {totalMismatch ? (
              <Banner tone="warning" title={t('purchase.totalMismatch', { entered: formatCents(enteredTotal), running: formatCents(runningCents) })} />
            ) : null}
          </View>

          {error ? <T variant="caption" color={colors.danger}>{error}</T> : null}
          <View style={{ height: space.lg }} />
    </Editor>
  );
}

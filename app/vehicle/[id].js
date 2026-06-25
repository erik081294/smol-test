import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { useVehicles, useVehicleLog, useVehicleRecurring, addVehicleLog } from '../../lib/useVehicles';
import { vehicleCostSummary } from '../../lib/vehicleCosts';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { useDialog } from '../../lib/dialog';
import { maintenanceTemplates, defaultMaintenanceKeys, intervalLabel } from '../../lib/vehicleCare';
import { isValidPlate, lookupPlate } from '../../lib/rdw';
import { CarGlyph } from '../../lib/CarGlyph';
import { offerImagePicker } from '../../lib/photoPicker';
import { parseRatePerKm, formatRatePerKm } from '../../lib/vehicleSharing';
import { formatCents, parseAmountToCents } from '../../lib/expenses';
import { ModalHeader, Field, Checkbox, Button, Row, Stack, SectionHeader, ItemRow } from '../../lib/ui';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { VISIBILITY } from '../../lib/constants';
import { colors, type, space, radius } from '../../lib/theme';
import { t } from '../../lib/i18n';

// Heel getal uit vrije invoer, of null (bouwjaar/km-stand). Negatief/onzin → null.
function toInt(text) {
  const n = parseInt(String(text).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Eén regel in het kostenoverzicht: label links, bedrag/maand rechts.
function CostRow({ label, valueCents }) {
  return (
    <Row justify="space-between" style={{ marginTop: space.xs }}>
      <Text style={type.caption}>{label}</Text>
      <Text style={type.caption}>{t('vehicle.costs.perMonth', { amount: formatCents(valueCents) })}</Text>
    </Row>
  );
}

export default function VehicleEditor() {
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const dialog = useDialog();
  const { vehicles, addVehicle, updateVehicle, removeVehicle, setVehicleShared } = useVehicles();
  const { members, subgroups } = useHousehold();
  const { user } = useAuth();
  const { entries: logEntries, reload: reloadLog } = useVehicleLog(isNew ? null : id);
  const { items: recurring, reload: reloadRecurring } = useVehicleRecurring(isNew ? null : id);

  const existing = useMemo(() => vehicles.find((v) => v.id === id), [vehicles, id]);

  // Kostenoverzicht (V3): vaste lasten + gerealiseerd onderhoud + afschrijving-schatting.
  const costs = useMemo(
    () => vehicleCostSummary({ recurring, logs: logEntries, vehicle: existing ?? {} }),
    [recurring, logEntries, existing]
  );
  // Vaste lasten/onderhoud herladen zodra de editor terugkrijgt (na een sub-editor).
  useFocusEffect(useCallback(() => { reloadRecurring(); reloadLog(); }, [reloadRecurring, reloadLog]));

  const [name, setName] = useState(existing?.name ?? '');
  const [plate, setPlate] = useState(existing?.license_plate ?? '');
  const [make, setMake] = useState(existing?.make ?? '');
  const [model, setModel] = useState(existing?.model ?? '');
  const [vehicleType, setVehicleType] = useState(existing?.vehicle_type ?? '');
  const [year, setYear] = useState(existing?.year != null ? String(existing.year) : '');
  const [mileage, setMileage] = useState(existing?.mileage != null ? String(existing.mileage) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const [visibility, setVisibility] = useState(existing?.visibility ?? VISIBILITY.HOUSEHOLD);
  const [shareSubgroupId, setShareSubgroupId] = useState(existing?.share_subgroup_id ?? null);
  const [shareWith, setShareWith] = useState(existing?.share_with ?? []);

  // Delen via de Samen-module (VTG-4). Voor een auto staat dit standaard aan; bij een
  // bestaand voertuig weerspiegelt het of er al een gekoppelde resource is.
  const [shared, setShared] = useState(isNew ? true : existing?.resource_id != null);
  // Prijs per km (V4): tarief dat de eigenaar rekent bij delen. Leeg = gratis.
  const [priceKm, setPriceKm] = useState(existing?.price_per_km_cents != null ? formatRatePerKm(existing.price_per_km_cents) : '');

  // RDW-kentekenlookup (VTG-3): niet-blokkerend en debounced. Bij een geldig kenteken
  // vult 'ie merk/model/type — maar alléén lege velden, zodat handmatige invoer nooit
  // wordt overschreven. Faalt de RDW (offline/onbekend/timeout), dan gebeurt er stil niets.
  const [lookupState, setLookupState] = useState(null); // null | 'busy' | 'found' | 'none'
  // Verrijking uit de laatste geslaagde RDW-lookup (kleur/carrosserie/APK/eerste-toelating/
  // prijs/massa). Bij bewerken pas opgeslagen als er een verse lookup was; anders blijft
  // de bestaande verrijking staan.
  const [rdw, setRdw] = useState(null);
  const lookupSeq = useRef(0);
  useEffect(() => {
    if (!isValidPlate(plate)) { setLookupState(null); return undefined; }
    const seq = ++lookupSeq.current;
    const timer = setTimeout(async () => {
      setLookupState('busy');
      const r = await lookupPlate(plate);
      if (seq !== lookupSeq.current) return; // kenteken intussen veranderd → verouderd
      if (r) {
        setMake((m) => m || r.make || '');
        setModel((m) => m || r.model || '');
        setVehicleType((tp) => tp || r.vehicleType || '');
        setRdw(r);
        setLookupState('found');
      } else {
        setLookupState('none');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [plate]);

  // Verschijning voor de glyph (verse lookup wint van de opgeslagen waarde).
  const glyphColor = rdw?.color ?? existing?.color ?? null;
  const glyphBody = rdw?.bodyType ?? existing?.body_type ?? null;
  const apkOn = rdw?.apkExpiry ?? existing?.apk_expires_on ?? null;
  const hasAppearance = glyphColor != null || glyphBody != null;
  const appearanceLine = [
    glyphColor, glyphBody,
    apkOn ? t('vehicle.rdw.apkUntil', { date: String(apkOn).split('-').reverse().join('-') }) : null,
  ].filter(Boolean).join(' · ');

  // Onderhouds-checklist: alleen bij een nieuw voertuig (de taken worden bij aanmaken
  // gegenereerd). Default voor-aangevinkt = de gangbare basis (APK/beurten/olie/banden).
  const [maintenance, setMaintenance] = useState(() => new Set(defaultMaintenanceKeys()));
  const toggleMaintenance = (key) => setMaintenance((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (!name.trim()) { setError(t('vehicle.error.name')); return; }
    setBusy(true);
    const payload = {
      name, make, model, vehicleType, year: toInt(year), licensePlate: plate, mileage: toInt(mileage), notes,
      visibility, shareSubgroupId, shareWith,
    };
    try {
      let vehicleId = id;
      if (isNew) {
        const created = await addVehicle({
          ...payload, maintenanceKeys: [...maintenance],
          color: rdw?.color, bodyType: rdw?.bodyType, apkExpiresOn: rdw?.apkExpiry,
          firstRegistration: rdw?.firstRegistration, catalogPriceCents: rdw?.catalogPriceCents,
          curbWeightKg: rdw?.curbWeightKg,
          pricePerKmCents: shared ? parseRatePerKm(priceKm) : null,
        });
        if (!created) return; // addVehicle gaf geen rij terug (fout al getoond) → niet navigeren
        vehicleId = created.id;
      } else {
        await updateVehicle(id, {
          name: name.trim(), make: make.trim() || null, model: model.trim() || null,
          vehicle_type: vehicleType.trim() || null,
          year: toInt(year), license_plate: plate.trim() || null, mileage: toInt(mileage),
          notes: notes.trim() || null,
          visibility,
          share_subgroup_id: visibility === VISIBILITY.SUBGROUP ? shareSubgroupId : null,
          share_with: visibility === VISIBILITY.CUSTOM ? shareWith : null,
          price_per_km_cents: shared ? parseRatePerKm(priceKm) : null,
          // Alleen overschrijven bij een verse RDW-lookup; anders bestaande verrijking laten staan.
          ...(rdw ? {
            color: rdw.color, body_type: rdw.bodyType, apk_expires_on: rdw.apkExpiry,
            first_registration: rdw.firstRegistration, catalog_price_cents: rdw.catalogPriceCents,
            curb_weight_kg: rdw.curbWeightKg,
          } : {}),
        });
      }
      // Delen is secundair en mág de (geslaagde) opslag niet omverwerpen: een fout hierin
      // (bv. een elders verwijderde rij, of nog-actieve reserveringen bij ontkoppelen)
      // waarschuwt alleen. Sync zolang gedeeld (naam/zichtbaarheid) óf als het toggelde.
      const wasShared = !isNew && existing?.resource_id != null;
      if (shared || shared !== wasShared) {
        try { await setVehicleShared(vehicleId, shared); }
        catch (e) { await dialog.alert({ title: t('vehicle.share.syncFailed'), body: e.message }); }
      }
      router.back();
    } catch (e) {
      dialog.alert({ title: t('vehicle.error.save'), body: e.message });
    } finally { setBusy(false); }
  };

  const onDelete = async () => {
    const ok = await dialog.confirm({ title: t('vehicle.deleteButton'), body: existing?.name ?? '', tone: 'danger' });
    if (!ok) return;
    try { await removeVehicle(id); router.back(); }
    catch (e) { dialog.alert({ title: t('vehicle.error.save'), body: e.message }); }
  };

  // Onderhoud loggen (VTG-2): datum/km/kosten/notitie + optioneel als gedeelde uitgave.
  const [logOpen, setLogOpen] = useState(false);
  const [logTitle, setLogTitle] = useState('');
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [logKm, setLogKm] = useState('');
  const [logCost, setLogCost] = useState('');
  const [logNote, setLogNote] = useState('');
  const [logAsExpense, setLogAsExpense] = useState(false);
  const [logPhoto, setLogPhoto] = useState(null); // gekozen boekje-foto (asset), nog niet geüpload
  const [logBusy, setLogBusy] = useState(false);

  const totalCostCents = logEntries.reduce((sum, e) => sum + (e.cost_cents ?? 0), 0);

  const submitLog = async () => {
    setLogBusy(true);
    try {
      await addVehicleLog({
        vehicle: existing, householdId: existing.household_id, userId: user.id,
        title: logTitle, performedOn: logDate || null,
        mileage: toInt(logKm), costCents: parseAmountToCents(logCost),
        note: logNote, asExpense: logAsExpense, members, paidBy: user.id, photoAsset: logPhoto,
      });
      setLogTitle(''); setLogKm(''); setLogCost(''); setLogNote(''); setLogAsExpense(false); setLogPhoto(null); setLogOpen(false);
      await reloadLog();
    } catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
    finally { setLogBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ModalHeader title={isNew ? t('vehicle.new') : (existing?.name ?? t('vehicle.add'))}
        onClose={() => router.back()} onConfirm={save} busy={busy} confirmLabel={t('common.save')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled">

        <Field label={t('vehicle.field.name')} value={name} onChangeText={(v) => { setName(v); setError(null); }}
          placeholder={t('vehicle.field.name.placeholder')} autoFocus={isNew} error={error} />
        <Field label={t('vehicle.field.plate')} value={plate} onChangeText={setPlate}
          placeholder={t('vehicle.field.plate.placeholder')} autoCapitalize="characters"
          helper={lookupState === 'busy' ? t('vehicle.rdw.busy')
            : lookupState === 'found' ? t('vehicle.rdw.found')
              : lookupState === 'none' ? t('vehicle.rdw.none') : undefined} />

        <Row gap={space.md}>
          <View style={{ flex: 1 }}>
            <Field label={t('vehicle.field.make')} value={make} onChangeText={setMake} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('vehicle.field.model')} value={model} onChangeText={setModel} />
          </View>
        </Row>
        <Row gap={space.md}>
          <View style={{ flex: 1 }}>
            <Field label={t('vehicle.field.year')} value={year} onChangeText={setYear}
              placeholder="2018" keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('vehicle.field.mileage')} value={mileage} onChangeText={setMileage}
              placeholder="120000" keyboardType="number-pad" />
          </View>
        </Row>

        {/* Fun factor (V1): jouw autootje in de RDW-kleur + carrosserie. */}
        {hasAppearance ? (
          <View style={{ alignItems: 'center', marginBottom: space.lg }}>
            <CarGlyph color={glyphColor} bodyType={glyphBody} size={132} />
            {appearanceLine ? (
              <Text style={[type.caption, { marginTop: space.xs }]}>{appearanceLine}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Onderhouds-checklist alleen bij aanmaken (genereert de terugkerende taken). */}
        {isNew ? (
          <View style={{ marginBottom: space.lg }}>
            <Text style={[type.label, { marginBottom: space.xs }]}>{t('vehicle.field.maintenance')}</Text>
            <Text style={[type.caption, { marginBottom: space.sm }]}>{t('vehicle.maintenance.hint')}</Text>
            <Stack gap={space.xs}>
              {maintenanceTemplates().map((tpl) => {
                const on = maintenance.has(tpl.key);
                return (
                  <View key={tpl.key} style={{
                    flexDirection: 'row', alignItems: 'center', gap: space.sm,
                    padding: space.sm, borderRadius: radius.md,
                    borderWidth: 1, borderColor: on ? colors.forest : colors.line,
                    backgroundColor: on ? colors.forestSoft : colors.surface,
                  }}>
                    <Checkbox checked={on} onPress={() => toggleMaintenance(tpl.key)}
                      accessibilityLabel={tpl.title} />
                    <View style={{ flex: 1 }}>
                      <Text style={type.body}>{tpl.title}</Text>
                      <Text style={type.caption}>{intervalLabel(tpl)}</Text>
                    </View>
                  </View>
                );
              })}
            </Stack>
          </View>
        ) : null}

        <VisibilityPicker
          collapsible
          visibility={visibility} onChangeVisibility={setVisibility}
          shareSubgroupId={shareSubgroupId} onChangeSubgroup={setShareSubgroupId}
          shareWith={shareWith} onToggleMember={(mid) => setShareWith((w) => w.includes(mid) ? w.filter((x) => x !== mid) : [...w, mid])}
          subgroups={subgroups} members={members} />

        {/* Delen via de Samen-module (VTG-4) — voor een auto standaard aan. */}
        <Row gap={space.sm} align="center" style={{ marginBottom: shared ? space.md : space.lg }}>
          <Checkbox checked={shared} onPress={() => setShared((v) => !v)} accessibilityLabel={t('vehicle.share.label')} />
          <View style={{ flex: 1 }}>
            <Text style={type.body}>{t('vehicle.share.label')}</Text>
            <Text style={type.caption}>{t('vehicle.share.hint')}</Text>
          </View>
        </Row>
        {/* Prijs per km (V4): leeg = gratis (reserveren mag, geen kosten). */}
        {shared ? (
          <Field label={t('vehicle.share.pricePerKm')} value={priceKm} onChangeText={setPriceKm}
            placeholder="0,00" keyboardType="decimal-pad" helper={t('vehicle.share.pricePerKm.hint')}
            style={{ marginBottom: space.lg }} />
        ) : null}

        <Field label={t('vehicle.field.notes')} value={notes} onChangeText={setNotes} multiline />

        {/* Kostenoverzicht (V3) — vaste lasten + onderhoud + afschrijving-schatting. */}
        {!isNew ? (
          <View style={{ marginTop: space.sm, marginBottom: space.lg }}>
            <SectionHeader title={t('vehicle.costs.title')} />
            <View style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, marginBottom: space.sm }}>
              <Text style={[type.title, { fontSize: 22 }]}>{t('vehicle.costs.perMonth', { amount: formatCents(costs.monthlyCents) })}</Text>
              <Text style={type.caption}>{t('vehicle.costs.perYear', { amount: formatCents(costs.annualCents) })}</Text>
              <CostRow label={t('vehicle.costs.fixed')} valueCents={costs.fixedMonthlyCents} />
              <CostRow label={t('vehicle.costs.maintenance')} valueCents={costs.maintenanceMonthlyCents} />
              {costs.depreciation ? (
                <>
                  <CostRow label={t('vehicle.costs.depreciation')} valueCents={costs.depreciationMonthlyCents} />
                  <Text style={[type.caption, { color: colors.inkSoft, marginTop: space.xs }]}>
                    {t('vehicle.costs.value')}: {formatCents(costs.depreciation.currentValueCents)}
                  </Text>
                </>
              ) : null}
            </View>
            {costs.depreciation ? (
              <Text style={[type.caption, { color: colors.inkSoft, marginBottom: space.sm }]}>{t('vehicle.costs.estimateNote')}</Text>
            ) : null}
            {recurring.length === 0 ? (
              <Text style={[type.caption, { marginBottom: space.sm }]}>{t('vehicle.costs.empty')}</Text>
            ) : (
              <Stack gap={space.xs} style={{ marginBottom: space.sm }}>
                {recurring.map((r) => (
                  <ItemRow key={r.id} title={r.description}
                    meta={<Text style={type.caption}>{formatCents(r.amount_cents)} · {r.recur_interval > 1 ? t('recur.' + r.recur_freq + '.other', { n: r.recur_interval }) : t('recur.' + r.recur_freq + '.one')}</Text>}
                    chevron onPress={() => router.push(`/recurring-expense/${r.id}`)} />
                ))}
              </Stack>
            )}
            <Button title={t('vehicle.costs.addFixed')} variant="soft" icon="add"
              onPress={() => router.push(`/recurring-expense/new?vehicle=${id}`)} />
          </View>
        ) : null}

        {/* Onderhoudshistorie (VTG-2) — alleen bij een bestaand voertuig. */}
        {!isNew ? (
          <View style={{ marginTop: space.sm, marginBottom: space.lg }}>
            <SectionHeader title={t('vehicle.history.title')} count={logEntries.length}
              action={<Button title={t('vehicle.history.log')} variant="ghost" icon="add"
                fullWidth={false} onPress={() => setLogOpen((o) => !o)} />} />
            <Button title={t('vehicle.timeline.open')} variant="soft" icon="timeline"
              onPress={() => router.push(`/vehicle/timeline?v=${id}`)} style={{ marginBottom: space.sm }} />
            {totalCostCents > 0 ? (
              <Text style={[type.caption, { marginBottom: space.sm }]}>
                {t('vehicle.history.total', { amount: formatCents(totalCostCents) })}
              </Text>
            ) : null}

            {logOpen ? (
              <View style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, marginBottom: space.md }}>
                <Field label={t('vehicle.log.title')} value={logTitle} onChangeText={setLogTitle}
                  placeholder={t('vehicle.log.title.placeholder')} />
                <Row gap={space.md}>
                  <View style={{ flex: 1 }}>
                    <Field label={t('vehicle.log.date')} value={logDate} onChangeText={setLogDate} placeholder="2026-06-25" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label={t('vehicle.log.km')} value={logKm} onChangeText={setLogKm} keyboardType="number-pad" />
                  </View>
                </Row>
                <Field label={t('vehicle.log.cost')} value={logCost} onChangeText={setLogCost}
                  placeholder="0,00" keyboardType="decimal-pad" />
                <Field label={t('vehicle.log.note')} value={logNote} onChangeText={setLogNote} multiline />
                <Button title={logPhoto ? t('vehicle.log.photoAdded') : t('vehicle.log.photo')}
                  variant="soft" icon="photo" fullWidth={false} style={{ marginBottom: space.md }}
                  onPress={() => offerImagePicker((asset) => setLogPhoto(asset))} />
                <Row gap={space.sm} align="center" style={{ marginBottom: space.md }}>
                  <Checkbox checked={logAsExpense} onPress={() => setLogAsExpense((v) => !v)}
                    accessibilityLabel={t('vehicle.log.asExpense')} />
                  <Text style={[type.body, { flex: 1 }]}>{t('vehicle.log.asExpense')}</Text>
                </Row>
                <Button title={t('vehicle.log.save')} onPress={submitLog} loading={logBusy} />
              </View>
            ) : null}

            {logEntries.length === 0 ? (
              <Text style={type.caption}>{t('vehicle.history.empty')}</Text>
            ) : (
              <Stack gap={space.xs}>
                {logEntries.map((e) => (
                  <View key={e.id} style={{ padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line }}>
                    <Text style={type.body}>{e.title || t('vehicle.field.maintenance')}</Text>
                    <Text style={type.caption}>
                      {[e.performed_on, e.mileage != null ? `${e.mileage} km` : null,
                        e.cost_cents != null ? formatCents(e.cost_cents) : null].filter(Boolean).join(' · ')}
                    </Text>
                    {e.note ? <Text style={[type.caption, { color: colors.inkSoft }]}>{e.note}</Text> : null}
                  </View>
                ))}
              </Stack>
            )}
          </View>
        ) : null}

        {!isNew ? (
          <Button title={t('vehicle.deleteButton')} variant="ghost" onPress={onDelete}
            style={{ borderColor: 'transparent', marginTop: space.sm }} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

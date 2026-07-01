// Eigen dialoog-/actiesheet-systeem (UX-6) — merkvast, thema-/dark-mode-bewust en
// toetsbaar, i.p.v. de native `Alert` (die er per platform anders uitziet, het thema
// negeert en niet te stylen is).
//
// Model: hetzelfde provider-patroon als lib/toast.js — één provider bovenin de app,
// een `useDialog()`-hook voor componenten, en een veilige no-op-default zodat een
// aanroep buiten de provider nooit crasht. De API is **Promise-based** zodat
// call-sites `await`-baar blijven:
//
//   const dialog = useDialog();
//   if (await dialog.confirm({ title, body, tone: 'danger' })) { … }   // -> true/false
//   const i = await dialog.menu({ title, options: [{ label, icon }] }); // -> index of null
//   await dialog.alert({ title, body });                               // enkel "OK"
//
// Niet-component-code (lib/db.js, lib/photoPicker.js, de `confirmDiscard` in lib/ui.js)
// kan geen hook aanroepen; daarvoor exporteren we ook een module-singleton `dialog`
// die naar dezelfde, door de provider geregistreerde, imperatieve API wijst.

import React, {
  createContext, useContext, useCallback, useMemo, useRef, useState, useEffect,
} from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, StyleSheet, AccessibilityInfo, findNodeHandle,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, type, space, elevation, touchTarget } from './theme';
import { Icon } from './icons';
import { prefersReducedMotion } from './motion';
import { t } from './i18n';

const DialogContext = createContext(null);

// Veilige default: buiten de provider doet alles niets (en lost meteen netjes op).
const noop = {
  confirm: async () => false,
  alert: async () => {},
  menu: async () => null,
};

// Module-singleton voor niet-component-aanroepers. De provider registreert hier
// zijn echte API; vóór mount (of erna) valt alles terug op no-ops.
let handle = noop;
export const dialog = {
  confirm: (o) => handle.confirm(o),
  alert: (o) => handle.alert(o),
  menu: (o) => handle.menu(o),
};

export const useDialog = () => useContext(DialogContext) ?? noop;

export function DialogProvider({ children }) {
  const [req, setReq] = useState(null); // actieve aanvraag: { kind, …opts, cancelValue, resolve }
  // Imperatieve spiegel van de actieve aanvraag, los van de render-staat: zo kunnen
  // open()/settle() de huidige aanvraag lezen/opruimen zonder een verouderde closure.
  // Bewust níét tijdens render gezet — open() en settle() houden 'm zelf bij.
  const reqRef = useRef(null);

  // Sluit de huidige dialoog en los de Promise op met `value`.
  const settle = useCallback((value) => {
    const r = reqRef.current;
    reqRef.current = null;
    setReq(null);
    r?.resolve?.(value);
  }, []);

  const open = useCallback((kind, opts, cancelValue) => new Promise((resolve) => {
    // Een nieuwe dialoog verdringt de vorige: los die eerst op met z'n annuleer-
    // waarde zodat een hangende `await` nooit blijft wachten.
    const prev = reqRef.current;
    if (prev) prev.resolve?.(prev.cancelValue);
    const r = { ...opts, kind, cancelValue, resolve };
    reqRef.current = r;
    setReq(r);
  }), []);

  const api = useMemo(() => ({
    confirm: (o = {}) => open('confirm', o, false),
    alert: (o = {}) => open('alert', o, undefined),
    menu: (o = {}) => open('menu', o, null),
  }), [open]);

  // Registreer de imperatieve API voor de module-singleton zolang de provider leeft.
  useEffect(() => { handle = api; return () => { handle = noop; }; }, [api]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <DialogHost req={req} settle={settle} />
    </DialogContext.Provider>
  );
}

// Eén tikknop binnen een dialoog. Geen import uit lib/ui.js (dat zou een cyclus
// geven met confirmDiscard); spiegelt bewust de Button-paletten uit lib/ui.js.
function DialogButton({ title, onPress, variant = 'solid', tone = 'default', innerRef }) {
  const solid = tone === 'danger'
    ? { bg: colors.danger, fg: colors.onDark, pressed: '#9E3A24' }
    : { bg: colors.forest, fg: colors.onDark, pressed: colors.forestSoft };
  const ghost = { bg: 'transparent', fg: colors.ink, pressed: colors.surfaceAlt };
  const p = variant === 'ghost' ? ghost : solid;
  const fg = variant === 'ghost' && tone === 'danger' ? colors.danger : p.fg;
  return (
    <Pressable
      ref={innerRef}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flex: 1, minHeight: touchTarget,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: space.lg, borderRadius: radius.md,
        backgroundColor: pressed ? p.pressed : p.bg,
        borderWidth: variant === 'ghost' ? 1.5 : 0,
        borderColor: variant === 'ghost' ? colors.lineStrong : 'transparent',
      })}
    >
      <Text style={[type.button, { color: fg, textAlign: 'center' }]} numberOfLines={2}>{title}</Text>
    </Pressable>
  );
}

function DialogHost({ req, settle }) {
  const insets = useSafeAreaInsets();
  const primaryRef = useRef(null);

  // Zet de screenreader-focus op de primaire actie zodra een dialoog opent.
  // findNodeHandle is op react-native-web niet ondersteund (gooit) en
  // setAccessibilityFocus doet daar toch niets — op web slaan we dit dus over.
  useEffect(() => {
    if (!req || Platform.OS === 'web') return;
    const node = primaryRef.current && findNodeHandle(primaryRef.current);
    if (node) {
      const id = setTimeout(() => AccessibilityInfo.setAccessibilityFocus(node), 50);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [req]);

  if (!req) return null;
  const reduced = prefersReducedMotion();
  const isMenu = req.kind === 'menu';
  const cancel = () => settle(req.cancelValue);

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType={reduced ? 'none' : isMenu ? 'slide' : 'fade'}
      onRequestClose={cancel}
    >
      <View style={[StyleSheet.absoluteFill, { justifyContent: isMenu ? 'flex-end' : 'center' }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={cancel}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        />
        {isMenu
          ? <MenuPanel req={req} settle={settle} insets={insets} primaryRef={primaryRef} />
          : <ConfirmPanel req={req} settle={settle} primaryRef={primaryRef} />}
      </View>
    </Modal>
  );
}

// Gecentreerde kaart voor confirm/alert.
function ConfirmPanel({ req, settle, primaryRef }) {
  const isAlert = req.kind === 'alert';
  return (
    <View
      accessibilityViewIsModal
      style={[{
        marginHorizontal: space.xl, backgroundColor: colors.surface,
        borderRadius: radius.lg, padding: space.lg, gap: space.md,
        alignSelf: 'center', maxWidth: 460, width: '88%',
      }, elevation.e3]}
    >
      {req.title ? <Text style={[type.title, { fontSize: 18 }]}>{req.title}</Text> : null}
      {req.body ? <Text style={[type.body, { color: colors.inkSoft }]}>{req.body}</Text> : null}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
        {isAlert ? (
          <DialogButton innerRef={primaryRef} title={req.confirmLabel ?? t('dialog.ok')} onPress={() => settle(undefined)} />
        ) : (
          <>
            <DialogButton variant="ghost" title={req.cancelLabel ?? t('common.cancelLong')} onPress={() => settle(false)} />
            <DialogButton innerRef={primaryRef} tone={req.tone === 'danger' ? 'danger' : 'default'}
              title={req.confirmLabel ?? t('common.save')} onPress={() => settle(true)} />
          </>
        )}
      </View>
    </View>
  );
}

// Actiesheet vanaf de onderkant voor menu (keuzelijst).
function MenuPanel({ req, settle, insets, primaryRef }) {
  const options = req.options ?? [];
  return (
    <View
      accessibilityViewIsModal
      style={[{
        backgroundColor: colors.bg,
        borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
        paddingBottom: Math.max(insets.bottom, space.md), maxHeight: '80%',
      }, elevation.e2]}
    >
      {(req.title || req.body) ? (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm }}>
          {req.title ? <Text style={type.title}>{req.title}</Text> : null}
          {req.body ? <Text style={[type.caption, { marginTop: 2 }]}>{req.body}</Text> : null}
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.xs }}>
        {options.map((opt, i) => {
          const danger = opt.tone === 'danger';
          const tint = danger ? colors.danger : colors.ink;
          return (
            <Pressable
              key={`${opt.label}-${i}`}
              ref={i === 0 ? primaryRef : undefined}
              onPress={() => settle(i)}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: space.md,
                minHeight: touchTarget, paddingHorizontal: space.sm,
                borderRadius: radius.md, backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
              })}
            >
              {opt.icon ? <Icon name={opt.icon} size={22} color={tint} /> : null}
              <Text style={[type.body, { color: tint, flex: 1 }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
        <View style={{ flexDirection: 'row', marginTop: space.sm }}>
          <DialogButton variant="ghost" title={req.cancelLabel ?? t('common.cancelLong')} onPress={() => settle(null)} />
        </View>
      </ScrollView>
    </View>
  );
}

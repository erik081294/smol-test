// Toast met optioneel "ongedaan maken" — het vangnet voor vernietigende acties
// (DESIGN.md principe 7, "vergevingsgezind"). Eén provider bovenin de app; elk
// scherm roept `useToast().show(...)` aan.
//
// Twee callbacks bepalen het gedrag van een vernietigende actie:
//   • onExpire — draait wanneer de toast vanzelf verdwijnt: hier voer je de
//     échte (server-)verwijdering uit. Tot die tijd is er niets onomkeerbaars
//     gebeurd; het scherm verbergt de items alleen lokaal.
//   • onAction — draait wanneer de gebruiker op "Ongedaan maken" tikt: zet de
//     lokale staat terug; onExpire draait dan niet.
//
// Zo is "instant wissen" tóch terug te draaien zonder de rij eerst te verwijderen
// en daarna weer aan te maken (wat nieuwe id's/created_at zou geven).

import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors, space, radius, type, elevation } from './theme';

// Hoogte waarop de toast zweeft. Boven de tabbalk (86) op tab-schermen; op
// modal-editors zweeft 'ie wat hoger — bewust, blijft leesbaar.
const BOTTOM_OFFSET = 96;

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext) ?? { show: () => {} };

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, actionLabel, onAction }
  const currentRef = useRef(null);          // spiegelt de actieve toast (incl. onExpire)
  const timerRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  // Verberg de huidige toast. commit=true ⇒ voer onExpire uit (de echte actie).
  const dismiss = useCallback((commit) => {
    clearTimer();
    const t = currentRef.current;
    currentRef.current = null;
    setToast(null);
    if (commit && t?.onExpire) t.onExpire();
  }, []);

  const show = useCallback((opts) => {
    // Een nieuwe toast verdringt de vorige: commit eerst diens uitgestelde actie,
    // anders zou die verloren gaan.
    clearTimer();
    const prev = currentRef.current;
    if (prev?.onExpire) prev.onExpire();
    currentRef.current = opts;
    setToast({ message: opts.message, actionLabel: opts.actionLabel });
    timerRef.current = setTimeout(() => dismiss(true), opts.duration ?? 4000);
  }, [dismiss]);

  const onAction = () => {
    clearTimer();
    const t = currentRef.current;
    currentRef.current = null;
    setToast(null);
    t?.onAction?.(); // ongedaan maken: onExpire draait bewust niet
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <View
          style={{ pointerEvents: 'box-none', position: 'absolute', left: 0, right: 0, bottom: BOTTOM_OFFSET, alignItems: 'center', paddingHorizontal: space.lg }}>
          <View style={[{
            flexDirection: 'row', alignItems: 'center', gap: space.md,
            backgroundColor: colors.ink, borderRadius: radius.md,
            paddingVertical: space.md, paddingHorizontal: space.lg, maxWidth: 520, width: '100%',
          }, elevation.e3]}>
            <Text style={[type.body, { color: colors.onDark, flex: 1 }]}>{toast.message}</Text>
            {toast.actionLabel ? (
              <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={toast.actionLabel}>
                <Text style={{ color: colors.ocher, fontWeight: '800', fontSize: 15 }}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

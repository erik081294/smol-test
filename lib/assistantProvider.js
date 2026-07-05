// App-brede assistent-hub (AI-10, "assistent overal"): één gespreksstate voor
// het tab-scherm én de overlay-sheet, plus de open/dicht-besturing van die sheet.
//
// Waarom een provider: de chatstate leefde per-scherm (useAssistant in het
// tab-scherm), waardoor een remount het gesprek leegde (AI-6-restpunt) en er
// buiten de tab geen assistent was. Nu draait useAssistant() precies één keer,
// hierbinnen; elk scherm opent dezelfde assistent via openAssistant().
//
// AI-first FAB-contract (ontwerpbesluit 2026-07-05, herziening plan 23 §5):
// een module-FAB opent de chat-sheet (invoer gefocust, scherm-context gezet);
// `onManual` is de uitwijk naar de klassieke editor — "Zelf invoeren" in de
// sheet-kop. Controle blijft bij de gebruiker, AI is de snelste route.
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { useAssistant } from './useAssistant';

const AssistantContext = createContext(null);

export function AssistantProvider({ children }) {
  const assistant = useAssistant();
  // { moduleKey?: string, onManual?: () => void } | null — de open sheet-sessie.
  const [sheet, setSheet] = useState(null);

  const openAssistant = useCallback((opts = {}) => {
    // Staat de Assistent-module uit (assistent is core:false → per huishouden/
    // gebruiker uitschakelbaar)? Dan rendert de sheet niets en is óók de
    // "Zelf invoeren"-uitwijk erin onbereikbaar — de module-FAB zou een dode
    // knop zijn. Val dan direct terug op de klassieke editor, zodat de gebruiker
    // nooit zonder toevoeg-affordance komt te staan.
    if (!assistant.enabled) { opts.onManual?.(); return; }
    assistant.setScreenContext(opts.moduleKey ?? null);
    setSheet({ moduleKey: opts.moduleKey ?? null, onManual: opts.onManual ?? null });
  }, [assistant]);

  const closeAssistant = useCallback(() => {
    assistant.setScreenContext(null);
    setSheet(null);
  }, [assistant]);

  const value = useMemo(
    () => ({ assistant, sheet, openAssistant, closeAssistant }),
    [assistant, sheet, openAssistant, closeAssistant]
  );
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

// Buiten de provider (auth-flows, tests) een veilige no-op-hub — een scherm
// hoeft nooit te checken óf de assistent bestaat.
export const useAssistantHub = () =>
  useContext(AssistantContext) ?? { assistant: null, sheet: null, openAssistant: () => {}, closeAssistant: () => {} };

import { useTasks } from './useTasks';
import { useMealPlan } from './useMealPlan';
import { usePantry } from './usePantry';

// Capability-laag voor de herinneringen-engine (ARCH-2). Eén plek die de bron-data voor
// de pure allReminders() (lib/notifications.js) samenbrengt, zodat het overzicht
// useNotifications niet langer zélf in de module-hooks reikt — het kent alleen deze
// capability. Dit is de inversie die ARCH-2 beoogt: een feature-/overzicht-hook hoort
// niet ad-hoc zusterhooks te importeren; de samenstelling van modules leeft in een
// capability-laag. Spiegelt het widget-registry-patroon (lib/widgets/registry.js), waar
// elke widget z'n eigen module-data ophaalt i.p.v. dat één scherm ze allemaal importeert.
//
// De module-hooks gaten zelf al op effectiveModules (ARCH-3): een uitgezette module
// levert een lege lijst, dus draagt die vanzelf niets bij aan de herinneringen.
//
// De keys hieronder zijn precies de shape die allReminders verwacht ({ tasks, meals,
// pantry }). Een nieuwe herinnering-bron toevoegen = hier een hook bijzetten + de
// bijbehorende pure logica in notifications.js — niet useNotifications aanpassen.
export const REMINDER_SOURCE_KEYS = ['tasks', 'meals', 'pantry'];

export function useReminderSources() {
  // Vaste top-level hook-aanroepen (rules-of-hooks): de set bronnen is statisch.
  const { tasks } = useTasks();
  const { entries: meals } = useMealPlan(new Date());
  const { items: pantry } = usePantry();
  return { tasks, meals, pantry };
}

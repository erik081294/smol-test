import { dialog } from './dialog';
import { describe, runResult } from './dbResult';

// Maakt Supabase-fouten zichtbaar in plaats van ze stil te negeren.
//
// run(): voor lees-queries. Logt de fout, geeft een fallback terug, en (optioneel)
//        meldt het aan de gebruiker. Laat de UI niet crashen.
// runResult(): idem maar geeft { data, error } terug (fout ≠ leeg) — pure kern in
//        lib/dbResult.js, hier herexporteerd zodat hooks `from './db'` blijven importeren.
// mutate(): voor schrijf-acties. Gooit door zodat de aanroeper (met try/catch +
//           dialog.alert) de fout kan tonen — dit hadden de schermen al verwacht.

export { runResult };

export async function run(promise, { fallback = null, context = '', notify = false } = {}) {
  try {
    const { data, error } = await promise;
    if (error) {
      console.warn(`[Huishoek] Laadfout${context ? ` (${context})` : ''}: ${describe(error)}`);
      if (notify) dialog.alert({ title: 'Kon niet laden', body: describe(error) });
      return fallback;
    }
    return data ?? fallback;
  } catch (e) {
    console.warn(`[Huishoek] Onverwachte fout${context ? ` (${context})` : ''}: ${describe(e)}`);
    if (notify) dialog.alert({ title: 'Er ging iets mis', body: describe(e) });
    return fallback;
  }
}

export async function mutate(promise, { context = '' } = {}) {
  const { data, error } = await promise;
  if (error) {
    console.warn(`[Huishoek] Schrijffout${context ? ` (${context})` : ''}: ${describe(error)}`);
    throw new Error(describe(error));
  }
  return data;
}

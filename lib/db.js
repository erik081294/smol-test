import { dialog } from './dialog';

// Maakt Supabase-fouten zichtbaar in plaats van ze stil te negeren.
//
// run(): voor lees-queries. Logt de fout, geeft een fallback terug, en (optioneel)
//        meldt het aan de gebruiker. Laat de UI niet crashen.
// mutate(): voor schrijf-acties. Gooit door zodat de aanroeper (met try/catch +
//           dialog.alert) de fout kan tonen — dit hadden de schermen al verwacht.

function describe(error) {
  if (!error) return 'Onbekende fout';
  return error.message || error.hint || String(error);
}

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

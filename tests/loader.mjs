// Kleine resolver zodat Node's ESM extensieloze lokale imports (./constants)
// kan oplossen, net als Metro/Babel dat in de app doet. Alleen voor `npm test`.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) {
    const parentPath = fileURLToPath(context.parentURL);
    const base = pathResolve(dirname(parentPath), specifier);
    // Probeer './x.js' en dan './x/index.js' — zoals Metro/Node-CJS in de app doen. Zonder
    // de index-stap breekt alléén `npm test` (niet de app) zodra een module een map-index
    // importeert (ERR_UNSUPPORTED_DIR_IMPORT) — een verwarrende, asymmetrische breuk.
    for (const candidate of [`${base}.js`, pathResolve(base, 'index.js')]) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}

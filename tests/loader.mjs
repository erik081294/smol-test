// Kleine resolver zodat Node's ESM extensieloze lokale imports (./constants)
// kan oplossen, net als Metro/Babel dat in de app doet. Alleen voor `npm test`.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) {
    const parentPath = fileURLToPath(context.parentURL);
    const candidate = pathResolve(dirname(parentPath), specifier + '.js');
    if (existsSync(candidate)) {
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}

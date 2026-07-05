// Web-deploy-naloop (INF-4/Plat-3, review-addendum 2026-07-04): ná `expo export
// --platform web --source-maps` (1) de source maps naar Sentry uploaden zodat
// web-crashes gesymboliceerd binnenkomen (de EAS↔Sentry-integratie dekt alleen
// native builds — de web-export gaat niet door EAS), en (2) de `.map`-bestanden
// uit `dist` strippen vóór de Cloudflare-publish, zodat de broncode niet publiek
// op huishoek.app belandt. Zonder SENTRY_AUTH_TOKEN slaan we de upload over met
// een duidelijke waarschuwing — de deploy zelf blokkeert er nooit op.
//
// Gebruik: npm run deploy:web   (draait dit script na de export)
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

// 1. Source maps naar Sentry (org evdn / project huishoek, EU-region — zie
//    docs/eas-setup.md). De debug-ID's zitten al in de bundles (metro via
//    getSentryExpoConfig), dus de upload koppelt vanzelf.
if (process.env.SENTRY_AUTH_TOKEN) {
  run('npx', ['sentry-expo-upload-sourcemaps', DIST]);
} else {
  console.warn(
    '[deploy-web] SENTRY_AUTH_TOKEN ontbreekt — source-map-upload overgeslagen; ' +
    'web-crashes blijven geminified in Sentry (INF-4).'
  );
}

// 2. Maps nooit mee-publiceren.
let stripped = 0;
for (const f of [...walk(DIST)]) {
  if (f.endsWith('.map')) { rmSync(f); stripped += 1; }
}
console.log(`[deploy-web] ${stripped} source map(s) uit ${DIST} gestript.`);

// 3. Publiceren.
run('npx', ['wrangler', 'pages', 'deploy', DIST, '--project-name=huishoek']);

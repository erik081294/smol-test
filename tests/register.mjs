// Registreert de resolver hook via de officiële module.register API.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Pin de tijdzone voor de hele testsuite (en de mutatie-runner, die dit bestand óók
// ge-`--import`t) op een vaste, negatieve-offset zone. Reden: de app rekent in "lokale
// kalenderdag", en een datum-only DB-waarde ('2026-06-01') mag door new Date()'s UTC-parse
// nooit een dag verschuiven. Onder UTC blijft die klasse fouten verborgen; door expliciet
// een negatieve offset te pinnen vangt CI én elke dev-machine 'm deterministisch — ongeacht
// de eigen tijdzone. Override desgewenst met `TZ=... npm test`.
process.env.TZ ||= 'America/Los_Angeles';

register('./loader.mjs', pathToFileURL('./tests/').href);

// Registreert de resolver hook via de officiële module.register API.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('./loader.mjs', pathToFileURL('./tests/').href);

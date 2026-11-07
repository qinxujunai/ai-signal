#!/usr/bin/env node
// AI Signal — rebuild the product page (docs/index.html) from docs/latest.json, without a new issue.
// Use it after changing the page design in site.js; the daily run rebuilds it anyway.
//
// Usage: node rebuild-home.js [web dir, default ../docs]

import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { rebuildHome } from './publish.js';

const dir = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../docs/', import.meta.url));
await rebuildHome(dir);
console.error(`[ai-signal] rebuilt ${join(dir, 'index.html')}`);

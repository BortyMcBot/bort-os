#!/usr/bin/env node
/**
 * Legacy entrypoint retained for compatibility.
 * Use the resumable implementation in other-prune2.js.
 */

const path = require('path');
const { execFileSync } = require('child_process');

const target = path.join(__dirname, 'other-prune2.js');
execFileSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit' });

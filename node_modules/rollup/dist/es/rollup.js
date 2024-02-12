/*
  @license
	Rollup.js v4.10.0
	Sat, 10 Feb 2024 05:58:12 GMT - commit 762420860765e8e46e24d48b38f5b98ca31735fa

	https://github.com/rollup/rollup

	Released under the MIT License.
*/
export { version as VERSION, defineConfig, rollup, watch } from './shared/node-entry.js';
import './shared/parseAst.js';
import '../native.js';
import 'node:path';
import 'path';
import 'node:process';
import 'node:perf_hooks';
import 'node:fs/promises';
import 'tty';

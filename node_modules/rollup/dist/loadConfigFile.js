/*
  @license
	Rollup.js v4.10.0
	Sat, 10 Feb 2024 05:58:12 GMT - commit 762420860765e8e46e24d48b38f5b98ca31735fa

	https://github.com/rollup/rollup

	Released under the MIT License.
*/
'use strict';

Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

require('node:fs/promises');
require('node:path');
require('node:process');
require('node:url');
require('./shared/rollup.js');
require('./shared/parseAst.js');
const loadConfigFile_js = require('./shared/loadConfigFile.js');
require('tty');
require('path');
require('node:perf_hooks');
require('./native.js');
require('./getLogFilter.js');



exports.loadConfigFile = loadConfigFile_js.loadConfigFile;
//# sourceMappingURL=loadConfigFile.js.map

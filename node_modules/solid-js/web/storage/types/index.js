"use strict";
exports.__esModule = true;
exports.provideRequestEvent = void 0;
var node_async_hooks_1 = require("node:async_hooks");
var web_1 = require("solid-js/web");
// using global on a symbol for locating it later and detaching for environments that don't support it.
function provideRequestEvent(init, cb) {
  if (!web_1.isServer) throw new Error("Attempting to use server context in non-server build");
  var ctx = (globalThis[web_1.RequestContext] =
    globalThis[web_1.RequestContext] || new node_async_hooks_1.AsyncLocalStorage());
  return ctx.run(init, cb);
}
exports.provideRequestEvent = provideRequestEvent;

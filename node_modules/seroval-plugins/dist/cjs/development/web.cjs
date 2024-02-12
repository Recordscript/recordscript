"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// web/index.ts
var web_exports = {};
__export(web_exports, {
  BlobPlugin: () => blob_default,
  CustomEventPlugin: () => custom_event_default,
  DOMExceptionPlugin: () => dom_exception_default,
  EventPlugin: () => event_default,
  FilePlugin: () => file_default,
  FormDataPlugin: () => form_data_default,
  HeadersPlugin: () => headers_default,
  ImageDataPlugin: () => image_data_default,
  ReadableStreamPlugin: () => readable_stream_default,
  RequestPlugin: () => request_default,
  ResponsePlugin: () => response_default,
  URLPlugin: () => url_default,
  URLSearchParamsPlugin: () => url_search_params_default
});
module.exports = __toCommonJS(web_exports);

// web/blob.ts
var import_seroval = require("seroval");
var BlobPlugin = /* @__PURE__ */ (0, import_seroval.createPlugin)({
  tag: "seroval-plugins/web/Blob",
  test(value) {
    if (typeof Blob === "undefined") {
      return false;
    }
    return value instanceof Blob;
  },
  parse: {
    async async(value, ctx) {
      return {
        type: await ctx.parse(value.type),
        buffer: await ctx.parse(await value.arrayBuffer())
      };
    }
  },
  serialize(node, ctx) {
    return "new Blob([" + ctx.serialize(node.buffer) + "],{type:" + ctx.serialize(node.type) + "})";
  },
  deserialize(node, ctx) {
    return new Blob([ctx.deserialize(node.buffer)], {
      type: ctx.deserialize(node.type)
    });
  }
});
var blob_default = BlobPlugin;

// web/custom-event.ts
var import_seroval2 = require("seroval");
function createCustomEventOptions(current) {
  return {
    detail: current.detail,
    bubbles: current.bubbles,
    cancelable: current.cancelable,
    composed: current.composed
  };
}
var CustomEventPlugin = /* @__PURE__ */ (0, import_seroval2.createPlugin)({
  tag: "seroval-plugins/web/CustomEvent",
  test(value) {
    if (typeof CustomEvent === "undefined") {
      return false;
    }
    return value instanceof CustomEvent;
  },
  parse: {
    sync(value, ctx) {
      return {
        type: ctx.parse(value.type),
        options: ctx.parse(createCustomEventOptions(value))
      };
    },
    async async(value, ctx) {
      return {
        type: await ctx.parse(value.type),
        options: await ctx.parse(createCustomEventOptions(value))
      };
    },
    stream(value, ctx) {
      return {
        type: ctx.parse(value.type),
        options: ctx.parse(createCustomEventOptions(value))
      };
    }
  },
  serialize(node, ctx) {
    return "new CustomEvent(" + ctx.serialize(node.type) + "," + ctx.serialize(node.options) + ")";
  },
  deserialize(node, ctx) {
    return new CustomEvent(
      ctx.deserialize(node.type),
      ctx.deserialize(node.options)
    );
  }
});
var custom_event_default = CustomEventPlugin;

// web/dom-exception.ts
var import_seroval3 = require("seroval");
var DOMExceptionPlugin = /* @__PURE__ */ (0, import_seroval3.createPlugin)({
  tag: "seroval-plugins/web/DOMException",
  test(value) {
    if (typeof DOMException === "undefined") {
      return false;
    }
    return value instanceof DOMException;
  },
  parse: {
    sync(value, ctx) {
      return {
        name: ctx.parse(value.name),
        message: ctx.parse(value.message)
      };
    },
    async async(value, ctx) {
      return {
        name: await ctx.parse(value.name),
        message: await ctx.parse(value.message)
      };
    },
    stream(value, ctx) {
      return {
        name: ctx.parse(value.name),
        message: ctx.parse(value.message)
      };
    }
  },
  serialize(node, ctx) {
    return "new DOMException(" + ctx.serialize(node.message) + "," + ctx.serialize(node.name) + ")";
  },
  deserialize(node, ctx) {
    return new DOMException(
      ctx.deserialize(node.message),
      ctx.deserialize(node.name)
    );
  }
});
var dom_exception_default = DOMExceptionPlugin;

// web/event.ts
var import_seroval4 = require("seroval");
function createEventOptions(current) {
  return {
    bubbles: current.bubbles,
    cancelable: current.cancelable,
    composed: current.composed
  };
}
var EventPlugin = /* @__PURE__ */ (0, import_seroval4.createPlugin)({
  tag: "seroval-plugins/web/Event",
  test(value) {
    if (typeof Event === "undefined") {
      return false;
    }
    return value instanceof Event;
  },
  parse: {
    sync(value, ctx) {
      return {
        type: ctx.parse(value.type),
        options: ctx.parse(createEventOptions(value))
      };
    },
    async async(value, ctx) {
      return {
        type: await ctx.parse(value.type),
        options: await ctx.parse(createEventOptions(value))
      };
    },
    stream(value, ctx) {
      return {
        type: ctx.parse(value.type),
        options: ctx.parse(createEventOptions(value))
      };
    }
  },
  serialize(node, ctx) {
    return "new Event(" + ctx.serialize(node.type) + "," + ctx.serialize(node.options) + ")";
  },
  deserialize(node, ctx) {
    return new Event(
      ctx.deserialize(node.type),
      ctx.deserialize(node.options)
    );
  }
});
var event_default = EventPlugin;

// web/file.ts
var import_seroval5 = require("seroval");
var FilePlugin = /* @__PURE__ */ (0, import_seroval5.createPlugin)({
  tag: "seroval-plugins/web/File",
  test(value) {
    if (typeof File === "undefined") {
      return false;
    }
    return value instanceof File;
  },
  parse: {
    async async(value, ctx) {
      return {
        name: await ctx.parse(value.name),
        options: await ctx.parse({
          type: value.type,
          lastModified: value.lastModified
        }),
        buffer: await ctx.parse(await value.arrayBuffer())
      };
    }
  },
  serialize(node, ctx) {
    return "new File([" + ctx.serialize(node.buffer) + "]," + ctx.serialize(node.name) + "," + ctx.serialize(node.options) + ")";
  },
  deserialize(node, ctx) {
    return new File(
      [ctx.deserialize(node.buffer)],
      ctx.deserialize(node.name),
      ctx.deserialize(node.options)
    );
  }
});
var file_default = FilePlugin;

// web/form-data.ts
var import_seroval6 = require("seroval");
function convertFormData(instance) {
  const items = [];
  instance.forEach((value, key) => {
    items.push([key, value]);
  });
  return items;
}
var FORM_DATA_FACTORY = {};
var FormDataFactoryPlugin = /* @__PURE__ */ (0, import_seroval6.createPlugin)({
  tag: "seroval-plugins/web/FormDataFactory",
  test(value) {
    return value === FORM_DATA_FACTORY;
  },
  parse: {
    sync() {
      return void 0;
    },
    async async() {
      return await Promise.resolve(void 0);
    },
    stream() {
      return void 0;
    }
  },
  serialize(_node, ctx) {
    return ctx.createEffectfulFunction(
      ["e", "f", "i", "s", "t"],
      "f=new FormData;for(i=0,s=e.length;i<s;i++)f.append((t=e[i])[0],t[1]);return f"
    );
  },
  deserialize() {
    return FORM_DATA_FACTORY;
  }
});
var FormDataPlugin = /* @__PURE__ */ (0, import_seroval6.createPlugin)({
  tag: "seroval-plugins/web/FormData",
  extends: [file_default, FormDataFactoryPlugin],
  test(value) {
    if (typeof FormData === "undefined") {
      return false;
    }
    return value instanceof FormData;
  },
  parse: {
    sync(value, ctx) {
      return {
        factory: ctx.parse(FORM_DATA_FACTORY),
        entries: ctx.parse(convertFormData(value))
      };
    },
    async async(value, ctx) {
      return {
        factory: await ctx.parse(FORM_DATA_FACTORY),
        entries: await ctx.parse(convertFormData(value))
      };
    },
    stream(value, ctx) {
      return {
        factory: ctx.parse(FORM_DATA_FACTORY),
        entries: ctx.parse(convertFormData(value))
      };
    }
  },
  serialize(node, ctx) {
    return "(" + ctx.serialize(node.factory) + ")(" + ctx.serialize(node.entries) + ")";
  },
  deserialize(node, ctx) {
    const instance = new FormData();
    const entries = ctx.deserialize(node.entries);
    for (let i = 0, len = entries.length; i < len; i++) {
      const entry = entries[i];
      instance.append(entry[0], entry[1]);
    }
    return instance;
  }
});
var form_data_default = FormDataPlugin;

// web/headers.ts
var import_seroval7 = require("seroval");
function convertHeaders(instance) {
  const items = [];
  instance.forEach((value, key) => {
    items.push([key, value]);
  });
  return items;
}
var HeadersPlugin = /* @__PURE__ */ (0, import_seroval7.createPlugin)({
  tag: "seroval-plugins/web/Headers",
  test(value) {
    if (typeof Headers === "undefined") {
      return false;
    }
    return value instanceof Headers;
  },
  parse: {
    sync(value, ctx) {
      return ctx.parse(convertHeaders(value));
    },
    async async(value, ctx) {
      return await ctx.parse(convertHeaders(value));
    },
    stream(value, ctx) {
      return ctx.parse(convertHeaders(value));
    }
  },
  serialize(node, ctx) {
    return "new Headers(" + ctx.serialize(node) + ")";
  },
  deserialize(node, ctx) {
    return new Headers(ctx.deserialize(node));
  }
});
var headers_default = HeadersPlugin;

// web/image-data.ts
var import_seroval8 = require("seroval");
var ImageDataPlugin = /* @__PURE__ */ (0, import_seroval8.createPlugin)({
  tag: "seroval-plugins/web/ImageData",
  test(value) {
    if (typeof ImageData === "undefined") {
      return false;
    }
    return value instanceof ImageData;
  },
  parse: {
    sync(value, ctx) {
      return {
        data: ctx.parse(value.data),
        width: ctx.parse(value.width),
        height: ctx.parse(value.height),
        options: ctx.parse({
          colorSpace: value.colorSpace
        })
      };
    },
    async async(value, ctx) {
      return {
        data: await ctx.parse(value.data),
        width: await ctx.parse(value.width),
        height: await ctx.parse(value.height),
        options: await ctx.parse({
          colorSpace: value.colorSpace
        })
      };
    },
    stream(value, ctx) {
      return {
        data: ctx.parse(value.data),
        width: ctx.parse(value.width),
        height: ctx.parse(value.height),
        options: ctx.parse({
          colorSpace: value.colorSpace
        })
      };
    }
  },
  serialize(node, ctx) {
    return "new ImageData(" + ctx.serialize(node.data) + "," + ctx.serialize(node.width) + "," + ctx.serialize(node.height) + "," + ctx.serialize(node.options) + ")";
  },
  deserialize(node, ctx) {
    return new ImageData(
      ctx.deserialize(node.data),
      ctx.deserialize(node.width),
      ctx.deserialize(node.height),
      ctx.deserialize(node.options)
    );
  }
});
var image_data_default = ImageDataPlugin;

// web/readable-stream.ts
var import_seroval9 = require("seroval");
var READABLE_STREAM_FACTORY = {};
var ReadableStreamFactoryPlugin = /* @__PURE__ */ (0, import_seroval9.createPlugin)({
  tag: "seroval-plugins/web/ReadableStreamFactory",
  test(value) {
    return value === READABLE_STREAM_FACTORY;
  },
  parse: {
    sync() {
      return void 0;
    },
    async async() {
      return await Promise.resolve(void 0);
    },
    stream() {
      return void 0;
    }
  },
  serialize(_node, ctx) {
    return ctx.createFunction(
      ["d"],
      "new ReadableStream({start:" + ctx.createEffectfulFunction(
        ["c"],
        "d.on({next:" + ctx.createEffectfulFunction(["v"], "c.enqueue(v)") + ",throw:" + ctx.createEffectfulFunction(["v"], "c.error(v)") + ",return:" + ctx.createEffectfulFunction([], "c.close()") + "})"
      ) + "})"
    );
  },
  deserialize() {
    return READABLE_STREAM_FACTORY;
  }
});
function toStream(value) {
  const stream = (0, import_seroval9.createStream)();
  const reader = value.getReader();
  async function push() {
    try {
      const result = await reader.read();
      if (result.done) {
        stream.return(result.value);
      } else {
        stream.next(result.value);
        await push();
      }
    } catch (error) {
      stream.throw(error);
    }
  }
  push().catch(() => {
  });
  return stream;
}
var ReadableStreamPlugin = /* @__PURE__ */ (0, import_seroval9.createPlugin)({
  tag: "seroval/plugins/web/ReadableStream",
  extends: [ReadableStreamFactoryPlugin],
  test(value) {
    if (typeof ReadableStream === "undefined") {
      return false;
    }
    return value instanceof ReadableStream;
  },
  parse: {
    sync(_value, ctx) {
      return {
        factory: ctx.parse(READABLE_STREAM_FACTORY),
        stream: ctx.parse((0, import_seroval9.createStream)())
      };
    },
    async async(value, ctx) {
      return {
        factory: await ctx.parse(READABLE_STREAM_FACTORY),
        stream: await ctx.parse(toStream(value))
      };
    },
    stream(value, ctx) {
      return {
        factory: ctx.parse(READABLE_STREAM_FACTORY),
        stream: ctx.parse(toStream(value))
      };
    }
  },
  serialize(node, ctx) {
    return "(" + ctx.serialize(node.factory) + ")(" + ctx.serialize(node.stream) + ")";
  },
  deserialize(node, ctx) {
    const stream = ctx.deserialize(node.stream);
    return new ReadableStream({
      start(controller) {
        stream.on({
          next(value) {
            controller.enqueue(value);
          },
          throw(value) {
            controller.error(value);
          },
          return() {
            controller.close();
          }
        });
      }
    });
  }
});
var readable_stream_default = ReadableStreamPlugin;

// web/request.ts
var import_seroval10 = require("seroval");
function createRequestOptions(current, body) {
  return {
    body,
    cache: current.cache,
    credentials: current.credentials,
    headers: current.headers,
    integrity: current.integrity,
    keepalive: current.keepalive,
    method: current.method,
    mode: current.mode,
    redirect: current.redirect,
    referrer: current.referrer,
    referrerPolicy: current.referrerPolicy
  };
}
var RequestPlugin = /* @__PURE__ */ (0, import_seroval10.createPlugin)({
  tag: "seroval-plugins/web/Request",
  extends: [readable_stream_default, headers_default],
  test(value) {
    if (typeof Request === "undefined") {
      return false;
    }
    return value instanceof Request;
  },
  parse: {
    async async(value, ctx) {
      return {
        url: await ctx.parse(value.url),
        options: await ctx.parse(
          createRequestOptions(
            value,
            value.body ? await value.clone().arrayBuffer() : null
          )
        )
      };
    },
    stream(value, ctx) {
      return {
        url: ctx.parse(value.url),
        options: ctx.parse(createRequestOptions(value, value.clone().body))
      };
    }
  },
  serialize(node, ctx) {
    return "new Request(" + ctx.serialize(node.url) + "," + ctx.serialize(node.options) + ")";
  },
  deserialize(node, ctx) {
    return new Request(
      ctx.deserialize(node.url),
      ctx.deserialize(node.options)
    );
  }
});
var request_default = RequestPlugin;

// web/response.ts
var import_seroval11 = require("seroval");
function createResponseOptions(current) {
  return {
    headers: current.headers,
    status: current.status,
    statusText: current.statusText
  };
}
var ResponsePlugin = /* @__PURE__ */ (0, import_seroval11.createPlugin)({
  tag: "seroval-plugins/web/Response",
  extends: [readable_stream_default, headers_default],
  test(value) {
    if (typeof Response === "undefined") {
      return false;
    }
    return value instanceof Response;
  },
  parse: {
    async async(value, ctx) {
      return {
        body: await ctx.parse(
          value.body ? await value.clone().arrayBuffer() : null
        ),
        options: await ctx.parse(createResponseOptions(value))
      };
    },
    stream(value, ctx) {
      return {
        body: ctx.parse(value.clone().body),
        options: ctx.parse(createResponseOptions(value))
      };
    }
  },
  serialize(node, ctx) {
    return "new Response(" + ctx.serialize(node.body) + "," + ctx.serialize(node.options) + ")";
  },
  deserialize(node, ctx) {
    return new Response(
      ctx.deserialize(node.body),
      ctx.deserialize(node.options)
    );
  }
});
var response_default = ResponsePlugin;

// web/url-search-params.ts
var import_seroval12 = require("seroval");
var URLSearchParamsPlugin = /* @__PURE__ */ (0, import_seroval12.createPlugin)({
  tag: "seroval-plugins/web/URLSearchParams",
  test(value) {
    if (typeof URLSearchParams === "undefined") {
      return false;
    }
    return value instanceof URLSearchParams;
  },
  parse: {
    sync(value, ctx) {
      return ctx.parse(value.toString());
    },
    async async(value, ctx) {
      return await ctx.parse(value.toString());
    },
    stream(value, ctx) {
      return ctx.parse(value.toString());
    }
  },
  serialize(node, ctx) {
    return "new URLSearchParams(" + ctx.serialize(node) + ")";
  },
  deserialize(node, ctx) {
    return new URLSearchParams(ctx.deserialize(node));
  }
});
var url_search_params_default = URLSearchParamsPlugin;

// web/url.ts
var import_seroval13 = require("seroval");
var URLPlugin = /* @__PURE__ */ (0, import_seroval13.createPlugin)({
  tag: "seroval-plugins/web/URL",
  test(value) {
    if (typeof URL === "undefined") {
      return false;
    }
    return value instanceof URL;
  },
  parse: {
    sync(value, ctx) {
      return ctx.parse(value.href);
    },
    async async(value, ctx) {
      return await ctx.parse(value.href);
    },
    stream(value, ctx) {
      return ctx.parse(value.href);
    }
  },
  serialize(node, ctx) {
    return "new URL(" + ctx.serialize(node) + ")";
  },
  deserialize(node, ctx) {
    return new URL(ctx.deserialize(node));
  }
});
var url_default = URLPlugin;
//# sourceMappingURL=web.cjs.map

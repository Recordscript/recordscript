// src/core/compat.ts
var Feature = /* @__PURE__ */ ((Feature2) => {
  Feature2[Feature2["AggregateError"] = 1] = "AggregateError";
  Feature2[Feature2["ArrowFunction"] = 2] = "ArrowFunction";
  Feature2[Feature2["ErrorPrototypeStack"] = 4] = "ErrorPrototypeStack";
  Feature2[Feature2["ObjectAssign"] = 8] = "ObjectAssign";
  Feature2[Feature2["BigIntTypedArray"] = 16] = "BigIntTypedArray";
  return Feature2;
})(Feature || {});
var ALL_ENABLED = 31;

// src/core/utils/assert.ts
function assert(cond, error) {
  if (!cond) {
    throw error;
  }
}

// src/core/string.ts
function serializeChar(str) {
  switch (str) {
    case '"':
      return '\\"';
    case "\\":
      return "\\\\";
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "\b":
      return "\\b";
    case "	":
      return "\\t";
    case "\f":
      return "\\f";
    case "<":
      return "\\x3C";
    case "\u2028":
      return "\\u2028";
    case "\u2029":
      return "\\u2029";
    default:
      return void 0;
  }
}
function serializeString(str) {
  let result = "";
  let lastPos = 0;
  let replacement;
  for (let i = 0, len = str.length; i < len; i++) {
    replacement = serializeChar(str[i]);
    if (replacement) {
      result += str.slice(lastPos, i) + replacement;
      lastPos = i + 1;
    }
  }
  if (lastPos === 0) {
    result = str;
  } else {
    result += str.slice(lastPos);
  }
  return result;
}
function deserializeReplacer(str) {
  switch (str) {
    case "\\\\":
      return "\\";
    case '\\"':
      return '"';
    case "\\n":
      return "\n";
    case "\\r":
      return "\r";
    case "\\b":
      return "\b";
    case "\\t":
      return "	";
    case "\\f":
      return "\f";
    case "\\x3C":
      return "<";
    case "\\u2028":
      return "\u2028";
    case "\\u2029":
      return "\u2029";
    default:
      return str;
  }
}
function deserializeString(str) {
  return str.replace(
    /(\\\\|\\"|\\n|\\r|\\b|\\t|\\f|\\u2028|\\u2029|\\x3C)/g,
    deserializeReplacer
  );
}

// src/core/keys.ts
var REFERENCES_KEY = "__SEROVAL_REFS__";
var GLOBAL_CONTEXT_REFERENCES = "$R";
var GLOBAL_CONTEXT_R = `self.${GLOBAL_CONTEXT_REFERENCES}`;
function getCrossReferenceHeader(id) {
  if (id == null) {
    return `${GLOBAL_CONTEXT_R}=${GLOBAL_CONTEXT_R}||[]`;
  }
  return `(${GLOBAL_CONTEXT_R}=${GLOBAL_CONTEXT_R}||{})["${serializeString(
    id
  )}"]=[]`;
}

// src/core/reference.ts
var REFERENCE = /* @__PURE__ */ new Map();
var INV_REFERENCE = /* @__PURE__ */ new Map();
function createReference(id, value) {
  REFERENCE.set(value, id);
  INV_REFERENCE.set(id, value);
  return value;
}
function hasReferenceID(value) {
  return REFERENCE.has(value);
}
function hasReference(id) {
  return INV_REFERENCE.has(id);
}
function getReferenceID(value) {
  assert(hasReferenceID(value), new SerovalMissingReferenceError(value));
  return REFERENCE.get(value);
}
function getReference(id) {
  assert(hasReference(id), new SerovalMissingReferenceForIdError(id));
  return INV_REFERENCE.get(id);
}
if (typeof globalThis !== "undefined") {
  Object.defineProperty(globalThis, REFERENCES_KEY, {
    value: INV_REFERENCE,
    configurable: true,
    writable: false,
    enumerable: false
  });
} else if (typeof window !== "undefined") {
  Object.defineProperty(window, REFERENCES_KEY, {
    value: INV_REFERENCE,
    configurable: true,
    writable: false,
    enumerable: false
  });
} else if (typeof self !== "undefined") {
  Object.defineProperty(self, REFERENCES_KEY, {
    value: INV_REFERENCE,
    configurable: true,
    writable: false,
    enumerable: false
  });
} else if (typeof global !== "undefined") {
  Object.defineProperty(global, REFERENCES_KEY, {
    value: INV_REFERENCE,
    configurable: true,
    writable: false,
    enumerable: false
  });
}

// src/core/plugin.ts
function createPlugin(plugin) {
  return plugin;
}
function dedupePlugins(deduped, plugins) {
  for (let i = 0, len = plugins.length; i < len; i++) {
    const current = plugins[i];
    if (!deduped.has(current)) {
      deduped.add(current);
      if (current.extends) {
        dedupePlugins(deduped, current.extends);
      }
    }
  }
}
function resolvePlugins(plugins) {
  if (plugins) {
    const deduped = /* @__PURE__ */ new Set();
    dedupePlugins(deduped, plugins);
    return [...deduped];
  }
  return void 0;
}

// src/core/constants.ts
var SYMBOL_STRING = {
  [0 /* AsyncIterator */]: "Symbol.asyncIterator",
  [1 /* HasInstance */]: "Symbol.hasInstance",
  [2 /* IsConcatSpreadable */]: "Symbol.isConcatSpreadable",
  [3 /* Iterator */]: "Symbol.iterator",
  [4 /* Match */]: "Symbol.match",
  [5 /* MatchAll */]: "Symbol.matchAll",
  [6 /* Replace */]: "Symbol.replace",
  [7 /* Search */]: "Symbol.search",
  [8 /* Species */]: "Symbol.species",
  [9 /* Split */]: "Symbol.split",
  [10 /* ToPrimitive */]: "Symbol.toPrimitive",
  [11 /* ToStringTag */]: "Symbol.toStringTag",
  [12 /* Unscopables */]: "Symbol.unscopables"
};
var INV_SYMBOL_REF = {
  [Symbol.asyncIterator]: 0 /* AsyncIterator */,
  [Symbol.hasInstance]: 1 /* HasInstance */,
  [Symbol.isConcatSpreadable]: 2 /* IsConcatSpreadable */,
  [Symbol.iterator]: 3 /* Iterator */,
  [Symbol.match]: 4 /* Match */,
  [Symbol.matchAll]: 5 /* MatchAll */,
  [Symbol.replace]: 6 /* Replace */,
  [Symbol.search]: 7 /* Search */,
  [Symbol.species]: 8 /* Species */,
  [Symbol.split]: 9 /* Split */,
  [Symbol.toPrimitive]: 10 /* ToPrimitive */,
  [Symbol.toStringTag]: 11 /* ToStringTag */,
  [Symbol.unscopables]: 12 /* Unscopables */
};
var SYMBOL_REF = {
  [0 /* AsyncIterator */]: Symbol.asyncIterator,
  [1 /* HasInstance */]: Symbol.hasInstance,
  [2 /* IsConcatSpreadable */]: Symbol.isConcatSpreadable,
  [3 /* Iterator */]: Symbol.iterator,
  [4 /* Match */]: Symbol.match,
  [5 /* MatchAll */]: Symbol.matchAll,
  [6 /* Replace */]: Symbol.replace,
  [7 /* Search */]: Symbol.search,
  [8 /* Species */]: Symbol.species,
  [9 /* Split */]: Symbol.split,
  [10 /* ToPrimitive */]: Symbol.toPrimitive,
  [11 /* ToStringTag */]: Symbol.toStringTag,
  [12 /* Unscopables */]: Symbol.unscopables
};
var CONSTANT_STRING = {
  [2 /* True */]: "!0",
  [3 /* False */]: "!1",
  [1 /* Undefined */]: "void 0",
  [0 /* Null */]: "null",
  [4 /* NegativeZero */]: "-0",
  [5 /* Infinity */]: "1/0",
  [6 /* NegativeInfinity */]: "-1/0",
  [7 /* NaN */]: "0/0"
};
var CONSTANT_VAL = {
  [2 /* True */]: true,
  [3 /* False */]: false,
  [1 /* Undefined */]: void 0,
  [0 /* Null */]: null,
  [4 /* NegativeZero */]: -0,
  [5 /* Infinity */]: Infinity,
  [6 /* NegativeInfinity */]: -Infinity,
  [7 /* NaN */]: NaN
};
var ERROR_CONSTRUCTOR_STRING = {
  [0 /* Error */]: "Error",
  [1 /* EvalError */]: "EvalError",
  [2 /* RangeError */]: "RangeError",
  [3 /* ReferenceError */]: "ReferenceError",
  [4 /* SyntaxError */]: "SyntaxError",
  [5 /* TypeError */]: "TypeError",
  [6 /* URIError */]: "URIError"
};
var ERROR_CONSTRUCTOR = {
  [0 /* Error */]: Error,
  [1 /* EvalError */]: EvalError,
  [2 /* RangeError */]: RangeError,
  [3 /* ReferenceError */]: ReferenceError,
  [4 /* SyntaxError */]: SyntaxError,
  [5 /* TypeError */]: TypeError,
  [6 /* URIError */]: URIError
};

// src/core/literals.ts
function createConstantNode(value) {
  return {
    t: 2 /* Constant */,
    i: void 0,
    s: value,
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
var TRUE_NODE = /* @__PURE__ */ createConstantNode(
  2 /* True */
);
var FALSE_NODE = /* @__PURE__ */ createConstantNode(
  3 /* False */
);
var UNDEFINED_NODE = /* @__PURE__ */ createConstantNode(
  1 /* Undefined */
);
var NULL_NODE = /* @__PURE__ */ createConstantNode(
  0 /* Null */
);
var NEG_ZERO_NODE = /* @__PURE__ */ createConstantNode(
  4 /* NegativeZero */
);
var INFINITY_NODE = /* @__PURE__ */ createConstantNode(
  5 /* Infinity */
);
var NEG_INFINITY_NODE = /* @__PURE__ */ createConstantNode(
  6 /* NegativeInfinity */
);
var NAN_NODE = /* @__PURE__ */ createConstantNode(7 /* NaN */);

// src/core/utils/error.ts
function getErrorConstructor(error) {
  if (error instanceof EvalError) {
    return 1 /* EvalError */;
  }
  if (error instanceof RangeError) {
    return 2 /* RangeError */;
  }
  if (error instanceof ReferenceError) {
    return 3 /* ReferenceError */;
  }
  if (error instanceof SyntaxError) {
    return 4 /* SyntaxError */;
  }
  if (error instanceof TypeError) {
    return 5 /* TypeError */;
  }
  if (error instanceof URIError) {
    return 6 /* URIError */;
  }
  return 0 /* Error */;
}
function getInitialErrorOptions(error) {
  const construct = ERROR_CONSTRUCTOR_STRING[getErrorConstructor(error)];
  if (error.name !== construct) {
    return { name: error.name };
  }
  if (error.constructor.name !== construct) {
    return { name: error.constructor.name };
  }
  return {};
}
function getErrorOptions(error, features) {
  let options = getInitialErrorOptions(error);
  const names = Object.getOwnPropertyNames(error);
  for (let i = 0, len = names.length, name; i < len; i++) {
    name = names[i];
    if (name !== "name" && name !== "message") {
      if (name === "stack") {
        if (features & 4 /* ErrorPrototypeStack */) {
          options = options || {};
          options[name] = error[name];
        }
      } else {
        options = options || {};
        options[name] = error[name];
      }
    }
  }
  return options;
}

// src/core/utils/get-object-flag.ts
function getObjectFlag(obj) {
  if (Object.isFrozen(obj)) {
    return 3 /* Frozen */;
  }
  if (Object.isSealed(obj)) {
    return 2 /* Sealed */;
  }
  if (Object.isExtensible(obj)) {
    return 0 /* None */;
  }
  return 1 /* NonExtensible */;
}

// src/core/base-primitives.ts
function createNumberNode(value) {
  switch (value) {
    case Infinity:
      return INFINITY_NODE;
    case -Infinity:
      return NEG_INFINITY_NODE;
  }
  if (value !== value) {
    return NAN_NODE;
  }
  if (Object.is(value, -0)) {
    return NEG_ZERO_NODE;
  }
  return {
    t: 0 /* Number */,
    i: void 0,
    s: value,
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createStringNode(value) {
  return {
    t: 1 /* String */,
    i: void 0,
    s: serializeString(value),
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createBigIntNode(current) {
  return {
    t: 3 /* BigInt */,
    i: void 0,
    s: "" + current,
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createIndexedValueNode(id) {
  return {
    t: 4 /* IndexedValue */,
    i: id,
    s: void 0,
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createDateNode(id, current) {
  return {
    t: 5 /* Date */,
    i: id,
    s: current.toISOString(),
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    f: void 0,
    a: void 0,
    b: void 0,
    o: void 0
  };
}
function createRegExpNode(id, current) {
  return {
    t: 6 /* RegExp */,
    i: id,
    s: void 0,
    l: void 0,
    c: serializeString(current.source),
    m: current.flags,
    p: void 0,
    e: void 0,
    a: void 0,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createArrayBufferNode(id, current) {
  const bytes = new Uint8Array(current);
  const len = bytes.length;
  const values = new Array(len);
  for (let i = 0; i < len; i++) {
    values[i] = bytes[i];
  }
  return {
    t: 19 /* ArrayBuffer */,
    i: id,
    s: values,
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createWKSymbolNode(id, current) {
  return {
    t: 17 /* WKSymbol */,
    i: id,
    s: INV_SYMBOL_REF[current],
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createReferenceNode(id, ref) {
  return {
    t: 18 /* Reference */,
    i: id,
    s: serializeString(getReferenceID(ref)),
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createPluginNode(id, tag, value) {
  return {
    t: 25 /* Plugin */,
    i: id,
    s: value,
    l: void 0,
    c: serializeString(tag),
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createArrayNode(id, current, parsedItems) {
  return {
    t: 9 /* Array */,
    i: id,
    s: void 0,
    l: current.length,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: parsedItems,
    f: void 0,
    b: void 0,
    o: getObjectFlag(current)
  };
}
function createBoxedNode(id, boxed) {
  return {
    t: 21 /* Boxed */,
    i: id,
    s: void 0,
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: boxed,
    b: void 0,
    o: void 0
  };
}
function createTypedArrayNode(id, current, buffer) {
  return {
    t: 15 /* TypedArray */,
    i: id,
    s: void 0,
    l: current.length,
    c: current.constructor.name,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: buffer,
    b: current.byteOffset,
    o: void 0
  };
}
function createBigIntTypedArrayNode(id, current, buffer) {
  return {
    t: 16 /* BigIntTypedArray */,
    i: id,
    s: void 0,
    l: current.length,
    c: current.constructor.name,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: buffer,
    b: current.byteOffset,
    o: void 0
  };
}
function createDataViewNode(id, current, buffer) {
  return {
    t: 20 /* DataView */,
    i: id,
    s: void 0,
    l: current.byteLength,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: buffer,
    b: current.byteOffset,
    o: void 0
  };
}
function createErrorNode(id, current, options) {
  return {
    t: 13 /* Error */,
    i: id,
    s: getErrorConstructor(current),
    l: void 0,
    c: void 0,
    m: serializeString(current.message),
    p: options,
    e: void 0,
    a: void 0,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createAggregateErrorNode(id, current, options) {
  return {
    t: 14 /* AggregateError */,
    i: id,
    s: getErrorConstructor(current),
    l: void 0,
    c: void 0,
    m: serializeString(current.message),
    p: options,
    e: void 0,
    a: void 0,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createSetNode(id, size, items) {
  return {
    t: 7 /* Set */,
    i: id,
    s: void 0,
    l: size,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: items,
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createIteratorFactoryInstanceNode(factory, items) {
  return {
    t: 28 /* IteratorFactoryInstance */,
    i: void 0,
    s: void 0,
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: [factory, items],
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createAsyncIteratorFactoryInstanceNode(factory, items) {
  return {
    t: 30 /* AsyncIteratorFactoryInstance */,
    i: void 0,
    s: void 0,
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: [factory, items],
    f: void 0,
    b: void 0,
    o: void 0
  };
}
function createStreamConstructorNode(id, factory, sequence) {
  return {
    t: 31 /* StreamConstructor */,
    i: id,
    s: void 0,
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: sequence,
    f: factory,
    b: void 0,
    o: void 0
  };
}
function createStreamNextNode(id, parsed) {
  return {
    t: 32 /* StreamNext */,
    i: id,
    s: void 0,
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: parsed,
    b: void 0,
    o: void 0
  };
}
function createStreamThrowNode(id, parsed) {
  return {
    t: 33 /* StreamThrow */,
    i: id,
    s: void 0,
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: parsed,
    b: void 0,
    o: void 0
  };
}
function createStreamReturnNode(id, parsed) {
  return {
    t: 34 /* StreamReturn */,
    i: id,
    s: void 0,
    l: void 0,
    c: void 0,
    m: void 0,
    p: void 0,
    e: void 0,
    a: void 0,
    f: parsed,
    b: void 0,
    o: void 0
  };
}

// src/core/utils/iterator-to-sequence.ts
function iteratorToSequence(source) {
  const values = [];
  let throwsAt = -1;
  let doneAt = -1;
  const iterator = source[Symbol.iterator]();
  while (true) {
    try {
      const value = iterator.next();
      values.push(value.value);
      if (value.done) {
        doneAt = values.length - 1;
        break;
      }
    } catch (error) {
      throwsAt = values.length;
      values.push(error);
    }
  }
  return {
    v: values,
    t: throwsAt,
    d: doneAt
  };
}
function sequenceToIterator(sequence) {
  return () => {
    let index = 0;
    return {
      [Symbol.iterator]() {
        return this;
      },
      next() {
        if (index > sequence.d) {
          return {
            done: true,
            value: void 0
          };
        }
        const currentIndex = index++;
        const currentItem = sequence.v[currentIndex];
        if (currentIndex === sequence.t) {
          throw currentItem;
        }
        return {
          done: currentIndex === sequence.d,
          value: currentItem
        };
      }
    };
  };
}

// src/core/special-reference.ts
var ITERATOR = {};
var ASYNC_ITERATOR = {};
var SPECIAL_REFS = {
  [0 /* MapSentinel */]: {},
  [1 /* PromiseConstructor */]: {},
  [2 /* PromiseResolve */]: {},
  [3 /* PromiseReject */]: {},
  [4 /* StreamConstructor */]: {}
};

// src/core/errors.ts
var { toString: objectToString } = Object.prototype;
function getErrorMessage(type, cause) {
  if (cause instanceof Error) {
    return `Seroval caught an error during the ${type} process.
  
${cause.name}
${cause.message}

- For more information, please check the "cause" property of this error.
- If you believe this is an error in Seroval, please submit an issue at https://github.com/lxsmnsyc/seroval/issues/new`;
  }
  return `Seroval caught an error during the ${type} process.

"${objectToString.call(cause)}"

For more information, please check the "cause" property of this error.`;
}
var SerovalError = class extends Error {
  constructor(type, cause) {
    super(getErrorMessage(type, cause));
    this.cause = cause;
  }
};
var SerovalParserError = class extends SerovalError {
  constructor(cause) {
    super("parsing", cause);
  }
};
var SerovalSerializationError = class extends SerovalError {
  constructor(cause) {
    super("serialization", cause);
  }
};
var SerovalDeserializationError = class extends SerovalError {
  constructor(cause) {
    super("deserialization", cause);
  }
};
var SerovalUnsupportedTypeError = class extends Error {
  constructor(value) {
    super(
      `The value ${objectToString.call(value)} of type "${typeof value}" cannot be parsed/serialized.
      
There are few workarounds for this problem:
- Transform the value in a way that it can be serialized.
- If the reference is present on multiple runtimes (isomorphic), you can use the Reference API to map the references.`
    );
    this.value = value;
  }
};
var SerovalUnsupportedNodeError = class extends Error {
  constructor(node) {
    super('Unsupported node type "' + node.t + '".');
  }
};
var SerovalMissingPluginError = class extends Error {
  constructor(tag) {
    super('Missing plugin for tag "' + tag + '".');
  }
};
var SerovalMissingInstanceError = class extends Error {
  constructor(tag) {
    super('Missing "' + tag + '" instance.');
  }
};
var SerovalMissingReferenceError = class extends Error {
  constructor(value) {
    super(
      'Missing reference for the value "' + objectToString.call(value) + '" of type "' + typeof value + '"'
    );
    this.value = value;
  }
};
var SerovalMissingReferenceForIdError = class extends Error {
  constructor(id) {
    super('Missing reference for id "' + serializeString(id) + '"');
  }
};
var SerovalUnknownTypedArrayError = class extends Error {
  constructor(name) {
    super('Unknown TypedArray "' + name + '"');
  }
};

// src/core/context/parser.ts
var BaseParserContext = class {
  constructor(options) {
    this.marked = /* @__PURE__ */ new Set();
    this.plugins = options.plugins;
    this.features = ALL_ENABLED ^ (options.disabledFeatures || 0);
    this.refs = options.refs || /* @__PURE__ */ new Map();
  }
  markRef(id) {
    this.marked.add(id);
  }
  isMarked(id) {
    return this.marked.has(id);
  }
  getIndexedValue(current) {
    const registeredId = this.refs.get(current);
    if (registeredId != null) {
      this.markRef(registeredId);
      return {
        type: 1 /* Indexed */,
        value: createIndexedValueNode(registeredId)
      };
    }
    const id = this.refs.size;
    this.refs.set(current, id);
    return {
      type: 0 /* Fresh */,
      value: id
    };
  }
  getReference(current) {
    const indexed = this.getIndexedValue(current);
    if (indexed.type === 1 /* Indexed */) {
      return indexed;
    }
    if (hasReferenceID(current)) {
      return {
        type: 2 /* Referenced */,
        value: createReferenceNode(indexed.value, current)
      };
    }
    return indexed;
  }
  getStrictReference(current) {
    assert(hasReferenceID(current), new SerovalUnsupportedTypeError(current));
    const result = this.getIndexedValue(current);
    if (result.type === 1 /* Indexed */) {
      return result.value;
    }
    return createReferenceNode(result.value, current);
  }
  parseFunction(current) {
    return this.getStrictReference(current);
  }
  parseWellKnownSymbol(current) {
    const ref = this.getReference(current);
    if (ref.type !== 0 /* Fresh */) {
      return ref.value;
    }
    assert(current in INV_SYMBOL_REF, new SerovalUnsupportedTypeError(current));
    return createWKSymbolNode(ref.value, current);
  }
  parseSpecialReference(ref) {
    const result = this.getIndexedValue(SPECIAL_REFS[ref]);
    if (result.type === 1 /* Indexed */) {
      return result.value;
    }
    return {
      t: 26 /* SpecialReference */,
      i: result.value,
      s: ref,
      l: void 0,
      c: void 0,
      m: void 0,
      p: void 0,
      e: void 0,
      a: void 0,
      f: void 0,
      b: void 0,
      o: void 0
    };
  }
  parseIteratorFactory() {
    const result = this.getIndexedValue(ITERATOR);
    if (result.type === 1 /* Indexed */) {
      return result.value;
    }
    return {
      t: 27 /* IteratorFactory */,
      i: result.value,
      s: void 0,
      l: void 0,
      c: void 0,
      m: void 0,
      p: void 0,
      e: void 0,
      a: void 0,
      f: this.parseWellKnownSymbol(Symbol.iterator),
      b: void 0,
      o: void 0
    };
  }
  parseAsyncIteratorFactory() {
    const result = this.getIndexedValue(ASYNC_ITERATOR);
    if (result.type === 1 /* Indexed */) {
      return result.value;
    }
    return {
      t: 29 /* AsyncIteratorFactory */,
      i: result.value,
      s: void 0,
      l: void 0,
      c: void 0,
      m: void 0,
      p: void 0,
      e: void 0,
      a: [
        this.parseSpecialReference(1 /* PromiseConstructor */),
        this.parseWellKnownSymbol(Symbol.asyncIterator)
      ],
      f: void 0,
      b: void 0,
      o: void 0
    };
  }
  createObjectNode(id, current, empty, record) {
    return {
      t: empty ? 11 /* NullConstructor */ : 10 /* Object */,
      i: id,
      s: void 0,
      l: void 0,
      c: void 0,
      m: void 0,
      p: record,
      e: void 0,
      a: void 0,
      f: void 0,
      b: void 0,
      o: getObjectFlag(current)
    };
  }
  createMapNode(id, k, v, s) {
    return {
      t: 8 /* Map */,
      i: id,
      s: void 0,
      l: void 0,
      c: void 0,
      m: void 0,
      p: void 0,
      e: { k, v, s },
      a: void 0,
      f: this.parseSpecialReference(0 /* MapSentinel */),
      b: void 0,
      o: void 0
    };
  }
  createPromiseConstructorNode(id) {
    return {
      t: 22 /* PromiseConstructor */,
      i: id,
      s: void 0,
      l: void 0,
      c: void 0,
      m: void 0,
      p: void 0,
      e: void 0,
      a: void 0,
      f: this.parseSpecialReference(1 /* PromiseConstructor */),
      b: void 0,
      o: void 0
    };
  }
};

// src/core/utils/promise-to-result.ts
async function promiseToResult(current) {
  try {
    return [1, await current];
  } catch (e) {
    return [0, e];
  }
}

// src/core/utils/deferred.ts
function createDeferred() {
  let resolve;
  let reject;
  return {
    promise: new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    }),
    resolve(value) {
      resolve(value);
    },
    reject(value) {
      reject(value);
    }
  };
}

// src/core/stream.ts
function isStream(value) {
  return "__SEROVAL_STREAM__" in value;
}
function createStream() {
  const listeners = /* @__PURE__ */ new Set();
  const buffer = [];
  let alive = true;
  let success = false;
  function flushNext(value) {
    for (const listener of listeners.keys()) {
      listener.next(value);
    }
  }
  function flushThrow(value) {
    for (const listener of listeners.keys()) {
      listener.throw(value);
    }
  }
  function flushReturn(value) {
    for (const listener of listeners.keys()) {
      listener.return(value);
    }
  }
  return {
    __SEROVAL_STREAM__: true,
    on(listener) {
      if (alive) {
        listeners.add(listener);
      }
      for (let i = 0, len = buffer.length; i < len; i++) {
        const value = buffer[i];
        if (i === len - 1) {
          if (success) {
            listener.return(value);
          } else {
            listener.throw(value);
          }
        } else {
          listener.next(value);
        }
      }
      return () => {
        if (alive) {
          listeners.delete(listener);
        }
      };
    },
    next(value) {
      if (alive) {
        buffer.push(value);
        flushNext(value);
      }
    },
    throw(value) {
      if (alive) {
        buffer.push(value);
        flushThrow(value);
        alive = false;
        success = false;
        listeners.clear();
      }
    },
    return(value) {
      if (alive) {
        buffer.push(value);
        flushReturn(value);
        alive = false;
        success = true;
        listeners.clear();
      }
    }
  };
}
function createStreamFromAsyncIterable(iterable) {
  const stream = createStream();
  const iterator = iterable[Symbol.asyncIterator]();
  async function push() {
    try {
      const value = await iterator.next();
      if (value.done) {
        stream.return(value.value);
      } else {
        stream.next(value.value);
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
function streamToAsyncIterable(stream) {
  return () => {
    const buffer = [];
    const pending = [];
    let count = 0;
    let doneAt = -1;
    let isThrow = false;
    function resolveAll() {
      for (let i = 0, len = pending.length; i < len; i++) {
        pending[i].resolve({ done: true, value: void 0 });
      }
    }
    stream.on({
      next(value) {
        const current = pending.shift();
        if (current) {
          current.resolve({ done: false, value });
        }
        buffer.push(value);
      },
      throw(value) {
        const current = pending.shift();
        if (current) {
          current.reject(value);
        }
        resolveAll();
        doneAt = buffer.length;
        buffer.push(value);
        isThrow = true;
      },
      return(value) {
        const current = pending.shift();
        if (current) {
          current.resolve({ done: true, value });
        }
        resolveAll();
        doneAt = buffer.length;
        buffer.push(value);
      }
    });
    function finalize() {
      const current = count++;
      const value = buffer[current];
      if (current !== doneAt) {
        return { done: false, value };
      }
      if (isThrow) {
        throw value;
      }
      return { done: true, value };
    }
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next() {
        if (doneAt === -1) {
          const current = count++;
          if (current >= buffer.length) {
            const deferred = createDeferred();
            pending.push(deferred);
            return await deferred.promise;
          }
          return { done: false, value: buffer[current] };
        }
        if (count > doneAt) {
          return { done: true, value: void 0 };
        }
        return finalize();
      }
    };
  };
}

// src/core/context/parser/async.ts
var BaseAsyncParserContext = class extends BaseParserContext {
  async parseItems(current) {
    const nodes = [];
    for (let i = 0, len = current.length; i < len; i++) {
      if (i in current) {
        nodes[i] = await this.parse(current[i]);
      }
    }
    return nodes;
  }
  async parseArray(id, current) {
    return createArrayNode(id, current, await this.parseItems(current));
  }
  async parseProperties(properties) {
    const entries = Object.entries(properties);
    const keyNodes = [];
    const valueNodes = [];
    for (let i = 0, len = entries.length; i < len; i++) {
      keyNodes.push(serializeString(entries[i][0]));
      valueNodes.push(await this.parse(entries[i][1]));
    }
    let symbol = Symbol.iterator;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(
        createIteratorFactoryInstanceNode(
          this.parseIteratorFactory(),
          await this.parse(
            iteratorToSequence(properties)
          )
        )
      );
    }
    symbol = Symbol.asyncIterator;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(
        createAsyncIteratorFactoryInstanceNode(
          this.parseAsyncIteratorFactory(),
          await this.parse(
            createStreamFromAsyncIterable(
              properties
            )
          )
        )
      );
    }
    symbol = Symbol.toStringTag;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(createStringNode(properties[symbol]));
    }
    symbol = Symbol.isConcatSpreadable;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(properties[symbol] ? TRUE_NODE : FALSE_NODE);
    }
    return {
      k: keyNodes,
      v: valueNodes,
      s: keyNodes.length
    };
  }
  async parsePlainObject(id, current, empty) {
    return this.createObjectNode(
      id,
      current,
      empty,
      await this.parseProperties(current)
    );
  }
  async parseBoxed(id, current) {
    return createBoxedNode(id, await this.parse(current.valueOf()));
  }
  async parseTypedArray(id, current) {
    return createTypedArrayNode(id, current, await this.parse(current.buffer));
  }
  async parseBigIntTypedArray(id, current) {
    return createBigIntTypedArrayNode(
      id,
      current,
      await this.parse(current.buffer)
    );
  }
  async parseDataView(id, current) {
    return createDataViewNode(id, current, await this.parse(current.buffer));
  }
  async parseError(id, current) {
    const options = getErrorOptions(current, this.features);
    return createErrorNode(
      id,
      current,
      options ? await this.parseProperties(options) : void 0
    );
  }
  async parseAggregateError(id, current) {
    const options = getErrorOptions(current, this.features);
    return createAggregateErrorNode(
      id,
      current,
      options ? await this.parseProperties(options) : void 0
    );
  }
  async parseMap(id, current) {
    const keyNodes = [];
    const valueNodes = [];
    for (const [key, value] of current.entries()) {
      keyNodes.push(await this.parse(key));
      valueNodes.push(await this.parse(value));
    }
    return this.createMapNode(id, keyNodes, valueNodes, current.size);
  }
  async parseSet(id, current) {
    const items = [];
    for (const item of current.keys()) {
      items.push(await this.parse(item));
    }
    return createSetNode(id, current.size, items);
  }
  async parsePromise(id, current) {
    const [status, result] = await promiseToResult(current);
    return {
      t: 12 /* Promise */,
      i: id,
      s: status,
      l: void 0,
      c: void 0,
      m: void 0,
      p: void 0,
      e: void 0,
      a: void 0,
      f: await this.parse(result),
      b: void 0,
      o: void 0
    };
  }
  async parsePlugin(id, current) {
    const currentPlugins = this.plugins;
    if (currentPlugins) {
      for (let i = 0, len = currentPlugins.length; i < len; i++) {
        const plugin = currentPlugins[i];
        if (plugin.parse.async && plugin.test(current)) {
          return createPluginNode(
            id,
            plugin.tag,
            await plugin.parse.async(current, this, {
              id
            })
          );
        }
      }
    }
    return void 0;
  }
  async parseStream(id, current) {
    return createStreamConstructorNode(
      id,
      this.parseSpecialReference(4 /* StreamConstructor */),
      await new Promise((resolve, reject) => {
        const sequence = [];
        const cleanup = current.on({
          next: (value) => {
            this.markRef(id);
            this.parse(value).then(
              (data) => {
                sequence.push(createStreamNextNode(id, data));
              },
              (data) => {
                reject(data);
                cleanup();
              }
            );
          },
          throw: (value) => {
            this.markRef(id);
            this.parse(value).then(
              (data) => {
                sequence.push(createStreamThrowNode(id, data));
                resolve(sequence);
                cleanup();
              },
              (data) => {
                reject(data);
                cleanup();
              }
            );
          },
          return: (value) => {
            this.markRef(id);
            this.parse(value).then(
              (data) => {
                sequence.push(createStreamReturnNode(id, data));
                resolve(sequence);
                cleanup();
              },
              (data) => {
                reject(data);
                cleanup();
              }
            );
          }
        });
      })
    );
  }
  async parseObject(id, current) {
    if (Array.isArray(current)) {
      return this.parseArray(id, current);
    }
    if (isStream(current)) {
      return this.parseStream(id, current);
    }
    const parsed = await this.parsePlugin(id, current);
    if (parsed) {
      return parsed;
    }
    const currentClass = current.constructor;
    switch (currentClass) {
      case Object:
        return this.parsePlainObject(
          id,
          current,
          false
        );
      case void 0:
        return this.parsePlainObject(
          id,
          current,
          true
        );
      case Date:
        return createDateNode(id, current);
      case RegExp:
        return createRegExpNode(id, current);
      case Error:
      case EvalError:
      case RangeError:
      case ReferenceError:
      case SyntaxError:
      case TypeError:
      case URIError:
        return this.parseError(id, current);
      case Number:
      case Boolean:
      case String:
      case BigInt:
        return this.parseBoxed(id, current);
      case ArrayBuffer:
        return createArrayBufferNode(id, current);
      case Int8Array:
      case Int16Array:
      case Int32Array:
      case Uint8Array:
      case Uint16Array:
      case Uint32Array:
      case Uint8ClampedArray:
      case Float32Array:
      case Float64Array:
        return this.parseTypedArray(id, current);
      case DataView:
        return this.parseDataView(id, current);
      case Map:
        return this.parseMap(id, current);
      case Set:
        return this.parseSet(id, current);
      default:
        break;
    }
    if (currentClass === Promise || current instanceof Promise) {
      return this.parsePromise(id, current);
    }
    const currentFeatures = this.features;
    if (currentFeatures & 16 /* BigIntTypedArray */) {
      switch (currentClass) {
        case BigInt64Array:
        case BigUint64Array:
          return this.parseBigIntTypedArray(
            id,
            current
          );
        default:
          break;
      }
    }
    if (currentFeatures & 1 /* AggregateError */ && typeof AggregateError !== "undefined" && (currentClass === AggregateError || current instanceof AggregateError)) {
      return this.parseAggregateError(id, current);
    }
    if (current instanceof Error) {
      return this.parseError(id, current);
    }
    if (Symbol.iterator in current || Symbol.asyncIterator in current) {
      return this.parsePlainObject(id, current, !!currentClass);
    }
    throw new SerovalUnsupportedTypeError(current);
  }
  async parse(current) {
    try {
      switch (typeof current) {
        case "boolean":
          return current ? TRUE_NODE : FALSE_NODE;
        case "undefined":
          return UNDEFINED_NODE;
        case "string":
          return createStringNode(current);
        case "number":
          return createNumberNode(current);
        case "bigint":
          return createBigIntNode(current);
        case "object": {
          if (current) {
            const ref = this.getReference(current);
            return ref.type === 0 ? await this.parseObject(ref.value, current) : ref.value;
          }
          return NULL_NODE;
        }
        case "symbol":
          return this.parseWellKnownSymbol(current);
        case "function":
          return this.parseFunction(current);
        default:
          throw new SerovalUnsupportedTypeError(current);
      }
    } catch (error) {
      throw new SerovalParserError(error);
    }
  }
};

// src/core/tree/async.ts
var AsyncParserContext = class extends BaseAsyncParserContext {
  constructor() {
    super(...arguments);
    this.mode = "vanilla";
  }
};

// src/core/utils/typed-array.ts
function getTypedArrayConstructor(name) {
  switch (name) {
    case "Int8Array":
      return Int8Array;
    case "Int16Array":
      return Int16Array;
    case "Int32Array":
      return Int32Array;
    case "Uint8Array":
      return Uint8Array;
    case "Uint16Array":
      return Uint16Array;
    case "Uint32Array":
      return Uint32Array;
    case "Uint8ClampedArray":
      return Uint8ClampedArray;
    case "Float32Array":
      return Float32Array;
    case "Float64Array":
      return Float64Array;
    case "BigInt64Array":
      return BigInt64Array;
    case "BigUint64Array":
      return BigUint64Array;
    default:
      throw new SerovalUnknownTypedArrayError(name);
  }
}

// src/core/context/deserializer.ts
function applyObjectFlag(obj, flag) {
  switch (flag) {
    case 3 /* Frozen */:
      return Object.freeze(obj);
    case 1 /* NonExtensible */:
      return Object.preventExtensions(obj);
    case 2 /* Sealed */:
      return Object.seal(obj);
    default:
      return obj;
  }
}
var BaseDeserializerContext = class {
  constructor(options) {
    this.plugins = options.plugins;
    this.refs = options.refs || /* @__PURE__ */ new Map();
  }
  deserializeReference(node) {
    return this.assignIndexedValue(
      node.i,
      getReference(deserializeString(node.s))
    );
  }
  deserializeArray(node) {
    const len = node.l;
    const result = this.assignIndexedValue(
      node.i,
      new Array(len)
    );
    let item;
    for (let i = 0; i < len; i++) {
      item = node.a[i];
      if (item) {
        result[i] = this.deserialize(item);
      }
    }
    applyObjectFlag(result, node.o);
    return result;
  }
  deserializeProperties(node, result) {
    const len = node.s;
    if (len) {
      const keys = node.k;
      const vals = node.v;
      for (let i = 0, key; i < len; i++) {
        key = keys[i];
        if (typeof key === "string") {
          result[deserializeString(key)] = this.deserialize(vals[i]);
        } else {
          result[this.deserialize(key)] = this.deserialize(vals[i]);
        }
      }
    }
    return result;
  }
  deserializeObject(node) {
    const result = this.assignIndexedValue(
      node.i,
      node.t === 10 /* Object */ ? {} : /* @__PURE__ */ Object.create(null)
    );
    this.deserializeProperties(node.p, result);
    applyObjectFlag(result, node.o);
    return result;
  }
  deserializeDate(node) {
    return this.assignIndexedValue(node.i, new Date(node.s));
  }
  deserializeRegExp(node) {
    return this.assignIndexedValue(
      node.i,
      new RegExp(deserializeString(node.c), node.m)
    );
  }
  deserializeSet(node) {
    const result = this.assignIndexedValue(node.i, /* @__PURE__ */ new Set());
    const items = node.a;
    for (let i = 0, len = node.l; i < len; i++) {
      result.add(this.deserialize(items[i]));
    }
    return result;
  }
  deserializeMap(node) {
    const result = this.assignIndexedValue(node.i, /* @__PURE__ */ new Map());
    const keys = node.e.k;
    const vals = node.e.v;
    for (let i = 0, len = node.e.s; i < len; i++) {
      result.set(this.deserialize(keys[i]), this.deserialize(vals[i]));
    }
    return result;
  }
  deserializeArrayBuffer(node) {
    const bytes = new Uint8Array(node.s);
    const result = this.assignIndexedValue(node.i, bytes.buffer);
    return result;
  }
  deserializeTypedArray(node) {
    const construct = getTypedArrayConstructor(node.c);
    const source = this.deserialize(node.f);
    const result = this.assignIndexedValue(
      node.i,
      new construct(source, node.b, node.l)
    );
    return result;
  }
  deserializeDataView(node) {
    const source = this.deserialize(node.f);
    const result = this.assignIndexedValue(
      node.i,
      new DataView(source, node.b, node.l)
    );
    return result;
  }
  deserializeDictionary(node, result) {
    if (node.p) {
      const fields = this.deserializeProperties(node.p, {});
      Object.assign(result, fields);
    }
    return result;
  }
  deserializeAggregateError(node) {
    const result = this.assignIndexedValue(
      node.i,
      new AggregateError([], deserializeString(node.m))
    );
    return this.deserializeDictionary(node, result);
  }
  deserializeError(node) {
    const construct = ERROR_CONSTRUCTOR[node.s];
    const result = this.assignIndexedValue(
      node.i,
      new construct(deserializeString(node.m))
    );
    return this.deserializeDictionary(node, result);
  }
  deserializePromise(node) {
    const deferred = createDeferred();
    const result = this.assignIndexedValue(node.i, deferred);
    const deserialized = this.deserialize(node.f);
    if (node.s) {
      deferred.resolve(deserialized);
    } else {
      deferred.reject(deserialized);
    }
    return result.promise;
  }
  deserializeBoxed(node) {
    return this.assignIndexedValue(node.i, Object(this.deserialize(node.f)));
  }
  deserializePlugin(node) {
    const currentPlugins = this.plugins;
    if (currentPlugins) {
      const tag = deserializeString(node.c);
      for (let i = 0, len = currentPlugins.length; i < len; i++) {
        const plugin = currentPlugins[i];
        if (plugin.tag === tag) {
          return this.assignIndexedValue(
            node.i,
            plugin.deserialize(node.s, this, {
              id: node.i
            })
          );
        }
      }
    }
    throw new SerovalMissingPluginError(node.c);
  }
  deserializePromiseConstructor(node) {
    return this.assignIndexedValue(node.i, createDeferred()).promise;
  }
  deserializePromiseResolve(node) {
    const deferred = this.refs.get(node.i);
    assert(deferred, new SerovalMissingInstanceError("Promise"));
    deferred.resolve(this.deserialize(node.a[1]));
    return void 0;
  }
  deserializePromiseReject(node) {
    const deferred = this.refs.get(node.i);
    assert(deferred, new SerovalMissingInstanceError("Promise"));
    deferred.reject(this.deserialize(node.a[1]));
    return void 0;
  }
  deserializeIteratorFactoryInstance(node) {
    this.deserialize(node.a[0]);
    const source = this.deserialize(node.a[1]);
    return sequenceToIterator(source);
  }
  deserializeAsyncIteratorFactoryInstance(node) {
    this.deserialize(node.a[0]);
    const source = this.deserialize(node.a[1]);
    return streamToAsyncIterable(source);
  }
  deserializeStreamConstructor(node) {
    const result = this.assignIndexedValue(node.i, createStream());
    const len = node.a.length;
    if (len) {
      for (let i = 0; i < len; i++) {
        this.deserialize(node.a[i]);
      }
    }
    return result;
  }
  deserializeStreamNext(node) {
    const deferred = this.refs.get(node.i);
    assert(deferred, new SerovalMissingInstanceError("Stream"));
    deferred.next(this.deserialize(node.f));
    return void 0;
  }
  deserializeStreamThrow(node) {
    const deferred = this.refs.get(node.i);
    assert(deferred, new SerovalMissingInstanceError("Stream"));
    deferred.throw(this.deserialize(node.f));
    return void 0;
  }
  deserializeStreamReturn(node) {
    const deferred = this.refs.get(node.i);
    assert(deferred, new SerovalMissingInstanceError("Stream"));
    deferred.return(this.deserialize(node.f));
    return void 0;
  }
  deserializeIteratorFactory(node) {
    this.deserialize(node.f);
    return void 0;
  }
  deserializeAsyncIteratorFactory(node) {
    this.deserialize(node.a[1]);
    return void 0;
  }
  deserialize(node) {
    try {
      switch (node.t) {
        case 2 /* Constant */:
          return CONSTANT_VAL[node.s];
        case 0 /* Number */:
          return node.s;
        case 1 /* String */:
          return deserializeString(node.s);
        case 3 /* BigInt */:
          return BigInt(node.s);
        case 4 /* IndexedValue */:
          return this.refs.get(node.i);
        case 18 /* Reference */:
          return this.deserializeReference(node);
        case 9 /* Array */:
          return this.deserializeArray(node);
        case 10 /* Object */:
        case 11 /* NullConstructor */:
          return this.deserializeObject(node);
        case 5 /* Date */:
          return this.deserializeDate(node);
        case 6 /* RegExp */:
          return this.deserializeRegExp(node);
        case 7 /* Set */:
          return this.deserializeSet(node);
        case 8 /* Map */:
          return this.deserializeMap(node);
        case 19 /* ArrayBuffer */:
          return this.deserializeArrayBuffer(node);
        case 16 /* BigIntTypedArray */:
        case 15 /* TypedArray */:
          return this.deserializeTypedArray(node);
        case 20 /* DataView */:
          return this.deserializeDataView(node);
        case 14 /* AggregateError */:
          return this.deserializeAggregateError(node);
        case 13 /* Error */:
          return this.deserializeError(node);
        case 12 /* Promise */:
          return this.deserializePromise(node);
        case 17 /* WKSymbol */:
          return SYMBOL_REF[node.s];
        case 21 /* Boxed */:
          return this.deserializeBoxed(node);
        case 25 /* Plugin */:
          return this.deserializePlugin(node);
        case 22 /* PromiseConstructor */:
          return this.deserializePromiseConstructor(node);
        case 23 /* PromiseResolve */:
          return this.deserializePromiseResolve(node);
        case 24 /* PromiseReject */:
          return this.deserializePromiseReject(node);
        case 28 /* IteratorFactoryInstance */:
          return this.deserializeIteratorFactoryInstance(node);
        case 30 /* AsyncIteratorFactoryInstance */:
          return this.deserializeAsyncIteratorFactoryInstance(node);
        case 31 /* StreamConstructor */:
          return this.deserializeStreamConstructor(node);
        case 32 /* StreamNext */:
          return this.deserializeStreamNext(node);
        case 33 /* StreamThrow */:
          return this.deserializeStreamThrow(node);
        case 34 /* StreamReturn */:
          return this.deserializeStreamReturn(node);
        case 27 /* IteratorFactory */:
          return this.deserializeIteratorFactory(node);
        case 29 /* AsyncIteratorFactory */:
          return this.deserializeAsyncIteratorFactory(node);
        default:
          throw new SerovalUnsupportedNodeError(node);
      }
    } catch (error) {
      throw new SerovalDeserializationError(error);
    }
  }
};

// src/core/tree/deserializer.ts
var VanillaDeserializerContext = class extends BaseDeserializerContext {
  constructor(options) {
    super(options);
    this.mode = "vanilla";
    this.marked = new Set(options.markedRefs);
  }
  assignIndexedValue(index, value) {
    if (this.marked.has(index)) {
      this.refs.set(index, value);
    }
    return value;
  }
};

// src/core/utils/is-valid-identifier.ts
var IDENTIFIER_CHECK = /^[$A-Z_][0-9A-Z_$]*$/i;
function isValidIdentifier(name) {
  const char = name[0];
  return (char === "$" || char === "_" || char >= "A" && char <= "Z" || char >= "a" && char <= "z") && IDENTIFIER_CHECK.test(name);
}

// src/core/context/serializer.ts
function getAssignmentExpression(assignment) {
  switch (assignment.t) {
    case 0 /* Index */:
      return assignment.s + "=" + assignment.v;
    case 2 /* Set */:
      return assignment.s + ".set(" + assignment.k + "," + assignment.v + ")";
    case 1 /* Add */:
      return assignment.s + ".add(" + assignment.v + ")";
    case 3 /* Delete */:
      return assignment.s + ".delete(" + assignment.k + ")";
  }
}
function mergeAssignments(assignments) {
  const newAssignments = [];
  let current = assignments[0];
  for (let i = 1, len = assignments.length, item, prev = current; i < len; i++) {
    item = assignments[i];
    if (item.t === 0 /* Index */ && item.v === prev.v) {
      current = {
        t: 0 /* Index */,
        s: item.s,
        k: void 0,
        v: getAssignmentExpression(current)
      };
    } else if (item.t === 2 /* Set */ && item.s === prev.s) {
      current = {
        t: 2 /* Set */,
        s: getAssignmentExpression(current),
        k: item.k,
        v: item.v
      };
    } else if (item.t === 1 /* Add */ && item.s === prev.s) {
      current = {
        t: 1 /* Add */,
        s: getAssignmentExpression(current),
        k: void 0,
        v: item.v
      };
    } else if (item.t === 3 /* Delete */ && item.s === prev.s) {
      current = {
        t: 3 /* Delete */,
        s: getAssignmentExpression(current),
        k: item.k,
        v: void 0
      };
    } else {
      newAssignments.push(current);
      current = item;
    }
    prev = item;
  }
  newAssignments.push(current);
  return newAssignments;
}
function resolveAssignments(assignments) {
  if (assignments.length) {
    let result = "";
    const merged = mergeAssignments(assignments);
    for (let i = 0, len = merged.length; i < len; i++) {
      result += getAssignmentExpression(merged[i]) + ",";
    }
    return result;
  }
  return void 0;
}
var NULL_CONSTRUCTOR = "Object.create(null)";
var SET_CONSTRUCTOR = "new Set";
var MAP_CONSTRUCTOR = "new Map";
var PROMISE_RESOLVE = "Promise.resolve";
var PROMISE_REJECT = "Promise.reject";
var OBJECT_FLAG_CONSTRUCTOR = {
  [3 /* Frozen */]: "Object.freeze",
  [2 /* Sealed */]: "Object.seal",
  [1 /* NonExtensible */]: "Object.preventExtensions",
  [0 /* None */]: void 0
};
var BaseSerializerContext = class {
  constructor(options) {
    /**
     * To check if an object is synchronously referencing itself
     * @private
     */
    this.stack = [];
    /**
     * Array of object mutations
     * @private
     */
    this.flags = [];
    /**
     * Array of assignments to be done (used for recursion)
     * @private
     */
    this.assignments = [];
    this.plugins = options.plugins;
    this.features = options.features;
    this.marked = new Set(options.markedRefs);
  }
  createFunction(parameters, body) {
    if (this.features & 2 /* ArrowFunction */) {
      const joined = parameters.length === 1 ? parameters[0] : "(" + parameters.join(",") + ")";
      return joined + "=>" + body;
    }
    return "function(" + parameters.join(",") + "){return " + body + "}";
  }
  createEffectfulFunction(parameters, body) {
    if (this.features & 2 /* ArrowFunction */) {
      const joined = parameters.length === 1 ? parameters[0] : "(" + parameters.join(",") + ")";
      return joined + "=>{" + body + "}";
    }
    return "function(" + parameters.join(",") + "){" + body + "}";
  }
  /**
   * A tiny function that tells if a reference
   * is to be accessed. This is a requirement for
   * deciding whether or not we should generate
   * an identifier for the object
   */
  markRef(id) {
    this.marked.add(id);
  }
  isMarked(id) {
    return this.marked.has(id);
  }
  pushObjectFlag(flag, id) {
    if (flag !== 0 /* None */) {
      this.markRef(id);
      this.flags.push({
        type: flag,
        value: this.getRefParam(id)
      });
    }
  }
  resolveFlags() {
    let result = "";
    for (let i = 0, current = this.flags, len = current.length; i < len; i++) {
      const flag = current[i];
      result += OBJECT_FLAG_CONSTRUCTOR[flag.type] + "(" + flag.value + "),";
    }
    return result;
  }
  resolvePatches() {
    const assignments = resolveAssignments(this.assignments);
    const flags = this.resolveFlags();
    if (assignments) {
      if (flags) {
        return assignments + flags;
      }
      return assignments;
    }
    return flags;
  }
  /**
   * Generates the inlined assignment for the reference
   * This is different from the assignments array as this one
   * signifies creation rather than mutation
   */
  createAssignment(source, value) {
    this.assignments.push({
      t: 0 /* Index */,
      s: source,
      k: void 0,
      v: value
    });
  }
  createAddAssignment(ref, value) {
    this.assignments.push({
      t: 1 /* Add */,
      s: this.getRefParam(ref),
      k: void 0,
      v: value
    });
  }
  createSetAssignment(ref, key, value) {
    this.assignments.push({
      t: 2 /* Set */,
      s: this.getRefParam(ref),
      k: key,
      v: value
    });
  }
  createDeleteAssignment(ref, key) {
    this.assignments.push({
      t: 3 /* Delete */,
      s: this.getRefParam(ref),
      k: key,
      v: void 0
    });
  }
  createArrayAssign(ref, index, value) {
    this.createAssignment(this.getRefParam(ref) + "[" + index + "]", value);
  }
  createObjectAssign(ref, key, value) {
    this.createAssignment(this.getRefParam(ref) + "." + key, value);
  }
  /**
   * Checks if the value is in the stack. Stack here is a reference
   * structure to know if a object is to be accessed in a TDZ.
   */
  isIndexedValueInStack(node) {
    return node.t === 4 /* IndexedValue */ && this.stack.includes(node.i);
  }
  serializeReference(node) {
    return this.assignIndexedValue(
      node.i,
      REFERENCES_KEY + '.get("' + node.s + '")'
    );
  }
  serializeArrayItem(id, item, index) {
    if (item) {
      if (this.isIndexedValueInStack(item)) {
        this.markRef(id);
        this.createArrayAssign(
          id,
          index,
          this.getRefParam(item.i)
        );
        return "";
      }
      return this.serialize(item);
    }
    return "";
  }
  serializeArray(node) {
    const id = node.i;
    if (node.l) {
      this.stack.push(id);
      const list = node.a;
      let values = this.serializeArrayItem(id, list[0], 0);
      let isHoley = values === "";
      for (let i = 1, len = node.l, item; i < len; i++) {
        item = this.serializeArrayItem(id, list[i], i);
        values += "," + item;
        isHoley = item === "";
      }
      this.stack.pop();
      this.pushObjectFlag(node.o, node.i);
      return this.assignIndexedValue(id, "[" + values + (isHoley ? ",]" : "]"));
    }
    return this.assignIndexedValue(id, "[]");
  }
  serializeProperty(source, key, val) {
    if (typeof key === "string") {
      const check = Number(key);
      const isIdentifier = (
        // Test if key is a valid positive number or JS identifier
        // so that we don't have to serialize the key and wrap with brackets
        check >= 0 && // It's also important to consider that if the key is
        // indeed numeric, we need to make sure that when
        // converted back into a string, it's still the same
        // to the original key. This allows us to differentiate
        // keys that has numeric formats but in a different
        // format, which can cause unintentional key declaration
        // Example: { 0x1: 1 } vs { '0x1': 1 }
        check.toString() === key || isValidIdentifier(key)
      );
      if (this.isIndexedValueInStack(val)) {
        const refParam = this.getRefParam(val.i);
        this.markRef(source.i);
        if (isIdentifier && check !== check) {
          this.createObjectAssign(source.i, key, refParam);
        } else {
          this.createArrayAssign(
            source.i,
            isIdentifier ? key : '"' + key + '"',
            refParam
          );
        }
        return "";
      }
      return (isIdentifier ? key : '"' + key + '"') + ":" + this.serialize(val);
    }
    return "[" + this.serialize(key) + "]:" + this.serialize(val);
  }
  serializeProperties(source, record) {
    const len = record.s;
    if (len) {
      const keys = record.k;
      const values = record.v;
      this.stack.push(source.i);
      let result = this.serializeProperty(source, keys[0], values[0]);
      for (let i = 1, item = result; i < len; i++) {
        item = this.serializeProperty(source, keys[i], values[i]);
        result += (item && result && ",") + item;
      }
      this.stack.pop();
      return "{" + result + "}";
    }
    return "{}";
  }
  serializeObject(node) {
    this.pushObjectFlag(node.o, node.i);
    return this.assignIndexedValue(
      node.i,
      this.serializeProperties(node, node.p)
    );
  }
  serializeWithObjectAssign(source, value, serialized) {
    const fields = this.serializeProperties(source, value);
    if (fields !== "{}") {
      return "Object.assign(" + serialized + "," + fields + ")";
    }
    return serialized;
  }
  serializeStringKeyAssignment(source, mainAssignments, key, value) {
    const serialized = this.serialize(value);
    const check = Number(key);
    const isIdentifier = (
      // Test if key is a valid positive number or JS identifier
      // so that we don't have to serialize the key and wrap with brackets
      check >= 0 && // It's also important to consider that if the key is
      // indeed numeric, we need to make sure that when
      // converted back into a string, it's still the same
      // to the original key. This allows us to differentiate
      // keys that has numeric formats but in a different
      // format, which can cause unintentional key declaration
      // Example: { 0x1: 1 } vs { '0x1': 1 }
      check.toString() === key || isValidIdentifier(key)
    );
    if (this.isIndexedValueInStack(value)) {
      if (isIdentifier && check !== check) {
        this.createObjectAssign(source.i, key, serialized);
      } else {
        this.createArrayAssign(
          source.i,
          isIdentifier ? key : '"' + key + '"',
          serialized
        );
      }
    } else {
      const parentAssignment = this.assignments;
      this.assignments = mainAssignments;
      if (isIdentifier && check !== check) {
        this.createObjectAssign(source.i, key, serialized);
      } else {
        this.createArrayAssign(
          source.i,
          isIdentifier ? key : '"' + key + '"',
          serialized
        );
      }
      this.assignments = parentAssignment;
    }
  }
  serializeAssignment(source, mainAssignments, key, value) {
    if (typeof key === "string") {
      this.serializeStringKeyAssignment(source, mainAssignments, key, value);
    } else {
      const parent = this.stack;
      this.stack = [];
      const serialized = this.serialize(value);
      this.stack = parent;
      const parentAssignment = this.assignments;
      this.assignments = mainAssignments;
      this.createArrayAssign(source.i, this.serialize(key), serialized);
      this.assignments = parentAssignment;
    }
  }
  serializeAssignments(source, node) {
    const len = node.s;
    if (len) {
      const mainAssignments = [];
      const keys = node.k;
      const values = node.v;
      this.stack.push(source.i);
      for (let i = 0; i < len; i++) {
        this.serializeAssignment(source, mainAssignments, keys[i], values[i]);
      }
      this.stack.pop();
      return resolveAssignments(mainAssignments);
    }
    return void 0;
  }
  serializeDictionary(node, init) {
    if (node.p) {
      if (this.features & 8 /* ObjectAssign */) {
        init = this.serializeWithObjectAssign(node, node.p, init);
      } else {
        this.markRef(node.i);
        const assignments = this.serializeAssignments(node, node.p);
        if (assignments) {
          return "(" + this.assignIndexedValue(node.i, init) + "," + assignments + this.getRefParam(node.i) + ")";
        }
      }
    }
    return this.assignIndexedValue(node.i, init);
  }
  serializeNullConstructor(node) {
    this.pushObjectFlag(node.o, node.i);
    return this.serializeDictionary(node, NULL_CONSTRUCTOR);
  }
  serializeDate(node) {
    return this.assignIndexedValue(node.i, 'new Date("' + node.s + '")');
  }
  serializeRegExp(node) {
    return this.assignIndexedValue(node.i, "/" + node.c + "/" + node.m);
  }
  serializeSetItem(id, item) {
    if (this.isIndexedValueInStack(item)) {
      this.markRef(id);
      this.createAddAssignment(
        id,
        this.getRefParam(item.i)
      );
      return "";
    }
    return this.serialize(item);
  }
  serializeSet(node) {
    let serialized = SET_CONSTRUCTOR;
    const size = node.l;
    const id = node.i;
    if (size) {
      const items = node.a;
      this.stack.push(id);
      let result = this.serializeSetItem(id, items[0]);
      for (let i = 1, item = result; i < size; i++) {
        item = this.serializeSetItem(id, items[i]);
        result += (item && result && ",") + item;
      }
      this.stack.pop();
      if (result) {
        serialized += "([" + result + "])";
      }
    }
    return this.assignIndexedValue(id, serialized);
  }
  serializeMapEntry(id, key, val, sentinel) {
    if (this.isIndexedValueInStack(key)) {
      const keyRef = this.getRefParam(key.i);
      this.markRef(id);
      if (this.isIndexedValueInStack(val)) {
        const valueRef = this.getRefParam(val.i);
        this.createSetAssignment(id, keyRef, valueRef);
        return "";
      }
      if (val.t !== 4 /* IndexedValue */ && val.i != null && this.isMarked(val.i)) {
        const serialized = "(" + this.serialize(val) + ",[" + sentinel + "," + sentinel + "])";
        this.createSetAssignment(id, keyRef, this.getRefParam(val.i));
        this.createDeleteAssignment(id, sentinel);
        return serialized;
      }
      const parent = this.stack;
      this.stack = [];
      this.createSetAssignment(id, keyRef, this.serialize(val));
      this.stack = parent;
      return "";
    }
    if (this.isIndexedValueInStack(val)) {
      const valueRef = this.getRefParam(val.i);
      this.markRef(id);
      if (key.t !== 4 /* IndexedValue */ && key.i != null && this.isMarked(key.i)) {
        const serialized = "(" + this.serialize(key) + ",[" + sentinel + "," + sentinel + "])";
        this.createSetAssignment(id, this.getRefParam(key.i), valueRef);
        this.createDeleteAssignment(id, sentinel);
        return serialized;
      }
      const parent = this.stack;
      this.stack = [];
      this.createSetAssignment(id, this.serialize(key), valueRef);
      this.stack = parent;
      return "";
    }
    return "[" + this.serialize(key) + "," + this.serialize(val) + "]";
  }
  serializeMap(node) {
    let serialized = MAP_CONSTRUCTOR;
    const size = node.e.s;
    const id = node.i;
    const sentinel = node.f;
    const sentinelId = this.getRefParam(sentinel.i);
    if (size) {
      const keys = node.e.k;
      const vals = node.e.v;
      this.stack.push(id);
      let result = this.serializeMapEntry(id, keys[0], vals[0], sentinelId);
      for (let i = 1, item = result; i < size; i++) {
        item = this.serializeMapEntry(id, keys[i], vals[i], sentinelId);
        result += (item && result && ",") + item;
      }
      this.stack.pop();
      if (result) {
        serialized += "([" + result + "])";
      }
    }
    if (sentinel.t === 26 /* SpecialReference */) {
      this.markRef(sentinel.i);
      serialized = "(" + this.serialize(sentinel) + "," + serialized + ")";
    }
    return this.assignIndexedValue(id, serialized);
  }
  serializeArrayBuffer(node) {
    let result = "new Uint8Array(";
    const buffer = node.s;
    const len = buffer.length;
    if (len) {
      result += "[" + buffer[0];
      for (let i = 1; i < len; i++) {
        result += "," + buffer[i];
      }
      result += "]";
    }
    return this.assignIndexedValue(node.i, result + ").buffer");
  }
  serializeTypedArray(node) {
    return this.assignIndexedValue(
      node.i,
      "new " + node.c + "(" + this.serialize(node.f) + "," + node.b + "," + node.l + ")"
    );
  }
  serializeDataView(node) {
    return this.assignIndexedValue(
      node.i,
      "new DataView(" + this.serialize(node.f) + "," + node.b + "," + node.l + ")"
    );
  }
  serializeAggregateError(node) {
    const id = node.i;
    this.stack.push(id);
    const serialized = this.serializeDictionary(
      node,
      'new AggregateError([],"' + node.m + '")'
    );
    this.stack.pop();
    return serialized;
  }
  serializeError(node) {
    return this.serializeDictionary(
      node,
      "new " + ERROR_CONSTRUCTOR_STRING[node.s] + '("' + node.m + '")'
    );
  }
  serializePromise(node) {
    let serialized;
    const fulfilled = node.f;
    const id = node.i;
    const promiseConstructor = node.s ? PROMISE_RESOLVE : PROMISE_REJECT;
    if (this.isIndexedValueInStack(fulfilled)) {
      const ref = this.getRefParam(fulfilled.i);
      serialized = promiseConstructor + (node.s ? "().then(" + this.createFunction([], ref) + ")" : "().catch(" + this.createEffectfulFunction([], "throw " + ref) + ")");
    } else {
      this.stack.push(id);
      const result = this.serialize(fulfilled);
      this.stack.pop();
      serialized = promiseConstructor + "(" + result + ")";
    }
    return this.assignIndexedValue(id, serialized);
  }
  serializeWellKnownSymbol(node) {
    return this.assignIndexedValue(node.i, SYMBOL_STRING[node.s]);
  }
  serializeBoxed(node) {
    return this.assignIndexedValue(
      node.i,
      "Object(" + this.serialize(node.f) + ")"
    );
  }
  serializePlugin(node) {
    const currentPlugins = this.plugins;
    if (currentPlugins) {
      for (let i = 0, len = currentPlugins.length; i < len; i++) {
        const plugin = currentPlugins[i];
        if (plugin.tag === node.c) {
          return this.assignIndexedValue(
            node.i,
            plugin.serialize(node.s, this, {
              id: node.i
            })
          );
        }
      }
    }
    throw new SerovalMissingPluginError(node.c);
  }
  getConstructor(node) {
    const current = this.serialize(node);
    return current === this.getRefParam(node.i) ? current : "(" + current + ")";
  }
  serializePromiseConstructor(node) {
    return this.assignIndexedValue(node.i, this.getConstructor(node.f) + "()");
  }
  serializePromiseResolve(node) {
    return this.getConstructor(node.a[0]) + "(" + this.getRefParam(node.i) + "," + this.serialize(node.a[1]) + ")";
  }
  serializePromiseReject(node) {
    return this.getConstructor(node.a[0]) + "(" + this.getRefParam(node.i) + "," + this.serialize(node.a[1]) + ")";
  }
  serializeSpecialReferenceValue(ref) {
    switch (ref) {
      case 0 /* MapSentinel */:
        return "[]";
      case 1 /* PromiseConstructor */:
        return this.createFunction(
          ["s", "f", "p"],
          "((p=new Promise(" + this.createEffectfulFunction(["a", "b"], "s=a,f=b") + ")).s=s,p.f=f,p)"
        );
      case 2 /* PromiseResolve */:
        return this.createEffectfulFunction(
          ["p", "d"],
          'p.s(d),p.status="success",p.value=d;delete p.s;delete p.f'
        );
      case 3 /* PromiseReject */:
        return this.createEffectfulFunction(
          ["p", "d"],
          'p.f(d),p.status="failure",p.value=d;delete p.s;delete p.f'
        );
      case 4 /* StreamConstructor */:
        return this.createFunction(
          ["b", "a", "s", "l", "p", "f", "e", "n"],
          "(b=[],a=!0,s=!1,l=[],p=0,f=" + this.createEffectfulFunction(
            ["v", "m", "x"],
            "for(x=0;x<p;x++)l[x]&&l[x][m](v)"
          ) + ",n=" + this.createEffectfulFunction(
            ["o", "x", "z", "c"],
            'for(x=0,z=b.length;x<z;x++)(c=b[x],x===z-1?o[s?"return":"throw"](c):o.next(c))'
          ) + ",e=" + this.createFunction(
            ["o", "t"],
            "(a&&(l[t=p++]=o),n(o)," + this.createEffectfulFunction([], "a&&(l[t]=void 0)") + ")"
          ) + ",{__SEROVAL_STREAM__:!0,on:" + this.createFunction(["o"], "e(o)") + ",next:" + this.createEffectfulFunction(["v"], 'a&&(b.push(v),f(v,"next"))') + ",throw:" + this.createEffectfulFunction(
            ["v"],
            'a&&(b.push(v),f(v,"throw"),a=s=!1,l.length=0)'
          ) + ",return:" + this.createEffectfulFunction(
            ["v"],
            'a&&(b.push(v),f(v,"return"),a=!1,s=!0,l.length=0)'
          ) + "})"
        );
      default:
        return "";
    }
  }
  serializeSpecialReference(node) {
    return this.assignIndexedValue(
      node.i,
      this.serializeSpecialReferenceValue(node.s)
    );
  }
  serializeIteratorFactory(node) {
    let result = "";
    let initialized = false;
    if (node.f.t !== 4 /* IndexedValue */) {
      this.markRef(node.f.i);
      result = "(" + this.serialize(node.f) + ",";
      initialized = true;
    }
    result += this.assignIndexedValue(
      node.i,
      this.createFunction(
        ["s"],
        this.createFunction(
          ["i", "c", "d", "t"],
          "(i=0,t={[" + this.getRefParam(node.f.i) + "]:" + this.createFunction([], "t") + ",next:" + this.createEffectfulFunction(
            [],
            "if(i>s.d)return{done:!0,value:void 0};if(d=s.v[c=i++],c===s.t)throw d;return{done:c===s.d,value:d}"
          ) + "})"
        )
      )
    );
    if (initialized) {
      result += ")";
    }
    return result;
  }
  serializeIteratorFactoryInstance(node) {
    return this.getConstructor(node.a[0]) + "(" + this.serialize(node.a[1]) + ")";
  }
  serializeAsyncIteratorFactory(node) {
    const promise = node.a[0];
    const symbol = node.a[1];
    let result = "";
    if (promise.t !== 4 /* IndexedValue */) {
      this.markRef(promise.i);
      result += "(" + this.serialize(promise);
    }
    if (symbol.t !== 4 /* IndexedValue */) {
      this.markRef(symbol.i);
      result += (result ? "," : "(") + this.serialize(symbol);
    }
    if (result) {
      result += ",";
    }
    const iterator = this.assignIndexedValue(
      node.i,
      this.createFunction(
        ["s"],
        this.createFunction(
          ["b", "c", "p", "d", "e", "t", "f"],
          "(b=[],c=0,p=[],d=-1,e=!1,f=" + this.createEffectfulFunction(
            ["i", "l"],
            "for(i=0,l=p.length;i<l;i++)p[i].s({done:!0,value:void 0})"
          ) + ",s.on({next:" + this.createEffectfulFunction(
            ["v", "t"],
            "if(t=p.shift())t.s({done:!1,value:v});b.push(v)"
          ) + ",throw:" + this.createEffectfulFunction(
            ["v", "t"],
            "if(t=p.shift())t.f(v);f(),d=b.length,e=!0,b.push(v)"
          ) + ",return:" + this.createEffectfulFunction(
            ["v", "t"],
            "if(t=p.shift())t.s({done:!0,value:v});f(),d=b.length,b.push(v)"
          ) + "}),t={[" + this.getRefParam(symbol.i) + "]:" + this.createFunction([], "t") + ",next:" + this.createEffectfulFunction(
            ["i", "t", "v"],
            "if(d===-1){return((i=c++)>=b.length)?(p.push(t=" + this.getRefParam(promise.i) + "()),t):{done:!0,value:b[i]}}if(c>d)return{done:!0,value:void 0};if(v=b[i=c++],i!==d)return{done:!1,value:v};if(e)throw v;return{done:!0,value:v}"
          ) + "})"
        )
      )
    );
    if (result) {
      return result + iterator + ")";
    }
    return iterator;
  }
  serializeAsyncIteratorFactoryInstance(node) {
    return this.getConstructor(node.a[0]) + "(" + this.serialize(node.a[1]) + ")";
  }
  serializeStreamConstructor(node) {
    const result = this.assignIndexedValue(
      node.i,
      this.getConstructor(node.f) + "()"
    );
    const len = node.a.length;
    if (len) {
      let values = this.serialize(node.a[0]);
      for (let i = 1; i < len; i++) {
        values += "," + this.serialize(node.a[i]);
      }
      return "(" + result + "," + values + "," + this.getRefParam(node.i) + ")";
    }
    return result;
  }
  serializeStreamNext(node) {
    return this.getRefParam(node.i) + ".next(" + this.serialize(node.f) + ")";
  }
  serializeStreamThrow(node) {
    return this.getRefParam(node.i) + ".throw(" + this.serialize(node.f) + ")";
  }
  serializeStreamReturn(node) {
    return this.getRefParam(node.i) + ".return(" + this.serialize(node.f) + ")";
  }
  serialize(node) {
    try {
      switch (node.t) {
        case 2 /* Constant */:
          return CONSTANT_STRING[node.s];
        case 0 /* Number */:
          return "" + node.s;
        case 1 /* String */:
          return '"' + node.s + '"';
        case 3 /* BigInt */:
          return node.s + "n";
        case 4 /* IndexedValue */:
          return this.getRefParam(node.i);
        case 18 /* Reference */:
          return this.serializeReference(node);
        case 9 /* Array */:
          return this.serializeArray(node);
        case 10 /* Object */:
          return this.serializeObject(node);
        case 11 /* NullConstructor */:
          return this.serializeNullConstructor(node);
        case 5 /* Date */:
          return this.serializeDate(node);
        case 6 /* RegExp */:
          return this.serializeRegExp(node);
        case 7 /* Set */:
          return this.serializeSet(node);
        case 8 /* Map */:
          return this.serializeMap(node);
        case 19 /* ArrayBuffer */:
          return this.serializeArrayBuffer(node);
        case 16 /* BigIntTypedArray */:
        case 15 /* TypedArray */:
          return this.serializeTypedArray(node);
        case 20 /* DataView */:
          return this.serializeDataView(node);
        case 14 /* AggregateError */:
          return this.serializeAggregateError(node);
        case 13 /* Error */:
          return this.serializeError(node);
        case 12 /* Promise */:
          return this.serializePromise(node);
        case 17 /* WKSymbol */:
          return this.serializeWellKnownSymbol(node);
        case 21 /* Boxed */:
          return this.serializeBoxed(node);
        case 22 /* PromiseConstructor */:
          return this.serializePromiseConstructor(node);
        case 23 /* PromiseResolve */:
          return this.serializePromiseResolve(node);
        case 24 /* PromiseReject */:
          return this.serializePromiseReject(node);
        case 25 /* Plugin */:
          return this.serializePlugin(node);
        case 26 /* SpecialReference */:
          return this.serializeSpecialReference(node);
        case 27 /* IteratorFactory */:
          return this.serializeIteratorFactory(node);
        case 28 /* IteratorFactoryInstance */:
          return this.serializeIteratorFactoryInstance(node);
        case 29 /* AsyncIteratorFactory */:
          return this.serializeAsyncIteratorFactory(node);
        case 30 /* AsyncIteratorFactoryInstance */:
          return this.serializeAsyncIteratorFactoryInstance(node);
        case 31 /* StreamConstructor */:
          return this.serializeStreamConstructor(node);
        case 32 /* StreamNext */:
          return this.serializeStreamNext(node);
        case 33 /* StreamThrow */:
          return this.serializeStreamThrow(node);
        case 34 /* StreamReturn */:
          return this.serializeStreamReturn(node);
        default:
          throw new SerovalUnsupportedNodeError(node);
      }
    } catch (error) {
      throw new SerovalSerializationError(error);
    }
  }
};

// src/core/utils/get-identifier.ts
var REF_START_CHARS = "hjkmoquxzABCDEFGHIJKLNPQRTUVWXYZ$_";
var REF_START_CHARS_LEN = REF_START_CHARS.length;
var REF_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$_";
var REF_CHARS_LEN = REF_CHARS.length;
function getIdentifier(index) {
  let mod = index % REF_START_CHARS_LEN;
  let ref = REF_START_CHARS[mod];
  index = (index - mod) / REF_START_CHARS_LEN;
  while (index > 0) {
    mod = index % REF_CHARS_LEN;
    ref += REF_CHARS[mod];
    index = (index - mod) / REF_CHARS_LEN;
  }
  return ref;
}

// src/core/tree/serializer.ts
var VanillaSerializerContext = class extends BaseSerializerContext {
  constructor() {
    super(...arguments);
    this.mode = "vanilla";
    /**
     * Map tree refs to actual refs
     * @private
     */
    this.valid = /* @__PURE__ */ new Map();
    /**
     * Variables
     * @private
     */
    this.vars = [];
  }
  /**
   * Creates the reference param (identifier) from the given reference ID
   * Calling this function means the value has been referenced somewhere
   */
  getRefParam(index) {
    let actualIndex = this.valid.get(index);
    if (actualIndex == null) {
      actualIndex = this.valid.size;
      this.valid.set(index, actualIndex);
    }
    let identifier = this.vars[actualIndex];
    if (identifier == null) {
      identifier = getIdentifier(actualIndex);
      this.vars[actualIndex] = identifier;
    }
    return identifier;
  }
  assignIndexedValue(index, value) {
    if (this.isMarked(index)) {
      return this.getRefParam(index) + "=" + value;
    }
    return value;
  }
  serializePromiseConstructor(node) {
    throw new SerovalUnsupportedNodeError(node);
  }
  serializePromiseResolve(node) {
    throw new SerovalUnsupportedNodeError(node);
  }
  serializePromiseReject(node) {
    throw new SerovalUnsupportedNodeError(node);
  }
  serializeTop(tree) {
    const result = this.serialize(tree);
    if (tree.i != null && this.vars.length) {
      const patches = this.resolvePatches();
      let body = result;
      if (patches) {
        const index = this.getRefParam(tree.i);
        body = result + "," + patches + index;
        if (!result.startsWith(index + "=")) {
          body = index + "=" + body;
        }
      }
      return "(" + this.createFunction(this.vars, "(" + body + ")") + ")()";
    }
    if (tree.t === 10 /* Object */) {
      return "(" + result + ")";
    }
    return result;
  }
};

// src/core/context/parser/sync.ts
var BaseSyncParserContext = class extends BaseParserContext {
  parseItems(current) {
    const nodes = [];
    for (let i = 0, len = current.length; i < len; i++) {
      if (i in current) {
        nodes[i] = this.parse(current[i]);
      }
    }
    return nodes;
  }
  parseArray(id, current) {
    return createArrayNode(id, current, this.parseItems(current));
  }
  parseProperties(properties) {
    const entries = Object.entries(properties);
    const keyNodes = [];
    const valueNodes = [];
    for (let i = 0, len = entries.length; i < len; i++) {
      keyNodes.push(serializeString(entries[i][0]));
      valueNodes.push(this.parse(entries[i][1]));
    }
    let symbol = Symbol.iterator;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(
        createIteratorFactoryInstanceNode(
          this.parseIteratorFactory(),
          this.parse(
            iteratorToSequence(properties)
          )
        )
      );
    }
    symbol = Symbol.asyncIterator;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(
        createAsyncIteratorFactoryInstanceNode(
          this.parseAsyncIteratorFactory(),
          this.parse(createStream())
        )
      );
    }
    symbol = Symbol.toStringTag;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(createStringNode(properties[symbol]));
    }
    symbol = Symbol.isConcatSpreadable;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(properties[symbol] ? TRUE_NODE : FALSE_NODE);
    }
    return {
      k: keyNodes,
      v: valueNodes,
      s: keyNodes.length
    };
  }
  parsePlainObject(id, current, empty) {
    return this.createObjectNode(
      id,
      current,
      empty,
      this.parseProperties(current)
    );
  }
  parseBoxed(id, current) {
    return createBoxedNode(id, this.parse(current.valueOf()));
  }
  parseTypedArray(id, current) {
    return createTypedArrayNode(id, current, this.parse(current.buffer));
  }
  parseBigIntTypedArray(id, current) {
    return createBigIntTypedArrayNode(id, current, this.parse(current.buffer));
  }
  parseDataView(id, current) {
    return createDataViewNode(id, current, this.parse(current.buffer));
  }
  parseError(id, current) {
    const options = getErrorOptions(current, this.features);
    return createErrorNode(
      id,
      current,
      options ? this.parseProperties(options) : void 0
    );
  }
  parseAggregateError(id, current) {
    const options = getErrorOptions(current, this.features);
    return createAggregateErrorNode(
      id,
      current,
      options ? this.parseProperties(options) : void 0
    );
  }
  parseMap(id, current) {
    const keyNodes = [];
    const valueNodes = [];
    for (const [key, value] of current.entries()) {
      keyNodes.push(this.parse(key));
      valueNodes.push(this.parse(value));
    }
    return this.createMapNode(id, keyNodes, valueNodes, current.size);
  }
  parseSet(id, current) {
    const items = [];
    for (const item of current.keys()) {
      items.push(this.parse(item));
    }
    return createSetNode(id, current.size, items);
  }
  parsePlugin(id, current) {
    const currentPlugins = this.plugins;
    if (currentPlugins) {
      for (let i = 0, len = currentPlugins.length; i < len; i++) {
        const plugin = currentPlugins[i];
        if (plugin.parse.sync && plugin.test(current)) {
          return createPluginNode(
            id,
            plugin.tag,
            plugin.parse.sync(current, this, {
              id
            })
          );
        }
      }
    }
    return void 0;
  }
  parseStream(id, _current) {
    return createStreamConstructorNode(
      id,
      this.parseSpecialReference(4 /* StreamConstructor */),
      []
    );
  }
  parsePromise(id, _current) {
    return this.createPromiseConstructorNode(id);
  }
  parseObject(id, current) {
    if (Array.isArray(current)) {
      return this.parseArray(id, current);
    }
    if (isStream(current)) {
      return this.parseStream(id, current);
    }
    const parsed = this.parsePlugin(id, current);
    if (parsed) {
      return parsed;
    }
    const currentClass = current.constructor;
    switch (currentClass) {
      case Object:
        return this.parsePlainObject(
          id,
          current,
          false
        );
      case void 0:
        return this.parsePlainObject(
          id,
          current,
          true
        );
      case Date:
        return createDateNode(id, current);
      case RegExp:
        return createRegExpNode(id, current);
      case Error:
      case EvalError:
      case RangeError:
      case ReferenceError:
      case SyntaxError:
      case TypeError:
      case URIError:
        return this.parseError(id, current);
      case Number:
      case Boolean:
      case String:
      case BigInt:
        return this.parseBoxed(id, current);
      case ArrayBuffer:
        return createArrayBufferNode(id, current);
      case Int8Array:
      case Int16Array:
      case Int32Array:
      case Uint8Array:
      case Uint16Array:
      case Uint32Array:
      case Uint8ClampedArray:
      case Float32Array:
      case Float64Array:
        return this.parseTypedArray(id, current);
      case DataView:
        return this.parseDataView(id, current);
      case Map:
        return this.parseMap(id, current);
      case Set:
        return this.parseSet(id, current);
      default:
        break;
    }
    if (currentClass === Promise || current instanceof Promise) {
      return this.parsePromise(id, current);
    }
    const currentFeatures = this.features;
    if (currentFeatures & 16 /* BigIntTypedArray */) {
      switch (currentClass) {
        case BigInt64Array:
        case BigUint64Array:
          return this.parseBigIntTypedArray(
            id,
            current
          );
        default:
          break;
      }
    }
    if (currentFeatures & 1 /* AggregateError */ && typeof AggregateError !== "undefined" && (currentClass === AggregateError || current instanceof AggregateError)) {
      return this.parseAggregateError(id, current);
    }
    if (current instanceof Error) {
      return this.parseError(id, current);
    }
    if (Symbol.iterator in current || Symbol.asyncIterator in current) {
      return this.parsePlainObject(id, current, !!currentClass);
    }
    throw new SerovalUnsupportedTypeError(current);
  }
  parse(current) {
    try {
      switch (typeof current) {
        case "boolean":
          return current ? TRUE_NODE : FALSE_NODE;
        case "undefined":
          return UNDEFINED_NODE;
        case "string":
          return createStringNode(current);
        case "number":
          return createNumberNode(current);
        case "bigint":
          return createBigIntNode(current);
        case "object": {
          if (current) {
            const ref = this.getReference(current);
            return ref.type === 0 ? this.parseObject(ref.value, current) : ref.value;
          }
          return NULL_NODE;
        }
        case "symbol":
          return this.parseWellKnownSymbol(current);
        case "function":
          return this.parseFunction(current);
        default:
          throw new SerovalUnsupportedTypeError(current);
      }
    } catch (error) {
      throw new SerovalParserError(error);
    }
  }
};

// src/core/tree/sync.ts
var SyncParserContext = class extends BaseSyncParserContext {
  constructor() {
    super(...arguments);
    this.mode = "vanilla";
  }
};

// src/core/tree/index.ts
function serialize(source, options = {}) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new SyncParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures
  });
  const tree = ctx.parse(source);
  const serial = new VanillaSerializerContext({
    plugins,
    features: ctx.features,
    markedRefs: ctx.marked
  });
  return serial.serializeTop(tree);
}
async function serializeAsync(source, options = {}) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new AsyncParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures
  });
  const tree = await ctx.parse(source);
  const serial = new VanillaSerializerContext({
    plugins,
    features: ctx.features,
    markedRefs: ctx.marked
  });
  return serial.serializeTop(tree);
}
function deserialize(source) {
  return (0, eval)(source);
}
function toJSON(source, options = {}) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new SyncParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures
  });
  return {
    t: ctx.parse(source),
    f: ctx.features,
    m: Array.from(ctx.marked)
  };
}
async function toJSONAsync(source, options = {}) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new AsyncParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures
  });
  return {
    t: await ctx.parse(source),
    f: ctx.features,
    m: Array.from(ctx.marked)
  };
}
function compileJSON(source, options = {}) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new VanillaSerializerContext({
    plugins,
    features: source.f,
    markedRefs: source.m
  });
  return ctx.serializeTop(source.t);
}
function fromJSON(source, options = {}) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new VanillaDeserializerContext({
    plugins,
    markedRefs: source.m
  });
  return ctx.deserialize(source.t);
}

// src/core/cross/async.ts
var CrossAsyncParserContext = class extends BaseAsyncParserContext {
  constructor() {
    super(...arguments);
    this.mode = "cross";
  }
};

// src/core/cross/deserializer.ts
var CrossDeserializerContext = class extends BaseDeserializerContext {
  constructor() {
    super(...arguments);
    this.mode = "cross";
  }
  assignIndexedValue(index, value) {
    if (!this.refs.has(index)) {
      this.refs.set(index, value);
    }
    return value;
  }
};

// src/core/cross/serializer.ts
var CrossSerializerContext = class extends BaseSerializerContext {
  constructor(options) {
    super(options);
    this.mode = "cross";
    this.scopeId = options.scopeId;
  }
  getRefParam(id) {
    return GLOBAL_CONTEXT_REFERENCES + "[" + id + "]";
  }
  assignIndexedValue(index, value) {
    return this.getRefParam(index) + "=" + value;
  }
  serializeTop(tree) {
    const result = this.serialize(tree);
    const id = tree.i;
    if (id == null) {
      return result;
    }
    const patches = this.resolvePatches();
    const ref = this.getRefParam(id);
    const params = this.scopeId == null ? "" : GLOBAL_CONTEXT_REFERENCES;
    const body = patches ? result + "," + patches + ref : result;
    if (params === "") {
      return patches ? "(" + body + ")" : body;
    }
    const args = this.scopeId == null ? "()" : "(" + GLOBAL_CONTEXT_REFERENCES + '["' + serializeString(this.scopeId) + '"])';
    return "(" + this.createFunction([params], body) + ")" + args;
  }
};

// src/core/context/parser/stream.ts
var BaseStreamParserContext = class extends BaseSyncParserContext {
  constructor(options) {
    super(options);
    // Life
    this.alive = true;
    // Amount of pending promises/streams
    this.pending = 0;
    this.initial = true;
    this.buffer = [];
    this.onParseCallback = options.onParse;
    this.onErrorCallback = options.onError;
    this.onDoneCallback = options.onDone;
  }
  onParseInternal(node, initial) {
    try {
      this.onParseCallback(node, initial);
    } catch (error) {
      this.onError(error);
    }
  }
  flush() {
    for (let i = 0, len = this.buffer.length; i < len; i++) {
      this.onParseInternal(this.buffer[i], false);
    }
  }
  onParse(node) {
    if (this.initial) {
      this.buffer.push(node);
    } else {
      this.onParseInternal(node, false);
    }
  }
  onError(error) {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    } else {
      throw error;
    }
  }
  onDone() {
    if (this.onDoneCallback) {
      this.onDoneCallback();
    }
  }
  pushPendingState() {
    this.pending++;
  }
  popPendingState() {
    if (--this.pending <= 0) {
      this.onDone();
    }
  }
  parseProperties(properties) {
    const entries = Object.entries(properties);
    const keyNodes = [];
    const valueNodes = [];
    for (let i = 0, len = entries.length; i < len; i++) {
      keyNodes.push(serializeString(entries[i][0]));
      valueNodes.push(this.parse(entries[i][1]));
    }
    let symbol = Symbol.iterator;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(
        createIteratorFactoryInstanceNode(
          this.parseIteratorFactory(),
          this.parse(
            iteratorToSequence(properties)
          )
        )
      );
    }
    symbol = Symbol.asyncIterator;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(
        createAsyncIteratorFactoryInstanceNode(
          this.parseAsyncIteratorFactory(),
          this.parse(
            createStreamFromAsyncIterable(
              properties
            )
          )
        )
      );
    }
    symbol = Symbol.toStringTag;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(createStringNode(properties[symbol]));
    }
    symbol = Symbol.isConcatSpreadable;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(properties[symbol] ? TRUE_NODE : FALSE_NODE);
    }
    return {
      k: keyNodes,
      v: valueNodes,
      s: keyNodes.length
    };
  }
  parsePromise(id, current) {
    current.then(
      (data) => {
        const parsed = this.parseWithError(data);
        if (parsed) {
          this.onParse({
            t: 23 /* PromiseResolve */,
            i: id,
            s: void 0,
            l: void 0,
            c: void 0,
            m: void 0,
            p: void 0,
            e: void 0,
            a: [
              this.parseSpecialReference(2 /* PromiseResolve */),
              parsed
            ],
            f: void 0,
            b: void 0,
            o: void 0
          });
        }
        this.popPendingState();
      },
      (data) => {
        if (this.alive) {
          const parsed = this.parseWithError(data);
          if (parsed) {
            this.onParse({
              t: 24 /* PromiseReject */,
              i: id,
              s: void 0,
              l: void 0,
              c: void 0,
              m: void 0,
              p: void 0,
              e: void 0,
              a: [
                this.parseSpecialReference(3 /* PromiseReject */),
                parsed
              ],
              f: void 0,
              b: void 0,
              o: void 0
            });
          }
        }
        this.popPendingState();
      }
    );
    this.pushPendingState();
    return this.createPromiseConstructorNode(id);
  }
  parsePlugin(id, current) {
    const currentPlugins = this.plugins;
    if (currentPlugins) {
      for (let i = 0, len = currentPlugins.length; i < len; i++) {
        const plugin = currentPlugins[i];
        if (plugin.parse.stream && plugin.test(current)) {
          return createPluginNode(
            id,
            plugin.tag,
            plugin.parse.stream(current, this, {
              id
            })
          );
        }
      }
    }
    return void 0;
  }
  parseStream(id, current) {
    const result = createStreamConstructorNode(
      id,
      this.parseSpecialReference(4 /* StreamConstructor */),
      []
    );
    this.pushPendingState();
    current.on({
      next: (value) => {
        if (this.alive) {
          const parsed = this.parseWithError(value);
          if (parsed) {
            this.onParse(createStreamNextNode(id, parsed));
          }
        }
      },
      throw: (value) => {
        if (this.alive) {
          const parsed = this.parseWithError(value);
          if (parsed) {
            this.onParse(createStreamThrowNode(id, parsed));
          }
        }
        this.popPendingState();
      },
      return: (value) => {
        if (this.alive) {
          const parsed = this.parseWithError(value);
          if (parsed) {
            this.onParse(createStreamReturnNode(id, parsed));
          }
        }
        this.popPendingState();
      }
    });
    return result;
  }
  parseWithError(current) {
    try {
      return this.parse(current);
    } catch (err) {
      this.onError(err);
      return void 0;
    }
  }
  /**
   * @private
   */
  start(current) {
    const parsed = this.parseWithError(current);
    if (parsed) {
      this.onParseInternal(parsed, true);
      this.initial = false;
      this.flush();
      if (this.pending <= 0) {
        this.destroy();
      }
    }
  }
  /**
   * @private
   */
  destroy() {
    if (this.alive) {
      this.onDone();
      this.alive = false;
    }
  }
  isAlive() {
    return this.alive;
  }
};

// src/core/cross/stream.ts
var CrossStreamParserContext = class extends BaseStreamParserContext {
  constructor() {
    super(...arguments);
    this.mode = "cross";
  }
};

// src/core/cross/sync.ts
var CrossSyncParserContext = class extends BaseSyncParserContext {
  constructor() {
    super(...arguments);
    this.mode = "cross";
  }
};

// src/core/cross/index.ts
function crossSerialize(source, options = {}) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new CrossSyncParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs
  });
  const tree = ctx.parse(source);
  const serial = new CrossSerializerContext({
    plugins,
    features: ctx.features,
    scopeId: options.scopeId,
    markedRefs: ctx.marked
  });
  return serial.serializeTop(tree);
}
async function crossSerializeAsync(source, options = {}) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new CrossAsyncParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs
  });
  const tree = await ctx.parse(source);
  const serial = new CrossSerializerContext({
    plugins,
    features: ctx.features,
    scopeId: options.scopeId,
    markedRefs: ctx.marked
  });
  return serial.serializeTop(tree);
}
function toCrossJSON(source, options = {}) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new CrossSyncParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs
  });
  return ctx.parse(source);
}
async function toCrossJSONAsync(source, options = {}) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new CrossAsyncParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs
  });
  return await ctx.parse(source);
}
function crossSerializeStream(source, options) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new CrossStreamParserContext({
    plugins,
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
    onParse(node, initial) {
      const serial = new CrossSerializerContext({
        plugins,
        features: ctx.features,
        scopeId: options.scopeId,
        markedRefs: ctx.marked
      });
      let serialized;
      try {
        serialized = serial.serializeTop(node);
      } catch (err) {
        if (options.onError) {
          options.onError(err);
        }
        return;
      }
      options.onSerialize(serialized, initial);
    },
    onError: options.onError,
    onDone: options.onDone
  });
  ctx.start(source);
  return () => {
    ctx.destroy();
  };
}
function toCrossJSONStream(source, options) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new CrossStreamParserContext({
    plugins,
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
    onParse: options.onParse,
    onError: options.onError,
    onDone: options.onDone
  });
  ctx.start(source);
  return () => {
    ctx.destroy();
  };
}
function fromCrossJSON(source, options) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new CrossDeserializerContext({
    plugins,
    refs: options.refs
  });
  return ctx.deserialize(source);
}

// src/core/Serializer.ts
var Serializer = class {
  constructor(options) {
    this.options = options;
    this.alive = true;
    this.flushed = false;
    this.done = false;
    this.pending = 0;
    this.cleanups = [];
    this.refs = /* @__PURE__ */ new Map();
    this.keys = /* @__PURE__ */ new Set();
    this.ids = 0;
    this.plugins = resolvePlugins(options.plugins);
  }
  write(key, value) {
    if (this.alive && !this.flushed) {
      this.pending++;
      this.keys.add(key);
      this.cleanups.push(
        crossSerializeStream(value, {
          plugins: this.plugins,
          scopeId: this.options.scopeId,
          refs: this.refs,
          disabledFeatures: this.options.disabledFeatures,
          onError: this.options.onError,
          onSerialize: (data, initial) => {
            if (this.alive) {
              this.options.onData(
                initial ? this.options.globalIdentifier + '["' + serializeString(key) + '"]=' + data : data
              );
            }
          },
          onDone: () => {
            if (this.alive) {
              this.pending--;
              if (this.pending <= 0 && this.flushed && !this.done && this.options.onDone) {
                this.options.onDone();
                this.done = true;
              }
            }
          }
        })
      );
    }
  }
  getNextID() {
    while (this.keys.has("" + this.ids)) {
      this.ids++;
    }
    return "" + this.ids;
  }
  push(value) {
    const newID = this.getNextID();
    this.write(newID, value);
    return newID;
  }
  flush() {
    if (this.alive) {
      this.flushed = true;
      if (this.pending <= 0 && !this.done && this.options.onDone) {
        this.options.onDone();
        this.done = true;
      }
    }
  }
  close() {
    if (this.alive) {
      for (let i = 0, len = this.cleanups.length; i < len; i++) {
        this.cleanups[i]();
      }
      if (!this.done && this.options.onDone) {
        this.options.onDone();
        this.done = true;
      }
      this.alive = false;
    }
  }
};
export {
  Feature,
  Serializer,
  SerovalDeserializationError,
  SerovalError,
  SerovalMissingInstanceError,
  SerovalMissingPluginError,
  SerovalMissingReferenceError,
  SerovalMissingReferenceForIdError,
  SerovalParserError,
  SerovalSerializationError,
  SerovalUnknownTypedArrayError,
  SerovalUnsupportedNodeError,
  SerovalUnsupportedTypeError,
  compileJSON,
  createPlugin,
  createReference,
  createStream,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  getCrossReferenceHeader,
  resolvePlugins,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync
};
//# sourceMappingURL=index.mjs.map

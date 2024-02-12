import type { SerovalNode } from 'seroval';
interface ReadableStreamNode {
    factory: SerovalNode;
    stream: SerovalNode;
}
declare const ReadableStreamPlugin: import("seroval").Plugin<ReadableStream<any>, ReadableStreamNode>;
export default ReadableStreamPlugin;
//# sourceMappingURL=readable-stream.d.ts.map
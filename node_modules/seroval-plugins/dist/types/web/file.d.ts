import type { SerovalNode } from 'seroval';
interface FileNode {
    name: SerovalNode;
    options: SerovalNode;
    buffer: SerovalNode;
}
declare const FilePlugin: import("seroval").Plugin<File, FileNode>;
export default FilePlugin;
//# sourceMappingURL=file.d.ts.map
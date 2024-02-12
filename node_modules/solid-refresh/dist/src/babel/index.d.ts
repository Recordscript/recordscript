import * as babel from '@babel/core';
import * as t from '@babel/types';
import { RuntimeType } from '../shared/types';
interface Options {
    bundler?: RuntimeType;
    fixRender?: boolean;
}
type ImportHook = Map<string, t.Identifier>;
interface ImportIdentifiers {
    identifiers: Map<t.Identifier, ImportIdentity>;
    namespaces: Map<t.Identifier, ImportIdentity>;
}
interface State extends babel.PluginPass {
    hooks: ImportHook;
    opts: Options;
    processed: boolean;
    granular: boolean;
    imports: ImportIdentifiers;
}
interface ImportIdentity {
    name: string;
    source: string;
}
export default function solidRefreshPlugin(): babel.PluginObj<State>;
export {};

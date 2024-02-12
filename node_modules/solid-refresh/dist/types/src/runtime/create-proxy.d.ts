import type { JSX, Accessor } from 'solid-js';
export interface BaseComponent<P> {
    (props: P): JSX.Element;
}
export default function createProxy<C extends BaseComponent<P>, P>(source: Accessor<C>, name: string, location?: string): (props: P) => JSX.Element;
//# sourceMappingURL=create-proxy.d.ts.map
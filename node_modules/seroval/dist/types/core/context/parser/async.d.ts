import { BaseParserContext } from '../parser';
import type { SerovalNode } from '../../types';
export default abstract class BaseAsyncParserContext extends BaseParserContext {
    private parseItems;
    private parseArray;
    private parseProperties;
    private parsePlainObject;
    private parseBoxed;
    private parseTypedArray;
    private parseBigIntTypedArray;
    private parseDataView;
    private parseError;
    private parseAggregateError;
    private parseMap;
    private parseSet;
    private parsePromise;
    private parsePlugin;
    private parseStream;
    private parseObject;
    parse<T>(current: T): Promise<SerovalNode>;
}
//# sourceMappingURL=async.d.ts.map
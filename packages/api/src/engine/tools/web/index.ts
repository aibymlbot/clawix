/**
 * Web tools registration — registers web_search and web_fetch tools
 * into a ToolRegistry.
 *
 * These tools execute on the host (not inside containers), following
 * the same pattern as the spawn tool.
 */
import type { ToolRegistry } from '../../tool-registry.js';
import type { SearchProviderRegistry } from './search-provider.js';
import { createWebSearchTool } from './web-search.js';
import { createWebFetchTool } from './web-fetch.js';

/**
 * Register web tools (web_search, web_fetch) into the given registry.
 *
 * @param registry               - The ToolRegistry to register tools into.
 * @param searchProviderRegistry - The search provider registry for web_search.
 */
export function registerWebTools(
  registry: ToolRegistry,
  searchProviderRegistry: SearchProviderRegistry,
): void {
  registry.register(createWebSearchTool(searchProviderRegistry));
  registry.register(createWebFetchTool());
}

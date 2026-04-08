/**
 * Provider factory — creates the correct LLM provider by name.
 */

import type { LLMProvider } from '@clawix/shared';

import { AnthropicProvider } from './anthropic-provider.js';
import { OpenAIProvider } from './openai-provider.js';

const ZAI_CODING_DEFAULT_BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

/**
 * Instantiate an {@link LLMProvider} by provider name.
 *
 * Known providers: `'anthropic'`, `'openai'`, `'zai-coding'`.
 * Any other name is treated as an OpenAI-compatible custom provider
 * and requires a `baseURL`.
 */
export function createProvider(
  providerName: string,
  apiKey: string,
  baseURL?: string,
): LLMProvider {
  switch (providerName) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, baseURL);

    case 'openai':
      return new OpenAIProvider(apiKey, baseURL);

    case 'zai-coding':
      return new OpenAIProvider(apiKey, baseURL ?? ZAI_CODING_DEFAULT_BASE_URL);

    default:
      if (!baseURL) {
        throw new Error(`baseURL is required for provider "${providerName}"`);
      }
      return new OpenAIProvider(apiKey, baseURL);
  }
}

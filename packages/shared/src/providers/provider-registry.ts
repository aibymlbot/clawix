/**
 * Provider registry — spec definitions and lookup helpers for LLM providers.
 */

/** Pricing for a specific model (USD per million tokens). */
export interface ModelPricing {
  readonly model: string;
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}

/** Specification for a supported LLM provider. */
export interface ProviderSpec {
  readonly name: string;
  readonly displayName: string;
  readonly modelPrefixes: readonly string[];
  readonly envKey: string;
  /** Optional base URL override; when absent the SDK's built-in default is used. */
  readonly defaultBaseUrl?: string;
  readonly defaultModel: string;
  readonly supportsTools: boolean;
  readonly supportsThinking: boolean;
  readonly pricing: readonly ModelPricing[] | null;
}

const ANTHROPIC_SPEC: ProviderSpec = {
  name: 'anthropic',
  displayName: 'Anthropic',
  modelPrefixes: ['claude-'],
  envKey: 'ANTHROPIC_API_KEY',
  defaultModel: 'claude-sonnet-4-20250514',
  supportsTools: true,
  supportsThinking: true,
  pricing: [
    { model: 'claude-opus-4', inputPerMillion: 15, outputPerMillion: 75 },
    { model: 'claude-sonnet-4', inputPerMillion: 3, outputPerMillion: 15 },
    { model: 'claude-haiku-4', inputPerMillion: 0.8, outputPerMillion: 4 },
  ],
};

const OPENAI_SPEC: ProviderSpec = {
  name: 'openai',
  displayName: 'OpenAI',
  modelPrefixes: ['gpt-', 'o1-', 'o3-', 'o4-'],
  envKey: 'OPENAI_API_KEY',
  defaultModel: 'gpt-4o',
  supportsTools: true,
  supportsThinking: false,
  pricing: [
    { model: 'gpt-4o-mini', inputPerMillion: 0.15, outputPerMillion: 0.6 },
    { model: 'gpt-4o', inputPerMillion: 2.5, outputPerMillion: 10 },
    { model: 'o3-mini', inputPerMillion: 1.1, outputPerMillion: 4.4 },
  ],
};

const ZAI_CODING_SPEC: ProviderSpec = {
  name: 'zai-coding',
  displayName: 'Z.AI Coding Plan',
  modelPrefixes: ['glm-'],
  envKey: 'ZAI_CODING_API_KEY',
  defaultBaseUrl: 'https://api.z.ai/api/coding/paas/v4',
  defaultModel: 'glm-4.7',
  supportsTools: true,
  supportsThinking: false,
  pricing: null,
};

const CUSTOM_SPEC: ProviderSpec = {
  name: 'custom',
  displayName: 'Custom',
  modelPrefixes: [],
  envKey: 'CUSTOM_API_KEY',
  defaultModel: '',
  supportsTools: false,
  supportsThinking: false,
  pricing: null,
};

const PROVIDERS: readonly ProviderSpec[] = [ANTHROPIC_SPEC, OPENAI_SPEC, ZAI_CODING_SPEC, CUSTOM_SPEC];

/**
 * Find a provider spec by its name. Returns null if not found.
 */
export function findProviderByName(name: string): ProviderSpec | null {
  return PROVIDERS.find((p) => p.name === name) ?? null;
}

/**
 * Detect which provider a model belongs to based on prefix matching.
 * Returns null if no provider matches.
 */
export function findProviderByModel(model: string): ProviderSpec | null {
  return PROVIDERS.find((p) => p.modelPrefixes.some((prefix) => model.startsWith(prefix))) ?? null;
}

/**
 * Get a provider spec by name. Throws if not found.
 */
export function getProviderSpec(name: string): ProviderSpec {
  const spec = findProviderByName(name);

  if (spec === null) {
    throw new Error(`Provider "${name}" not found`);
  }

  return spec;
}

/**
 * Returns a list of all registered provider specs.
 * Each call returns a new array (immutability).
 */
export function listProviders(): readonly ProviderSpec[] {
  return [...PROVIDERS];
}

/**
 * Estimate USD cost for a given provider/model/token combination.
 * Returns null if pricing is unavailable.
 */
export function estimateCost(
  providerName: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const spec = findProviderByName(providerName);
  const pricingTable = spec?.pricing;

  if (pricingTable === null || pricingTable === undefined) {
    return null;
  }

  const pricing = pricingTable.find((p) => model.startsWith(p.model));

  if (pricing === undefined) {
    return null;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return inputCost + outputCost;
}

/**
 * @deprecated Use {@link ProviderConfigService.resolveProvider} instead.
 * This module is kept for backward compatibility with tests.
 * It will be removed in a future release.
 */
export function resolveApiKey(provider: string): string {
  const envMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    'zai-coding': 'ZAI_CODING_API_KEY',
  };
  const envVar = envMap[provider] ?? `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
  const key = process.env[envVar];
  if (!key) {
    throw new Error(`Missing API key for provider "${provider}": set ${envVar}`);
  }
  return key;
}

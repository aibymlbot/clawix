/**
 * Shared helper for extracting text from MemoryItem JSON content.
 * Used by: MemoryItemRepository.search, search_memory tool, ContextBuilderService.
 */

/** Extract the text string from a MemoryItem's JSON content. */
export function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content !== null && typeof content === 'object' && !Array.isArray(content)) {
    const obj = content as Record<string, unknown>;
    if (typeof obj['text'] === 'string') return obj['text'];
  }
  return JSON.stringify(content);
}

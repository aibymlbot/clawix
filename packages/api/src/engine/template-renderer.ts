/**
 * Render a template string by replacing {{ key }} placeholders with values.
 *
 * Dot notation (e.g., `{{ user.name }}`) is treated as a flat key lookup —
 * the key `"user.name"` is looked up literally in the vars map, not as
 * nested object traversal.
 *
 * Missing keys resolve to empty string.
 */
export function renderTemplate(template: string, vars: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}

/**
 * Contains pure shelf rules shared by shelf services and tests.
 */
const defaultShelfSlugs = new Set(['currently-reading', 'read', 'unshelved', 'want-to-read']);
/**
 * Enforces the shelf protection rule: Unshelved is the only shelf that cannot be deleted.
 */
export function canDeleteShelf(slug: string): boolean {
  return slug !== 'unshelved';
}
/**
 * Checks whether a slug is one of the code-owned starter shelf slugs.
 */
export function isDefaultShelfSlug(slug: string): boolean {
  return defaultShelfSlugs.has(slug);
}
/**
 * Converts a shelf name into a stable URL-safe slug base.
 */
export function slugifyShelfName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  return slug || 'shelf';
}

const defaultShelfSlugs = new Set(['currently-reading', 'read', 'unshelved', 'want-to-read']);

export function canDeleteShelf(slug: string): boolean {
  return slug !== 'unshelved';
}

export function isDefaultShelfSlug(slug: string): boolean {
  return defaultShelfSlugs.has(slug);
}

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

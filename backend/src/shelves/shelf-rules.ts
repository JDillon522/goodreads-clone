const defaultShelfSlugs = new Set(['currently-reading', 'read', 'want-to-read']);

export function canDeleteShelf(isDefault: boolean): boolean {
  return !isDefault;
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

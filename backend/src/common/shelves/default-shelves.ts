export const defaultShelves = [
  { isDefault: true, name: 'Want to Read', position: 0, slug: 'want-to-read' },
  { isDefault: true, name: 'Currently Reading', position: 1, slug: 'currently-reading' },
  { isDefault: true, name: 'Read', position: 2, slug: 'read' },
] as const;

export type DefaultShelfSlug = (typeof defaultShelves)[number]['slug'];

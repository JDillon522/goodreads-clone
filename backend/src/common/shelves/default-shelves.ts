export const defaultShelves = [
  { isDefault: true, name: 'Unshelved', position: 0, slug: 'unshelved' },
  { isDefault: true, name: 'Want to Read', position: 1, slug: 'want-to-read' },
  { isDefault: true, name: 'Currently Reading', position: 2, slug: 'currently-reading' },
  { isDefault: true, name: 'Read', position: 3, slug: 'read' },
] as const;

export type DefaultShelfSlug = (typeof defaultShelves)[number]['slug'];

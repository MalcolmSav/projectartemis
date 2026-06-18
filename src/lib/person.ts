/**
 * A circle member's public display name. Never exposes their email — falls back
 * to their @username, then a generic label. Use this anywhere you'd otherwise
 * write `profile.name ?? profile.email`.
 */
export function personName(p?: { name?: string | null; username?: string | null } | null): string {
  const name = p?.name?.trim();
  if (name) return name;
  if (p?.username) return `@${p.username}`;
  return 'Circle member';
}

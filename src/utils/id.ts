/**
 * Generate unique ID without external deps (UUID v4 style)
 */
export function generateId(): string {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * 16)];
  }
  return Date.now().toString(36) + '-' + id;
}

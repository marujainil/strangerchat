/**
 * Lightweight profanity filter for the text-chat channel.
 * Real deployments should layer this with an AI moderation hook
 * (see utils/moderation.ts).
 */
const BLOCKLIST = [
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot',
  'rape', 'pedo', 'cp', 'child porn',
];

const leetMap: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '@': 'a', '$': 's' };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[013455@$]/g, (c) => leetMap[c] ?? c)
    .replace(/[^a-z\s]/g, '');
}

export function containsProfanity(text: string): boolean {
  const norm = normalize(text);
  return BLOCKLIST.some((w) => norm.includes(w));
}

export function sanitize(text: string): string {
  let out = text;
  for (const w of BLOCKLIST) {
    out = out.replace(new RegExp(w, 'gi'), '*'.repeat(w.length));
  }
  return out;
}

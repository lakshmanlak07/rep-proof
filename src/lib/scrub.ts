// Removes secrets and personal data from crash text before it leaves the phone. Pure; tested in security.test.ts.
// Crash reports carry only: a scrubbed message, a scrubbed stack, the screen route and app/platform versions.
// Never: passwords, tokens, API keys, emails, request bodies, check-in answers, food or body data.

const RULES: [RegExp, string][] = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(\.[A-Za-z0-9_-]+)?/g, '[jwt]'], // JWTs (access/refresh tokens)
  [/\b(sb_(publishable|secret)_|sk_(live|test)_|pk_(live|test)_|rk_(live|test)_)[A-Za-z0-9_-]+/gi, '[key]'],
  [/(["']?)\b([\w-]*(?:token|password|passwd|secret|apikey|api[_-]?key|authorization))\1\s*[:=]\s*(?:bearer\s+)?("[^"]*"|'[^']*'|[^\s,;&}]+)/gi, '$2=[redacted]'],
  [/\b(bearer|apikey|api[_-]?key|token|password|passwd|secret|authorization)\b(\s*[:=]\s*|\s+)("[^"]*"|'[^']*'|[^\s,;&]+)/gi, '$1=[redacted]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/(https?:\/\/[^\s?#"']+)[?#][^\s"']*/g, '$1?[query]'], // URL query strings can carry tokens
  [/\b[A-Fa-f0-9]{32,}\b/g, '[hex]'],
  [/\b[A-Za-z0-9+/_-]{40,}={0,2}/g, '[blob]'], // long base64-ish strings
  [/\+?\d(?:[\s().-]?\d){9,}/g, '[number]'], // phone numbers and other runs of 10+ digits
];

export function scrub(text: string, max = 500): string {
  let out = String(text ?? '');
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}

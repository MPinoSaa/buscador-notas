// Detecta texto que parece contener credenciales, para avisar al usuario (no bloquea nada).
// Las IPs no cuentan: son comunes en las notas; el backend las oculta antes de usar la IA.
const SENSITIVE_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/i, // usuario:clave@host
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/, // JWT
  /\b(?:AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9_-]{20,})\b/,
  /\b(?:contrase(?:ñ|n)a|clave|password|passwd|pwd|pass|token|secret|api[_ -]?key|llave|credencial(?:es)?)\b(?:\s*(?:[:=]|->)\s*|\s+(?:es|is)\s+)(?!<)\S/i
];

export function looksSensitive(text: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(text));
}

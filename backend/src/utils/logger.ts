const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'slackaccesstoken',
  'secret',
  'authorization',
  'jwt',
  'apikey',
]);

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactValue(v);
      }
    }
    return out;
  }
  return value;
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return '';
  return ` ${JSON.stringify(redactValue(meta))}`;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.log(`${new Date().toISOString()} INFO  ${message}${formatMeta(meta)}`);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(`${new Date().toISOString()} WARN  ${message}${formatMeta(meta)}`);
  },
  error(message: string, meta?: Record<string, unknown>) {
    console.error(`${new Date().toISOString()} ERROR ${message}${formatMeta(meta)}`);
  },
};

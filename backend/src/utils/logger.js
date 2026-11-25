const SENSITIVE_KEYS = new Set([
  'password', 'passwordhash', 'token', 'accesstoken',
  'secret', 'authorization', 'jwt', 'apikey',
]);

function redactValue(value) {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redactValue(v);
    }
    return out;
  }
  return value;
}

function formatMeta(meta) {
  if (!meta || Object.keys(meta).length === 0) return '';
  return ` ${JSON.stringify(redactValue(meta))}`;
}

const logger = {
  info(message, meta)  { console.log(`${new Date().toISOString()} INFO  ${message}${formatMeta(meta)}`); },
  warn(message, meta)  { console.warn(`${new Date().toISOString()} WARN  ${message}${formatMeta(meta)}`); },
  error(message, meta) { console.error(`${new Date().toISOString()} ERROR ${message}${formatMeta(meta)}`); },
};

module.exports = { logger };

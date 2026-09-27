// Cabeceras del servidor de desarrollo/preview; replicarlas en el hosting final.
const origenApi = process.env.METRONET_ORIGEN_API || 'http://127.0.0.1:8080 http://localhost:8080';
if (!origenApi.split(' ').every(origen => /^https?:\/\/[a-zA-Z0-9.:[\]-]+$/.test(origen))) {
  throw new Error('METRONET_ORIGEN_API requiere orígenes HTTP(S) explícitos.');
}
const politica = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:", "font-src 'self'", "media-src 'self' blob:",
  `connect-src 'self' ${origenApi} ws://127.0.0.1:5173 ws://localhost:5173`,
  "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
];
const politicaMeta = politica.join('; ');
const headers = {
  'Content-Security-Policy': `${politicaMeta}; frame-ancestors 'self'`,
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store',
};
module.exports = { headers, politicaMeta };

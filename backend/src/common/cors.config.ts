export type CorsCallback = (err: Error | null, allow?: boolean) => void;

/**
 * Handles CORS origin verification.
 * 
 * Rules:
 * 1. Requests with no origin (e.g. server-to-server, Postman, curl) are allowed.
 * 2. Origins explicitly matching configured allowed origins (via CORS_ORIGIN or default localhost ports) are allowed.
 * 3. Wildcard '*' in CORS_ORIGIN is treated as invalid/unsafe and does NOT allow arbitrary origins.
 * 4. All other unknown/untrusted origins are rejected with an Error.
 */
export function handleCorsOrigin(
  requestOrigin: string | undefined,
  corsOriginEnv: string | undefined,
  callback: CorsCallback,
): void {
  // Allow requests with no origin (like Postman, curl, server-to-server)
  if (!requestOrigin) {
    return callback(null, true);
  }

  const rawAllowed =
    corsOriginEnv && corsOriginEnv.trim() !== ''
      ? corsOriginEnv
      : 'http://localhost:3000,http://localhost:3001';

  const allowedList = rawAllowed
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter((o) => Boolean(o) && o !== '*');

  const cleanOrigin = requestOrigin.replace(/\/$/, '');

  if (allowedList.includes(cleanOrigin)) {
    return callback(null, true);
  }

  return callback(new Error('Not allowed by CORS'), false);
}

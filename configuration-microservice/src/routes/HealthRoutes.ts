import crypto from 'crypto';
import { Router, RequestHandler } from 'express';

type DatabaseStatus = 'connected' | 'disconnected';

interface DatabaseConnection {
  authenticate: () => Promise<unknown>;
}

interface HealthRouterOptions {
  service: string;
  databases: Record<string, DatabaseConnection>;
}

interface Readiness {
  status: 'ready' | 'unavailable';
  service: string;
  databases: Record<string, DatabaseStatus>;
  timestamp: string;
}

const cacheTtl = (): number => {
  const configured = Number(process.env.HEALTHCHECK_CACHE_TTL_MS || 5000);
  const ttl = Number.isFinite(configured) ? configured : 5000;
  return Math.min(Math.max(ttl, 1000), 60000);
};

const presentedToken = (
  authorization?: string,
  headerToken?: string,
): string => {
  if (headerToken) return headerToken;
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
};

const tokenMatches = (
  authorization?: string,
  headerToken?: string,
): boolean => {
  const expected = process.env.HEALTHCHECK_TOKEN;
  if (!expected) return true;
  const presented = presentedToken(authorization, headerToken);
  const expectedBuffer = Buffer.from(expected);
  const presentedBuffer = Buffer.from(presented);
  return expectedBuffer.length === presentedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, presentedBuffer);
};

const createHealthRouter = (
  { service, databases }: HealthRouterOptions,
): Router => {
  const router = Router();
  let cachedReadiness: Readiness | undefined;
  let cacheExpiresAt = 0;
  let pendingReadiness: Promise<Readiness> | undefined;

  const protect: RequestHandler = (request, response, next): void => {
    response.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (!tokenMatches(
      request.get('authorization'),
      request.get('x-healthcheck-token'),
    )) {
      response.status(401).json({ status: 'unauthorized' });
      return;
    }
    next();
  };

  router.get('/health', protect, (_request, response) => {
    response.status(200).json({
      status: 'healthy',
      service,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  const checkReadiness = async (): Promise<Readiness> => {
    const now = Date.now();
    if (cachedReadiness && now < cacheExpiresAt) return cachedReadiness;
    if (pendingReadiness) return pendingReadiness;

    pendingReadiness = Promise.all(Object.keys(databases).map(async name => {
      try {
        await databases[name].authenticate();
        return { name, status: 'connected' as const };
      } catch {
        return { name, status: 'disconnected' as const };
      }
    })).then(checks => {
      const databaseStatuses: Record<string, DatabaseStatus> = {};
      checks.forEach(({ name, status }) => {
        databaseStatuses[name] = status;
      });
      const ready = checks.every(({ status }) => status === 'connected');
      cachedReadiness = {
        status: ready ? 'ready' : 'unavailable',
        service,
        databases: databaseStatuses,
        timestamp: new Date().toISOString(),
      };
      cacheExpiresAt = Date.now() + cacheTtl();
      return cachedReadiness;
    }).finally(() => {
      pendingReadiness = undefined;
    });

    return pendingReadiness;
  };

  router.get('/ready', protect, async (_request, response) => {
    const readiness = await checkReadiness();
    response.status(readiness.status === 'ready' ? 200 : 503).json(readiness);
  });

  return router;
};

export { createHealthRouter };

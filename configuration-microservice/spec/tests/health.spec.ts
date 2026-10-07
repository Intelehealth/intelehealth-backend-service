import express from 'express';
import supertest from 'supertest';

import { createHealthRouter } from '@src/routes/HealthRoutes';


interface HealthBody {
  status: string;
  service?: string;
  databases?: Record<string, string>;
}

describe('Health APIs', () => {

  it('reports that the service process is online', async () => {
    const authenticate = jasmine.createSpy('authenticate');
    const app = express().use(createHealthRouter({
      service: 'configuration-microservice',
      databases: { portal: { authenticate } },
    }));
    const response = await supertest(app).get('/health');

    expect(response.status).toBe(200);
    expect((response.body as HealthBody).status).toBe('healthy');
    expect((response.body as HealthBody).service)
      .toBe('configuration-microservice');
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('checks both databases once and briefly caches readiness', async () => {
    const portal = jasmine.createSpy('portal').and.resolveTo();
    const openmrs = jasmine.createSpy('openmrs').and.resolveTo();
    const app = express().use(createHealthRouter({
      service: 'configuration-microservice',
      databases: {
        portal: { authenticate: portal },
        openmrs: { authenticate: openmrs },
      },
    }));

    const response = await supertest(app).get('/ready');
    await supertest(app).get('/ready');

    expect(response.status).toBe(200);
    expect((response.body as HealthBody).status).toBe('ready');
    expect((response.body as HealthBody).databases).toEqual({
      portal: 'connected',
      openmrs: 'connected',
    });
    expect(portal).toHaveBeenCalledTimes(1);
    expect(openmrs).toHaveBeenCalledTimes(1);
  });

  it('reports unavailable and identifies a disconnected database', async () => {
    const app = express().use(createHealthRouter({
      service: 'configuration-microservice',
      databases: {
        portal: { authenticate: () => Promise.resolve() },
        openmrs: {
          authenticate: () => Promise.reject(
            new Error('database unavailable'),
          ),
        },
      },
    }));

    const response = await supertest(app).get('/ready');

    expect(response.status).toBe(503);
    expect((response.body as HealthBody).status).toBe('unavailable');
    expect((response.body as HealthBody).databases).toEqual({
      portal: 'connected',
      openmrs: 'disconnected',
    });
  });

  it('requires the optional token without affecting application routes',
    async () => {
      const previousToken = process.env.HEALTHCHECK_TOKEN;
      process.env.HEALTHCHECK_TOKEN = 'probe-secret';
      const app = express().use(createHealthRouter({
        service: 'configuration-microservice',
        databases: { portal: { authenticate: () => Promise.resolve() } },
      })).get('/application-route', (_request, response) => {
        response.status(200).json({ status: 'application-ok' });
      });

      try {
        const denied = await supertest(app).get('/ready');
        const allowed = await supertest(app)
          .get('/ready')
          .set('x-healthcheck-token', 'probe-secret');
        const applicationRoute = await supertest(app)
          .get('/application-route');

        expect(denied.status).toBe(401);
        expect(denied.body as HealthBody).toEqual({
          status: 'unauthorized',
        });
        expect(allowed.status).toBe(200);
        expect(allowed.headers['cache-control']).toBe('no-store');
        expect(applicationRoute.status).toBe(200);
      } finally {
        if (previousToken === undefined) delete process.env.HEALTHCHECK_TOKEN;
        else process.env.HEALTHCHECK_TOKEN = previousToken;
      }
    });
});

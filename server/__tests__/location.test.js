// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = await createApp();
});

describe('GET /api/location', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/api/location');
    expect(res.status).toBe(200);
  });

  it('returns address with line1 and line2', async () => {
    const res = await request(app).get('/api/location');
    expect(res.body.address).toHaveProperty('line1');
    expect(res.body.address).toHaveProperty('line2');
  });

  it('returns transport array', async () => {
    const res = await request(app).get('/api/location');
    expect(Array.isArray(res.body.transport)).toBe(true);
    expect(res.body.transport.length).toBeGreaterThan(0);
  });

  it('returns photos array with url and alt', async () => {
    const res = await request(app).get('/api/location');
    expect(Array.isArray(res.body.photos)).toBe(true);
    const photo = res.body.photos[0];
    expect(photo).toHaveProperty('url');
    expect(photo).toHaveProperty('alt');
  });
});

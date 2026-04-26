// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = await createApp();
});

describe('GET /health', () => {
  it('returns 200 with ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns service name and timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.body.service).toBe('coffee-shop');
    expect(res.body.timestamp).toBeDefined();
  });
});

// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = await createApp();
});

describe('GET /api/menu', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(200);
  });

  it('returns coffeeItems array', async () => {
    const res = await request(app).get('/api/menu');
    expect(Array.isArray(res.body.coffeeItems)).toBe(true);
    expect(res.body.coffeeItems.length).toBeGreaterThan(0);
  });

  it('returns pastryItems array', async () => {
    const res = await request(app).get('/api/menu');
    expect(Array.isArray(res.body.pastryItems)).toBe(true);
    expect(res.body.pastryItems.length).toBeGreaterThan(0);
  });

  it('returns openingHours array', async () => {
    const res = await request(app).get('/api/menu');
    expect(Array.isArray(res.body.openingHours)).toBe(true);
  });

  it('each coffee item has required fields', async () => {
    const res = await request(app).get('/api/menu');
    const item = res.body.coffeeItems[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('price');
    expect(item).toHaveProperty('description');
  });
});

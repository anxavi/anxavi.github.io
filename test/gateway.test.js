import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createGatewayServer } from '../server/gateway.js';

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64Url(header);
  const encodedPayload = base64Url(payload);
  const signature = crypto.createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const config = {
  port: 0,
  corsAllowlist: ['http://localhost:3000'],
  jwtIssuer: 'https://issuer.example.com',
  jwtAudience: 'arachne-gateway',
  jwtHs256Secret: 'test-secret',
  timeoutMs: 200,
  maxBodyBytes: 50000,
  googleCloudProject: '',
  googleCloudRegion: '',
  vertexModel: ''
};

function validRequest() {
  return {
    version: '1.0.0',
    context: { occasion: 'office' },
    candidates: []
  };
}

async function startServer() {
  const server = createGatewayServer(config);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, port };
}

function authHeader(token) {
  return 'Bearer ' + token;
}

test('rejects requests without auth', async () => {
  const { server, port } = await startServer();
  const response = await fetch(`http://127.0.0.1:${port}/api/outfits:generate`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(validRequest())
  });
  assert.equal(response.status, 401);
  server.close();
});

test('rejects disallowed CORS origins', async () => {
  const { server, port } = await startServer();
  const token = signJwt({ iss: config.jwtIssuer, aud: config.jwtAudience, sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 }, config.jwtHs256Secret);
  const response = await fetch(`http://127.0.0.1:${port}/api/outfits:generate`, {
    method: 'POST',
    headers: {
      Origin: 'https://evil.example.com',
      Authorization: authHeader(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(validRequest())
  });
  assert.equal(response.status, 403);
  server.close();
});

test('valid CORS preflight returns 204', async () => {
  const { server, port } = await startServer();
  const response = await fetch(`http://127.0.0.1:${port}/api/outfits:generate`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST'
    }
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  server.close();
});

test('rejects invalid request contract', async () => {
  const { server, port } = await startServer();
  const token = signJwt({ iss: config.jwtIssuer, aud: config.jwtAudience, sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 }, config.jwtHs256Secret);
  const response = await fetch(`http://127.0.0.1:${port}/api/outfits:generate`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Authorization: authHeader(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ version: '0.0.1' })
  });
  assert.equal(response.status, 400);
  server.close();
});

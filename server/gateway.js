import http from 'node:http';
import { loadGatewayConfig, validateCriticalConfig } from './config.js';
import { verifyJwtHs256 } from './auth.js';
import { validateGenerateRequest, makeResponse } from '../src/engine/contracts.js';
import { ENGINE_CONTRACT_VERSION } from '../src/engine/constants.js';
import { fileURLToPath } from 'node:url';

function json(res, statusCode, body, origin = null) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(body));
}

function parseJsonBody(req, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    let total = 0;
    let data = '';
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBodyBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      data += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function selectOrigin(req, allowlist) {
  const origin = req.headers.origin;
  if (!origin) return null;
  if (!allowlist.includes(origin)) return null;
  return origin;
}

function readBearerToken(req) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function timeoutPromise(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`Gateway timeout ${ms}ms`)), ms));
}

async function runGatewayInference(payload, config) {
  const missing = validateCriticalConfig(config);
  if (missing.length > 0) {
    throw new Error(`Missing gateway config: ${missing.join(', ')}`);
  }

  // Scaffold only: no simulated model inference or auth bypasses.
  // Future implementation: use ADC with service identity + Vertex AI SDK.
  const result = {
    status: 'error',
    outfit: null,
    score: null,
    editorial: null,
    transitionLayer: null,
    explanation: 'Gateway scaffold active: Vertex integration is pending configuration and implementation.'
  };

  return makeResponse({
    provider: 'remote',
    diagnostics: {
      errors: [{ code: 'REMOTE_NOT_IMPLEMENTED', message: 'Vertex inference not integrated yet.', path: 'gateway' }],
      warnings: [{ code: 'NOT_PRODUCTION_READY', message: 'Pending persistence, quotas/rate limiting and inventory authorization.', path: 'gateway' }]
    },
    result
  });
}

export function createGatewayServer(customConfig = null) {
  const config = customConfig || loadGatewayConfig();

  return http.createServer(async (req, res) => {
    const origin = selectOrigin(req, config.corsAllowlist);

    if (req.method === 'OPTIONS') {
      if (!origin) return json(res, 403, { error: 'Origin not allowed' });
      res.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '600'
      });
      return res.end();
    }

    if (req.url !== '/api/outfits:generate') {
      return json(res, 404, { error: 'Not found' }, origin);
    }

    if (!origin) {
      return json(res, 403, { error: 'Origin not allowed' });
    }

    if (req.method !== 'POST') {
      return json(res, 405, { error: 'Method not allowed' }, origin);
    }

    try {
      const token = readBearerToken(req);
      const claims = verifyJwtHs256(token, {
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
        secret: config.jwtHs256Secret
      });

      if (!claims.sub) {
        return json(res, 401, { error: 'JWT subject required' }, origin);
      }

      const payload = await parseJsonBody(req, config.maxBodyBytes);
      const requestCheck = validateGenerateRequest(payload);
      if (!requestCheck.valid) {
        return json(res, 400, {
          version: ENGINE_CONTRACT_VERSION,
          error: 'Invalid request contract',
          details: requestCheck.errors
        }, origin);
      }

      const response = await Promise.race([
        runGatewayInference(payload, config),
        timeoutPromise(config.timeoutMs)
      ]);

      return json(res, 200, response, origin);
    } catch (error) {
      const status = /JWT|token|issuer|audience|signature|expired/i.test(error.message) ? 401
        : /Payload too large/.test(error.message) ? 413
          : /Invalid JSON|Invalid request contract/.test(error.message) ? 400
            : /timeout/i.test(error.message) ? 504
              : /Missing gateway config/.test(error.message) ? 500
                : 500;

      return json(res, status, {
        version: ENGINE_CONTRACT_VERSION,
        error: 'Gateway request failed',
        message: error.message
      }, origin);
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createGatewayServer();
  const config = loadGatewayConfig();
  server.listen(config.port, () => {
    console.log(`ARACHNE gateway listening on :${config.port}`);
  });
}

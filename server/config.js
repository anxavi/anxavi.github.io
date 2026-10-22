export function loadGatewayConfig(env = process.env) {
  const corsAllowlist = (env.CORS_ALLOWLIST || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  return {
    port: Number(env.PORT || 8080),
    corsAllowlist,
    jwtIssuer: env.JWT_ISSUER || '',
    jwtAudience: env.JWT_AUDIENCE || '',
    jwtHs256Secret: env.JWT_HS256_SECRET || '',
    timeoutMs: Number(env.GATEWAY_TIMEOUT_MS || 8000),
    maxBodyBytes: Number(env.GATEWAY_MAX_BODY_BYTES || 100_000),
    googleCloudProject: env.GOOGLE_CLOUD_PROJECT || '',
    googleCloudRegion: env.GOOGLE_CLOUD_REGION || '',
    vertexModel: env.VERTEX_MODEL || ''
  };
}

export function validateCriticalConfig(config) {
  const missing = [];
  if (!config.jwtIssuer) missing.push('JWT_ISSUER');
  if (!config.jwtAudience) missing.push('JWT_AUDIENCE');
  if (!config.jwtHs256Secret) missing.push('JWT_HS256_SECRET');
  if (!config.googleCloudProject) missing.push('GOOGLE_CLOUD_PROJECT');
  if (!config.googleCloudRegion) missing.push('GOOGLE_CLOUD_REGION');
  if (!config.vertexModel) missing.push('VERTEX_MODEL');
  return missing;
}

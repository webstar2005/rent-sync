import jwt from 'jsonwebtoken';

// Pinned so a leaked secret can never be misused with a different algorithm (alg confusion) and a
// token minted for another service/issuer can never validate here. Deploying this invalidates every
// previously issued token (they carry no iss/aud), which is the intended one-time re-login.
const JWT_ISSUER = 'rent-sync';
const JWT_AUDIENCE = 'rent-sync-dashboard';

export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: '7d',
  });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

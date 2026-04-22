import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    return next(error);
  }

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret);
    req.user = payload;
    return next();
  } catch (_error) {
    const error = new Error('Invalid or expired token');
    error.statusCode = 401;
    return next(error);
  }
}

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const error = new Error('Forbidden resource');
      error.statusCode = 403;
      return next(error);
    }
    next();
  };
}

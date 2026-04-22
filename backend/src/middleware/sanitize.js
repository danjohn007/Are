function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value.replace(/[<>]/g, '').trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = sanitizeValue(value[key]);
    }
    return result;
  }

  return value;
}

export function sanitizeBody(req, _res, next) {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  next();
}

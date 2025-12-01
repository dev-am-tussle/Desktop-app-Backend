import rateLimit from 'express-rate-limit';

// General read operations (GET) - 100/min
export const readLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      details: {
        retryAfter: 60,
      },
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Write operations (POST/PUT/DELETE) - 30/min
export const writeLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_WRITE_MAX || '30'),
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many write requests',
      details: {
        retryAfter: 60,
      },
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Bulk operations - 10/min
export const bulkLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_BULK_MAX || '10'),
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many bulk requests',
      details: {
        retryAfter: 60,
      },
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Refund operations - 5/min
export const refundLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_REFUND_MAX || '5'),
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many refund requests',
      details: {
        retryAfter: 60,
      },
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

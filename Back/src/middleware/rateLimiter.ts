import rateLimit from "express-rate-limit";

/**
 * HU03 - Rate Limiter para prevenir ataques de fuerza bruta
 * Limita el número de intentos de registro por IP
 */

/**
 * Rate limiter para registro de usuarios
 * 5 intentos por IP cada 15 minutos
 */
export const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos
  message: {
    error:
      "Too many registration attempts from this IP, please try again after 15 minutes",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipFailedRequests: true, // Solo contar requests exitosos para evitar problemas con trust proxy
  handler: (_req, res) => {
    res.status(429).json({
      error:
        "Too many registration attempts from this IP, please try again after 15 minutes",
      retryAfter: 15 * 60, // seconds
    });
  },
});

/**
 * Rate limiter para login de usuarios
 * 10 intentos por IP cada 15 minutos
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 intentos
  message: {
    error:
      "Too many login attempts from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No contar intentos exitosos
  skipFailedRequests: true, // Solo contar requests exitosos para evitar problemas con trust proxy
  handler: (_req, res) => {
    res.status(429).json({
      error:
        "Too many login attempts from this IP, please try again after 15 minutes",
      retryAfter: 15 * 60,
    });
  },
});

/**
 * Rate limiter para recuperación de contraseña
 * 3 intentos por IP cada hora
 */
export const passwordRecoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // Máximo 3 intentos
  message: {
    error:
      "Too many password recovery attempts from this IP, please try again after 1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true, // Solo contar requests exitosos para evitar problemas con trust proxy
  handler: (_req, res) => {
    res.status(429).json({
      error:
        "Too many password recovery attempts from this IP, please try again after 1 hour",
      retryAfter: 60 * 60,
    });
  },
});

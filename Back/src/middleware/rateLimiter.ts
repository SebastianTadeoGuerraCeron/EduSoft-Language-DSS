/**
 * ============================================================================
 * MIDDLEWARE DE RATE LIMITING - PROTECCIÓN CONTRA FUERZA BRUTA
 * ============================================================================
 * 
 * @module rateLimiter
 * @description
 * Limitadores de tasa para prevenir ataques de fuerza bruta y abuso de
 * endpoints críticos de autenticación.
 * 
 * ## Historia de Usuario:
 * 
 * ### HU02 - Bloqueo por Intentos Fallidos de Login
 * - **Criterio**: Bloquear IP después de 10 intentos fallidos en 15 minutos
 * - **Implementación**: loginLimiter con max=10, window=15min
 * 
 * ### HU03 - Protección de Registro
 * - Limitar intentos de registro para prevenir spam de cuentas
 * - registrationLimiter con max=5, window=15min
 * 
 * ## Mapeo Common Criteria (ISO/IEC 15408):
 * 
 * | Componente | Nombre | Implementación |
 * |------------|--------|----------------|
 * | FIA_AFL.1  | Authentication failure handling | loginLimiter |
 * | FPT_RVM.1  | Non-bypassability of the TSP | Middleware obligatorio |
 * 
 * ## Configuración de Limitadores:
 * 
 * | Endpoint | Max Requests | Ventana | Bloqueo |
 * |----------|--------------|---------|---------|
 * | /register | 5 | 15 min | IP temporal |
 * | /login | 10 | 15 min | IP temporal |
 * | /password-recovery | 3 | 1 hora | IP temporal |
 * 
 * ## Vectores de Ataque Mitigados:
 * 
 * - **Brute Force**: Límite de intentos previene adivinación de contraseñas
 * - **Credential Stuffing**: Rate limit dificulta prueba masiva de credenciales
 * - **Account Enumeration**: Registro limitado previene enumeración de usuarios
 * - **DoS**: Previene saturación de endpoints de autenticación
 * 
 * @author EduSoft Security Team
 * @version 2.0.0
 * @since 2024-01-15
 */

import rateLimit from "express-rate-limit";

// ============================================================================
// LIMITADOR DE REGISTRO DE USUARIOS
// ============================================================================

/**
 * Rate limiter para endpoint de registro de usuarios
 * 
 * ## Configuración:
 * - **Max**: 5 intentos por IP
 * - **Window**: 15 minutos
 * - **Acción**: Bloqueo temporal con mensaje descriptivo
 * 
 * ## Propósito:
 * Prevenir creación masiva de cuentas (spam, bots, ataques de enumeración).
 * 
 * ## Headers de Respuesta:
 * - RateLimit-Limit: Máximo de requests permitidos
 * - RateLimit-Remaining: Requests restantes en la ventana
 * - RateLimit-Reset: Timestamp de reset de la ventana
 * 
 * @implements HU03 - Protección de registro
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

// ============================================================================
// LIMITADOR DE LOGIN
// ============================================================================

/**
 * Rate limiter para endpoint de login
 * 
 * ## Configuración (HU02):
 * - **Max**: 10 intentos por IP
 * - **Window**: 15 minutos
 * - **Comportamiento**: Solo cuenta intentos fallidos (skipSuccessfulRequests)
 * 
 * ## Lógica de Bloqueo:
 * 1. Usuario intenta login
 * 2. Si falla, incrementa contador para su IP
 * 3. Al llegar a 10 fallos, bloquea IP por 15 minutos
 * 4. Login exitoso NO incrementa el contador
 * 
 * ## Criterio de Aceptación HU02:
 * "Después de 10 intentos fallidos desde una misma IP, 
 *  el sistema debe bloquear temporalmente esa IP"
 * 
 * @implements HU02 - Bloqueo por intentos fallidos (FIA_AFL.1)
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

// ============================================================================
// LIMITADOR DE RECUPERACIÓN DE CONTRASEÑA
// ============================================================================

/**
 * Rate limiter para endpoint de recuperación de contraseña
 * 
 * ## Configuración:
 * - **Max**: 3 intentos por IP
 * - **Window**: 1 hora (más restrictivo)
 * 
 * ## Propósito:
 * - Prevenir abuso del sistema de emails
 * - Proteger contra enumeración de cuentas vía reset
 * - Limitar costos de envío de emails
 * 
 * ## Por qué 3 intentos/hora:
 * El recovery es un flujo sensible que:
 * 1. Envía emails (costo)
 * 2. Genera tokens temporales (seguridad)
 * 3. Puede usarse para confirmar existencia de cuentas
 * 
 * @implements Protección anti-abuso de email
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

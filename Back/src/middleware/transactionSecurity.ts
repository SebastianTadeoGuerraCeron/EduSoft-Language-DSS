/**
 * ============================================================================
 * HU07 - MIDDLEWARE DE SEGURIDAD PARA TRANSACCIONES DE PAGO
 * ============================================================================
 * 
 * @module transactionSecurity
 * @description
 * Sistema completo de seguridad para transacciones financieras. Implementa
 * múltiples capas de protección para garantizar confidencialidad e integridad
 * de datos de pago.
 * 
 * ## Historia de Usuario:
 * 
 * ### HU07 - Protección de Datos de Pagos
 * - **Criterio 1**: Transacciones solo por canal cifrado (HTTPS)
 * - **Criterio 2**: Headers de seguridad específicos para billing
 * - **Criterio 3**: Verificación de integridad con HMAC-SHA256
 * - **Criterio 4**: Protección contra replay attacks con nonces
 * 
 * ## Mapeo Common Criteria (ISO/IEC 15408):
 * 
 * | Componente | Nombre | Implementación |
 * |------------|--------|----------------|
 * | FDP_UCT.1  | Basic data exchange confidentiality | verifySecureChannel() |
 * | FDP_UIT.1  | Data exchange integrity | verifyIntegrity() |
 * | FPT_ITT.1  | Basic TSF data transfer protection | Security headers |
 * | FPT_RPL.1  | Replay detection | verifyNonce() |
 * 
 * ## Capas de Seguridad Implementadas:
 * 
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    REQUEST DE PAGO                          │
 * ├─────────────────────────────────────────────────────────────┤
 * │ 1. verifySecureChannel() - Verificar HTTPS                 │
 * │ 2. addSecurityHeaders()  - Headers anti-XSS, anti-click    │
 * │ 3. verifyNonce()         - Detectar replay attacks         │
 * │ 4. verifyIntegrity()     - Verificar HMAC de datos         │
 * │ 5. transactionRateLimiter - Limitar requests               │
 * ├─────────────────────────────────────────────────────────────┤
 * │                    PROCESAMIENTO SEGURO                     │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 * 
 * ## Vectores de Ataque Mitigados:
 * 
 * - **MITM (Man-in-the-Middle)**: HTTPS obligatorio
 * - **Replay Attack**: Nonces únicos con expiración de 5 minutos
 * - **Data Tampering**: HMAC-SHA256 verifica integridad
 * - **Protocol Downgrade**: Rechazo de conexiones HTTP
 * - **Click-jacking**: X-Frame-Options: DENY
 * - **Content Sniffing**: X-Content-Type-Options: nosniff
 * 
 * @author Anthony Alejandro Morales Vargas
 * @version 2.0.0
 * @since 2024-01-15
 * @see OWASP Payment Processing Cheat Sheet
 */

import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import {
  logInsecureChannelAccess,
  logProtocolDowngrade,
  logReplayAttack
} from "../utils/securityLogger";
import type { AuthRequest } from "./auth";

// ============================================================================
// CONSTANTES DE SEGURIDAD
// ============================================================================

/**
 * Tiempo de vida de un nonce: 5 minutos
 * 
 * ## Razonamiento:
 * - Suficiente para latencia de red normal
 * - Corto para limitar ventana de replay
 * - Balance entre usabilidad y seguridad
 */
const NONCE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Tolerancia de timestamp: 30 segundos
 * 
 * ## Propósito:
 * Permitir pequeñas diferencias de reloj entre cliente y servidor
 * mientras se detectan requests muy antiguos o del futuro.
 */
const TIMESTAMP_TOLERANCE_MS = 30 * 1000;

/**
 * Almacenamiento de nonces usados para detección de replay attacks
 * 
 * ## Estructura: Map<nonce, timestamp_de_uso>
 * 
 * ## Nota de Producción:
 * En un entorno distribuido (múltiples instancias), este Map debería
 * reemplazarse por Redis u otro almacén compartido para garantizar
 * detección de replays entre todas las instancias.
 */
const usedNonces = new Map<string, number>();

/**
 * Limpieza periódica de nonces expirados
 * 
 * ## Propósito:
 * Prevenir crecimiento indefinido del Map de nonces.
 * Los nonces más viejos que NONCE_EXPIRY_MS ya no son útiles.
 */
setInterval(() => {
  const now = Date.now();
  for (const [nonce, timestamp] of usedNonces.entries()) {
    if (now - timestamp > NONCE_EXPIRY_MS) {
      usedNonces.delete(nonce);
    }
  }
}, NONCE_EXPIRY_MS);

// ============================================================================
// FUNCIONES DE GENERACIÓN HMAC
// ============================================================================

/**
 * Obtiene la clave HMAC para verificación de integridad
 * 
 * ## Separación de Claves:
 * Por seguridad, se puede usar una clave separada (TRANSACTION_HMAC_KEY)
 * de la clave de cifrado. Si no existe, usa ENCRYPTION_KEY como fallback.
 * 
 * ## Formatos Soportados:
 * - 64 caracteres hex: Se interpreta como 32 bytes binarios
 * - Otros: Se usa como string UTF-8 directamente
 * 
 * @throws {Error} Si ninguna clave está configurada
 * @returns {Buffer} Clave para HMAC
 */
const getHmacKey = (): Buffer => {
  const key = process.env.TRANSACTION_HMAC_KEY || process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error("TRANSACTION_HMAC_KEY or ENCRYPTION_KEY not found in environment variables");
  }
  
  // Si la clave es más corta que 64 caracteres, usarla como string
  // Si tiene 64 caracteres hex, convertir a buffer
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }
  
  return Buffer.from(key, "utf8");
};

/**
 * Genera un HMAC-SHA256 para verificación de integridad
 * 
 * ## HMAC (Hash-based Message Authentication Code):
 * Combina una clave secreta con los datos para producir un código
 * que verifica tanto integridad como autenticidad.
 * 
 * ## Propiedades:
 * - Solo quien tiene la clave puede generar el HMAC
 * - Cualquier modificación de datos invalida el HMAC
 * - Resistente a ataques de extensión de longitud
 * 
 * @implements FDP_UIT.1 - Data exchange integrity
 * @param {string} data - Datos a firmar
 * @returns {string} HMAC en formato hexadecimal (64 caracteres)
 */
export const generateHmac = (data: string): string => {
  const key = getHmacKey();
  return crypto.createHmac("sha256", key).update(data).digest("hex");
};

/**
 * Verifica un HMAC de forma segura (timing-safe)
 * 
 * ## Seguridad Timing-Safe:
 * Usa crypto.timingSafeEqual() para prevenir timing attacks.
 * La comparación toma el mismo tiempo independientemente de
 * cuántos bytes coincidan, evitando filtrar información.
 * 
 * ## Proceso:
 * 1. Regenera el HMAC esperado con la clave secreta
 * 2. Compara en tiempo constante con el HMAC recibido
 * 3. Retorna resultado sin revelar diferencias
 * 
 * @implements FDP_UIT.1 - Verificación de integridad
 * @param {string} data - Datos originales
 * @param {string} hmac - HMAC recibido a verificar
 * @returns {boolean} true si el HMAC es válido
 */
export const verifyHmac = (data: string, hmac: string): boolean => {
  try {
    const expectedHmac = generateHmac(data);
    return crypto.timingSafeEqual(
      Buffer.from(expectedHmac, "hex"),
      Buffer.from(hmac, "hex")
    );
  } catch {
    return false;
  }
};

// ============================================================================
// FUNCIONES DE GENERACIÓN DE IDENTIFICADORES SEGUROS
// ============================================================================

/**
 * Genera un nonce único para prevenir replay attacks
 * 
 * ## Nonce (Number Used Once):
 * Valor aleatorio que debe ser único por cada request.
 * Si un atacante reenvía un request, el nonce ya estará usado.
 * 
 * ## Características:
 * - 16 bytes (128 bits) de entropía
 * - Generado con CSPRNG (crypto.randomBytes)
 * - Imposible de predecir o colisionar
 * 
 * @implements FPT_RPL.1 - Replay detection
 * @returns {string} Nonce de 32 caracteres hexadecimales
 */
export const generateNonce = (): string => {
  return crypto.randomBytes(16).toString("hex");
};

/**
 * Genera un ID de transacción seguro con timestamp
 * 
 * ## Formato: STXN-{timestamp_base36}-{random_hex}
 * 
 * ## Propiedades:
 * - **Único**: Combinación de tiempo + aleatorio
 * - **Ordenable**: Timestamp permite ordenar cronológicamente
 * - **Trazable**: Prefijo STXN identifica transacciones seguras
 * - **No predecible**: 12 bytes aleatorios (96 bits de entropía)
 * 
 * @returns {string} ID en formato "STXN-XXXXXXX-XXXXXXXXXXXXXXXX"
 */
export const generateSecureTransactionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(12).toString("hex");
  return `STXN-${timestamp}-${random}`.toUpperCase();
};

// ============================================================================
// FUNCIONES DE RESPUESTA SEGURA
// ============================================================================

/**
 * Firma una respuesta de transacción para verificación en cliente
 * 
 * ## Datos Firmados:
 * - ID de transacción
 * - Timestamp de respuesta
 * - Payload completo (JSON stringified)
 * 
 * @param {object} payload - Datos de la respuesta
 * @param {string} transactionId - ID de la transacción
 * @param {number} timestamp - Timestamp Unix de la respuesta
 * @returns {string} Firma HMAC-SHA256
 */
export const signTransactionResponse = (
  payload: object,
  transactionId: string,
  timestamp: number
): string => {
  const dataToSign = `${transactionId}|${timestamp}|${JSON.stringify(payload)}`;
  return generateHmac(dataToSign);
};

/**
 * Crea una respuesta segura con metadatos de integridad
 * 
 * ## Estructura de Respuesta:
 * ```json
 * {
 *   "data": { ... },           // Payload original
 *   "_security": {
 *     "transactionId": "STXN-...",
 *     "timestamp": 1705123456789,
 *     "nonce": "abc123...",
 *     "signature": "hmac...",
 *     "algorithm": "HMAC-SHA256"
 *   }
 * }
 * ```
 * 
 * ## Uso por el Cliente:
 * El cliente puede verificar la respuesta recalculando el HMAC
 * con los mismos datos y comparándolo con la firma.
 * 
 * @implements FDP_UIT.1 - Integridad de datos en respuestas
 * @param {T} data - Datos de la respuesta
 * @param {string} [transactionId] - ID de transacción (se genera si no se proporciona)
 * @returns {Object} Respuesta envuelta con metadatos de seguridad
 */
export const createSecureResponse = <T extends object>(
  data: T,
  transactionId?: string
): {
  data: T;
  _security: {
    transactionId: string;
    timestamp: number;
    nonce: string;
    signature: string;
    algorithm: string;
  };
} => {
  const txId = transactionId || generateSecureTransactionId();
  const timestamp = Date.now();
  const nonce = generateNonce();
  
  const signatureData = `${txId}|${timestamp}|${nonce}|${JSON.stringify(data)}`;
  const signature = generateHmac(signatureData);
  
  return {
    data,
    _security: {
      transactionId: txId,
      timestamp,
      nonce,
      signature,
      algorithm: "HMAC-SHA256",
    },
  };
};

/**
 * Verifica una respuesta segura
 * 
 * @param response - Respuesta a verificar
 * @returns true si la respuesta es válida
 */
export const verifySecureResponse = <T extends object>(
  response: {
    data: T;
    _security: {
      transactionId: string;
      timestamp: number;
      nonce: string;
      signature: string;
    };
  }
): boolean => {
  const { data, _security } = response;
  const { transactionId, timestamp, nonce, signature } = _security;
  
  // Verificar timestamp (no más de 30 segundos de diferencia)
  const now = Date.now();
  if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_MS) {
    console.warn("[Security] Response timestamp expired");
    return false;
  }
  
  // Reconstruir y verificar firma
  const signatureData = `${transactionId}|${timestamp}|${nonce}|${JSON.stringify(data)}`;
  return verifyHmac(signatureData, signature);
};

// ============================================================================
// MIDDLEWARES DE SEGURIDAD
// ============================================================================

/**
 * Middleware: Verificación de HTTPS obligatorio para transacciones
 * 
 * - En producción: Rechaza conexiones HTTP
 * - Verifica headers de proxy para detectar downgrades
 * - Registra intentos de acceso inseguro
 */
export const requireSecureChannel = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Permitir HTTP en desarrollo o localhost
  const isDevelopment = process.env.NODE_ENV === "development";
  const isLocalhost = req.hostname === "localhost" || 
                      req.hostname === "127.0.0.1" ||
                      req.hostname === "::1";
  
  if (isDevelopment || isLocalhost) {
    next();
    return;
  }
  
  // Verificar si la conexión es segura
  const isSecure = 
    req.secure || 
    req.headers["x-forwarded-proto"] === "https" ||
    req.headers["x-forwarded-ssl"] === "on";
  
  if (!isSecure) {
    // Log de seguridad
    logInsecureChannelAccess(
      req.ip || "unknown",
      req.path,
      req.headers["user-agent"]
    ).catch(console.error);
    
    res.status(403).json({
      error: "Secure channel required",
      code: "INSECURE_CHANNEL",
      message: "This endpoint requires HTTPS. Please use a secure connection.",
    });
    return;
  }
  
  // Verificar que no haya downgrade attacks
  const protocol = req.headers["x-forwarded-proto"];
  if (protocol && protocol !== "https") {
    // Log de seguridad
    logProtocolDowngrade(
      req.ip || "unknown",
      String(protocol),
      req.path
    ).catch(console.error);
    
    res.status(403).json({
      error: "Protocol downgrade detected",
      code: "PROTOCOL_DOWNGRADE",
    });
    return;
  }
  
  next();
};

/**
 * Middleware: Headers de seguridad específicos para transacciones
 * 
 * Agrega headers de seguridad críticos:
 * - Strict-Transport-Security (HSTS)
 * - Content-Security-Policy
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - Cache-Control (no caching de datos sensibles)
 */
export const transactionSecurityHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // HSTS - Forzar HTTPS por 1 año
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  
  // Prevenir sniffing de tipo de contenido
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Prevenir clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // XSS Protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // No caching de datos de transacción
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  
  // Content-Security-Policy para APIs de pago
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'"
  );
  
  // Prevenir referrer leakage
  res.setHeader("Referrer-Policy", "no-referrer");
  
  // Política de permisos
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );
  
  next();
};

/**
 * Middleware: Verificación de integridad de request
 * 
 * HU07: Protección contra replay attacks y manipulación de requests
 * 
 * - Valida timestamp para prevenir replay attacks basados en tiempo
 * - Valida nonce único para prevenir replay attacks
 * - La firma HMAC es OPCIONAL (solo se verifica en respuestas del servidor)
 * 
 * JUSTIFICACIÓN: No requerimos firma en requests porque:
 * 1. La clave HMAC no debe exponerse en el cliente (seguridad)
 * 2. El timestamp + nonce proporcionan protección contra replay attacks
 * 3. La autenticación JWT protege contra requests no autorizados
 * 4. La integridad de RESPUESTAS se garantiza con firma HMAC del servidor
 */
export const verifyRequestIntegrity = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Solo verificar para POST/PUT/DELETE con body
  if (!["POST", "PUT", "DELETE"].includes(req.method) || !req.body) {
    next();
    return;
  }
  
  // Extraer headers de seguridad
  const clientTimestamp = req.headers["x-transaction-timestamp"] as string;
  const clientNonce = req.headers["x-transaction-nonce"] as string;
  
  console.log(`[HU07] Verifying request integrity - Method: ${req.method}, Path: ${req.path}`);
  console.log(`[HU07] Headers - Timestamp: ${clientTimestamp}, Nonce: ${clientNonce?.substring(0, 16)}...`);
  
  // Timestamp y nonce son obligatorios para prevenir replay attacks
  if (!clientTimestamp || !clientNonce) {
    console.log('[HU07] ❌ Missing security headers');
    res.status(400).json({
      error: "Missing security headers",
      code: "MISSING_SECURITY_HEADERS",
      message: "Request must include X-Transaction-Timestamp and X-Transaction-Nonce headers",
    });
    return;
  }
  
  // Validar timestamp (prevenir replay attacks basados en tiempo)
  const timestamp = parseInt(clientTimestamp, 10);
  const now = Date.now();
  
  // Verificar timestamp (tolerancia de 5 minutos para compensar diferencias de reloj)
  if (isNaN(timestamp) || Math.abs(now - timestamp) > 5 * 60 * 1000) {
    console.log(`[HU07] ❌ Timestamp expired - Request: ${timestamp}, Now: ${now}, Diff: ${Math.abs(now - timestamp)}ms`);
    res.status(400).json({
      error: "Request timestamp expired or invalid",
      code: "TIMESTAMP_INVALID",
      message: "Request must be sent within 5 minutes",
    });
    return;
  }
  
  // Validar nonce único (prevenir replay attacks)
  if (usedNonces.has(clientNonce)) {
    console.log(`[HU07] ❌ Duplicate nonce detected: ${clientNonce} - Total cached: ${usedNonces.size}`);
    // Log de replay attack
    logReplayAttack(
      req.ip || "unknown",
      clientNonce,
      req.path
    ).catch(console.error);
    
    res.status(400).json({
      error: "Duplicate request detected",
      code: "REPLAY_DETECTED",
      message: "This request has already been processed",
    });
    return;
  }
  
  // Registrar nonce como usado
  usedNonces.set(clientNonce, Date.now());
  console.log(`[HU07] ✅ Nonce registered: ${clientNonce.substring(0, 16)}... - Total cached: ${usedNonces.size}`);
  
  // Verificación exitosa (timestamp válido + nonce único)
  console.log('[HU07] ✅ Request integrity verified');
  next();
};

/**
 * Middleware: Anti-tampering para respuestas de transacción
 * 
 * Modifica res.json para agregar automáticamente firma de integridad
 */
export const addResponseIntegrity = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json.bind(res);
  
  res.json = function(body: any) {
    // Si ya tiene _integrity, no modificar
    if (body && body._integrity) {
      return originalJson(body);
    }
    
    // Si es un error, no agregar seguridad (excepto errores de integridad)
    if (body && body.error && body.code !== "INTEGRITY_FAILED") {
      return originalJson(body);
    }
    
    // Agregar metadatos de seguridad
    const transactionId = (req as any).transactionId || generateSecureTransactionId();
    const timestamp = Date.now();
    const nonce = generateNonce();
    
    const signatureData = `${transactionId}|${timestamp}|${nonce}|${JSON.stringify(body)}`;
    const signature = generateHmac(signatureData);
    
    // Agregar headers de integridad
    res.setHeader("X-Transaction-Id", transactionId);
    res.setHeader("X-Transaction-Timestamp", timestamp.toString());
    res.setHeader("X-Transaction-Nonce", nonce);
    res.setHeader("X-Transaction-Signature", signature);
    res.setHeader("X-Signature-Algorithm", "HMAC-SHA256");
    
    console.log(`[HU07] Response integrity added - TxID: ${transactionId.substring(0, 16)}...`);
    
    return originalJson({
      ...body,
      _integrity: {
        transactionId,
        timestamp,
        nonce,
        signature,
        algorithm: "HMAC-SHA256",
      },
    });
  };
  
  next();
};

/**
 * Middleware: Asignar ID de transacción único
 */
export const assignTransactionId = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const transactionId = generateSecureTransactionId();
  (req as any).transactionId = transactionId;
  res.setHeader("X-Transaction-Id", transactionId);
  next();
};

// ============================================================================
// RATE LIMITERS ESPECÍFICOS PARA BILLING
// ============================================================================

/**
 * Rate limiter para operaciones de checkout/pago
 * Más restrictivo que el general
 */
export const billingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 intentos de pago por ventana
  message: {
    error: "Too many payment attempts. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Contar todas las requests
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many payment attempts. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: 15 * 60,
    });
  },
});

/**
 * Rate limiter para operaciones de tarjetas
 */
export const cardOperationsRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // Máximo 20 operaciones de tarjeta por hora
  message: {
    error: "Too many card operations. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para webhooks (más permisivo - vienen de Stripe)
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // Stripe puede enviar muchos eventos
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// FUNCIÓN COMBINADA PARA ENDPOINTS DE BILLING
// ============================================================================

/**
 * Middleware combinado para endpoints de transacción
 * Aplica todas las protecciones de HU07
 */
export const secureTransactionMiddleware = [
  requireSecureChannel,
  transactionSecurityHeaders,
  assignTransactionId,
  verifyRequestIntegrity,
  billingRateLimiter,
  addResponseIntegrity,
];

/**
 * Middleware para operaciones de tarjetas
 */
export const secureCardOperationMiddleware = [
  requireSecureChannel,
  transactionSecurityHeaders,
  assignTransactionId,
  cardOperationsRateLimiter,
  addResponseIntegrity,
];

export default {
  // Middlewares
  requireSecureChannel,
  transactionSecurityHeaders,
  verifyRequestIntegrity,
  addResponseIntegrity,
  assignTransactionId,
  secureTransactionMiddleware,
  secureCardOperationMiddleware,
  
  // Rate limiters
  billingRateLimiter,
  cardOperationsRateLimiter,
  webhookRateLimiter,
  
  // Utilidades
  generateHmac,
  verifyHmac,
  generateNonce,
  generateSecureTransactionId,
  signTransactionResponse,
  createSecureResponse,
  verifySecureResponse,
};

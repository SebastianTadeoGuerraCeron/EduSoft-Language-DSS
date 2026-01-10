/**
 * HU07 - Middleware de Seguridad para Transacciones de Pago
 * 
 * Implementa:
 * - FDP_UCT.1: Basic data exchange confidentiality
 * - FDP_UIT.1: Data exchange integrity
 * 
 * Características:
 * - Verificación de canal cifrado (HTTPS obligatorio)
 * - Headers de seguridad específicos para transacciones
 * - Verificación de integridad mediante HMAC-SHA256
 * - Protección contra ataques MITM, replay y downgrade
 * - Rate limiting específico para endpoints de pago
 * - Logging de eventos de seguridad
 * 
 * @author Anthony Alejandro Morales Vargas
 * @version 1.0.0
 */

import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import {
  logInsecureChannelAccess,
  logProtocolDowngrade,
  logReplayAttack
} from "../utils/securityLogger";
import type { AuthRequest } from "./auth";

// ============================================================================
// CONSTANTES DE SEGURIDAD
// ============================================================================

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutos para expiración de nonce
const TIMESTAMP_TOLERANCE_MS = 30 * 1000; // 30 segundos de tolerancia

// Almacenamiento de nonces usados (en producción usar Redis)
const usedNonces = new Map<string, number>();

// Limpiar nonces expirados cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [nonce, timestamp] of usedNonces.entries()) {
    if (now - timestamp > NONCE_EXPIRY_MS) {
      usedNonces.delete(nonce);
    }
  }
}, NONCE_EXPIRY_MS);

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Genera una clave HMAC para verificación de integridad
 * Usa una clave separada de la clave de encriptación
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
 * @param data - Datos a firmar
 * @returns HMAC en formato hexadecimal
 */
export const generateHmac = (data: string): string => {
  const key = getHmacKey();
  return crypto.createHmac("sha256", key).update(data).digest("hex");
};

/**
 * Verifica un HMAC de forma segura (timing-safe)
 * 
 * @param data - Datos originales
 * @param hmac - HMAC a verificar
 * @returns true si el HMAC es válido
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

/**
 * Genera un nonce único para prevenir replay attacks
 */
export const generateNonce = (): string => {
  return crypto.randomBytes(16).toString("hex");
};

/**
 * Genera un ID de transacción seguro con timestamp
 */
export const generateSecureTransactionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(12).toString("hex");
  return `STXN-${timestamp}-${random}`.toUpperCase();
};

/**
 * Firma una respuesta de transacción
 * 
 * @param payload - Datos de la respuesta
 * @param transactionId - ID de la transacción
 * @param timestamp - Timestamp de la respuesta
 * @returns Firma HMAC
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
 * @param data - Datos de la respuesta
 * @param transactionId - ID de la transacción (opcional)
 * @returns Respuesta con metadatos de seguridad
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

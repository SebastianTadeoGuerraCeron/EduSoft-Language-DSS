/**
 * ============================================================================
 * HU06 - MIDDLEWARE DE RE-AUTENTICACIÓN PARA ACCIONES CRÍTICAS
 * ============================================================================
 * 
 * @module reAuthenticate
 * @description
 * Implementa verificación adicional de identidad para operaciones sensibles.
 * Requiere que el usuario confirme su contraseña antes de ejecutar acciones
 * que afectan datos financieros o configuración crítica de cuenta.
 * 
 * ## Historia de Usuario:
 * 
 * ### HU06 - Re-autenticación para Acciones Críticas
 * 
 * **Criterio de Aceptación:**
 * - Solicitar password obligatoriamente al acceder a /billing
 * - Verificar identidad antes de operaciones de pago
 * - Prevenir uso no autorizado de sesiones activas
 * 
 * ## Mapeo Common Criteria (ISO/IEC 15408):
 * 
 * | Componente | Nombre | Implementación |
 * |------------|--------|----------------|
 * | FIA_UAU.6  | Re-authenticating | requireReAuthentication() |
 * | FTA_SSL.2  | User-initiated locking | Sesión requiere reconfirmación |
 * 
 * ## Flujo de Re-autenticación:
 * 
 * ```
 * Usuario autenticado → Accede a /billing → 
 * → Middleware solicita header X-Reauth-Password →
 * → Verifica contraseña con hash en BD →
 * → Si válida: req.reAuthenticated = true, continúa
 * → Si inválida: 401 + log de seguridad
 * ```
 * 
 * ## Casos de Uso:
 * 
 * 1. **Agregar método de pago**: Confirmar identidad antes de guardar tarjeta
 * 2. **Suscribirse a plan**: Verificar antes de cobrar
 * 3. **Cancelar suscripción**: Prevenir cancelaciones accidentales
 * 4. **Eliminar cuenta**: Última verificación de consentimiento
 * 
 * ## Vectores de Ataque Mitigados:
 * 
 * - **Session Hijacking**: Token robado no basta, necesita password
 * - **CSRF con sesión activa**: Atacante no conoce password
 * - **Shoulder Surfing**: Password no está visible en UI
 * 
 * @author EduSoft Security Team
 * @version 2.0.0
 * @since 2024-01-15
 */

import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import {
  logSecurityEvent,
  SecurityEvent,
  SecuritySeverity,
} from "../controllers/audit-ctrl";

const prisma = new PrismaClient();

// ============================================================================
// MIDDLEWARE DE RE-AUTENTICACIÓN OBLIGATORIA
// ============================================================================

/**
 * Middleware que requiere re-autenticación para acciones críticas
 * 
 * ## Uso del Header:
 * El cliente debe enviar: `X-Reauth-Password: <contraseña_actual>`
 * 
 * ## Respuestas:
 * - **200**: Re-autenticación exitosa, continúa al siguiente middleware
 * - **401 AUTH_REQUIRED**: Usuario no autenticado (sin JWT)
 * - **401 REAUTH_REQUIRED**: Falta header X-Reauth-Password
 * - **401 REAUTH_FAILED**: Contraseña incorrecta
 * - **401 USER_NOT_FOUND**: Usuario no existe en BD
 * 
 * ## Logging de Seguridad:
 * - Intento fallido: Registrado con severidad MEDIUM
 * - Éxito: Registrado con severidad LOW
 * 
 * @implements HU06 - Re-autenticación (FIA_UAU.6)
 * @param {AuthRequest} req - Request con userId del JWT
 * @param {Response} res - Response de Express
 * @param {NextFunction} next - Continuar si re-auth exitosa
 */
export const requireReAuthentication = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const password = req.headers["x-reauth-password"] as string;

    if (!userId) {
      res.status(401).json({ 
        error: "Unauthorized",
        code: "AUTH_REQUIRED" 
      });
      return;
    }

    // Verificar si se proporcionó la contraseña para re-autenticación
    if (!password) {
      res.status(401).json({
        error: "Re-authentication required",
        message: "Please provide your password to access this resource",
        code: "REAUTH_REQUIRED",
      });
      return;
    }

    // Obtener el usuario de la base de datos
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      res.status(401).json({ 
        error: "User not found",
        code: "USER_NOT_FOUND"
      });
      return;
    }

    // Verificar la contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Log de intento fallido de re-autenticación
      console.warn(`Failed re-authentication attempt for user ${userId}`);
      
      await logSecurityEvent(req, {
        userId,
        event: SecurityEvent.REAUTH_FAILED,
        severity: SecuritySeverity.MEDIUM,
        details: { 
          endpoint: req.originalUrl,
          method: req.method 
        },
      });
      
      res.status(401).json({
        error: "Invalid password",
        message: "The password provided for re-authentication is incorrect",
        code: "REAUTH_FAILED",
      });
      return;
    }

    // Re-autenticación exitosa - log
    await logSecurityEvent(req, {
      userId,
      event: SecurityEvent.REAUTH_SUCCESS,
      severity: SecuritySeverity.LOW,
      details: { 
        endpoint: req.originalUrl,
        method: req.method 
      },
    });

    req.reAuthenticated = true;
    next();
  } catch (error) {
    console.error("Error in re-authentication:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ============================================================================
// MIDDLEWARE DE RE-AUTENTICACIÓN OPCIONAL
// ============================================================================

/**
 * Middleware opcional de re-autenticación
 * 
 * ## Comportamiento:
 * - Si se proporciona X-Reauth-Password: verifica y establece flag
 * - Si no se proporciona: continúa sin verificar (req.reAuthenticated = false)
 * 
 * ## Uso:
 * Endpoints que pueden requerir re-auth condicionalmente.
 * Ejemplo: Ver billing es opcional, pero modificar requiere re-auth.
 * 
 * ## Ejemplo en Controlador:
 * ```typescript
 * if (req.body.action === 'modify' && !req.reAuthenticated) {
 *   return res.status(401).json({ code: 'REAUTH_REQUIRED' });
 * }
 * ```
 * 
 * @param {AuthRequest} req - Request con userId del JWT
 * @param {Response} res - Response de Express
 * @param {NextFunction} next - Siempre continúa (es opcional)
 */
export const optionalReAuthentication = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const password = req.headers["x-reauth-password"] as string;

    // Si no se proporciona contraseña, continuar sin re-auth
    if (!password) {
      req.reAuthenticated = false;
      next();
      return;
    }

    // Si se proporciona, verificar
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      req.reAuthenticated = false;
      next();
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    req.reAuthenticated = isPasswordValid;
    
    next();
  } catch (error) {
    console.error("Error in optional re-authentication:", error);
    req.reAuthenticated = false;
    next();
  }
};

// Extender la interfaz AuthRequest
declare module "./auth" {
  interface AuthRequest {
    reAuthenticated?: boolean;
  }
}

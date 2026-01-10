/**
 * Middleware de Re-autenticación
 * 
 * Cumple con:
 * - HU06: Re-autenticación para Acciones Críticas
 *   - Solicitud de password obligatoria al acceder a /billing
 * 
 * Mapeo Common Criteria: FIA_UAU.6 (Re-authenticating)
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

/**
 * Middleware que requiere re-autenticación para acciones críticas
 * El cliente debe enviar el header X-Reauth-Password con la contraseña actual
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

/**
 * Middleware opcional de re-autenticación
 * Si se proporciona la contraseña, la verifica. Si no, continúa sin verificar.
 * Útil para endpoints que pueden requerir re-auth condicionalmente
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

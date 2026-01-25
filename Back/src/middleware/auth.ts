/**
 * ============================================================================
 * MIDDLEWARE DE AUTENTICACIÓN JWT
 * ============================================================================
 * 
 * @module auth
 * @description
 * Middleware de Express para verificación de tokens JWT en requests protegidas.
 * Extrae y valida el token Bearer del header Authorization.
 * 
 * ## Historia de Usuario:
 * 
 * ### HU01 - Autenticación de Usuarios (FIA_UAU.2)
 * - Verificación de identidad antes de permitir acceso a recursos
 * - Extracción de userId y role para autorización posterior
 * 
 * ## Mapeo Common Criteria (ISO/IEC 15408):
 * 
 * | Componente | Nombre | Implementación |
 * |------------|--------|----------------|
 * | FIA_UAU.2  | User authentication before any action | authenticate() |
 * | FIA_UID.2  | User identification before any action | userId extraction |
 * | FMT_MTD.1  | Management of TSF data | Role-based access |
 * 
 * ## Flujo de Autenticación:
 * 
 * ```
 * Request → Authorization Header → Extract Bearer Token → Verify JWT → 
 * → Extract Payload → Attach userId/role to req → Next Middleware
 * ```
 * 
 * ## Tokens Soportados:
 * - **Formato**: Bearer <token>
 * - **Algoritmo**: HS256
 * - **Payload**: { userId: string, role: string, iat, exp }
 * 
 * @author EduSoft Development Team
 * @version 2.0.0
 * @since 2024-01-15
 */

import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

// ============================================================================
// INTERFACES Y TIPOS
// ============================================================================

/**
 * Request de Express extendida con información de autenticación
 * 
 * ## Propiedades Adicionales:
 * - **userId**: UUID del usuario autenticado (extraído del JWT)
 * - **userRole**: Rol del usuario (STUDENT_FREE, STUDENT_PRO, TUTOR, ADMIN)
 * - **reAuthenticated**: Flag para middleware de re-autenticación (HU06)
 * - **requiresPremiumCheck**: Flag para control de acceso freemium (HU05)
 */
export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  /** Indica si el usuario pasó re-autenticación (HU06) */
  reAuthenticated?: boolean;
  /** Indica si requiere verificación de contenido premium (HU05) */
  requiresPremiumCheck?: boolean;
}

// ============================================================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================================================

/**
 * Middleware de autenticación JWT
 * 
 * ## Proceso de Verificación:
 * 1. Extrae el header Authorization
 * 2. Valida formato "Bearer <token>"
 * 3. Verifica firma del token con JWT_SECRET
 * 4. Verifica expiración del token
 * 5. Extrae userId y role del payload
 * 6. Adjunta información al objeto Request
 * 
 * ## Respuestas de Error:
 * - **401 No token provided**: Header Authorization faltante o mal formado
 * - **401 Token expired**: Token JWT ha expirado
 * - **401 Invalid token**: Firma inválida o token corrupto
 * - **500 Authentication failed**: Error interno inesperado
 * 
 * ## Uso:
 * ```typescript
 * // Proteger una ruta
 * router.get('/profile', authenticate, (req: AuthRequest, res) => {
 *   const userId = req.userId; // Disponible después de authenticate
 * });
 * ```
 * 
 * @implements HU01 - Verificación de identidad (FIA_UAU.2)
 * @param {AuthRequest} req - Request de Express extendida
 * @param {Response} res - Response de Express
 * @param {NextFunction} next - Función para continuar al siguiente middleware
 */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Obtener el token del header Authorization o de las cookies
    let token: string | undefined;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    // Verificar el token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ error: "Server configuration error: JWT_SECRET not configured" });
      return;
    }
    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      role: string;
    };

    // Adjuntar la información del usuario al request
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token expired" });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    res.status(500).json({ error: "Authentication failed" });
  }
};

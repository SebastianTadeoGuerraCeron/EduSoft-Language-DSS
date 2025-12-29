import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extender la interfaz Request para incluir userId y userRole
export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Middleware de autenticación JWT
 * Verifica que el token JWT sea válido y extrae el userId y role
 */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Obtener el token del header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];

    // Verificar el token
    const jwtSecret = process.env.JWT_SECRET || "fallback-secret-key";
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

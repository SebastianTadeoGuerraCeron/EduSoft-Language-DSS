import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth";

/**
 * Middleware de autorización por roles
 * Verifica que el usuario tenga uno de los roles permitidos
 * @param allowedRoles - Array de roles que tienen permiso para acceder
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!allowedRoles.includes(req.userRole)) {
      res.status(403).json({
        error: "Forbidden",
        message: "You do not have permission to access this resource",
      });
      return;
    }

    next();
  };
};

/**
 * Middleware para verificar que el usuario solo pueda modificar sus propios datos
 * o que sea un ADMIN
 */
export const authorizeOwnerOrAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const targetUserId = req.params.id || req.body.userId;

  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Permitir si es el mismo usuario o si es ADMIN
  if (req.userId === targetUserId || req.userRole === "ADMIN") {
    next();
    return;
  }

  res.status(403).json({
    error: "Forbidden",
    message: "You can only modify your own data",
  });
};

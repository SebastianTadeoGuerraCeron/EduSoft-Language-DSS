/**
 * Rutas de Auditoría y Logs
 * 
 * Endpoints para consultar logs del sistema
 * Solo accesibles por ADMIN
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  getActivityLogs,
  getSecurityLogs,
  getErrorLogs,
  getPremiumAccessLogs,
  getAdminActionLogs,
  getLogStats,
  resolveSecurityEvent,
} from "../controllers/audit-ctrl";

const router = Router();

// Todos los endpoints requieren autenticación y rol ADMIN
router.use(authenticate);
router.use(authorize("ADMIN"));

/**
 * GET /audit/activity
 * Obtener logs de actividad de usuarios
 * Query params: userId, action, startDate, endDate, page, limit
 */
router.get("/activity", getActivityLogs);

/**
 * GET /audit/security
 * Obtener logs de seguridad
 * Query params: userId, event, severity, resolved, startDate, endDate, page, limit
 */
router.get("/security", getSecurityLogs);

/**
 * GET /audit/errors
 * Obtener logs de errores
 * Query params: errorType, endpoint, startDate, endDate, page, limit
 */
router.get("/errors", getErrorLogs);

/**
 * GET /audit/premium
 * Obtener logs de acceso a contenido premium
 * Query params: userId, contentType, contentId, startDate, endDate, page, limit
 */
router.get("/premium", getPremiumAccessLogs);

/**
 * GET /audit/admin-actions
 * Obtener logs de acciones administrativas
 * Query params: adminId, action, targetUserId, startDate, endDate, page, limit
 */
router.get("/admin-actions", getAdminActionLogs);

/**
 * GET /audit/stats
 * Obtener estadísticas de logs (Dashboard)
 * Query params: days (default: 7)
 */
router.get("/stats", getLogStats);

/**
 * PATCH /audit/security/:id/resolve
 * Marcar un evento de seguridad como resuelto
 */
router.patch("/security/:id/resolve", resolveSecurityEvent);

export default router;

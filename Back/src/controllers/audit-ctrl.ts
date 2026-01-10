/**
 * Controlador de Auditoría y Logs
 * 
 * Maneja el registro y consulta de:
 * - Actividad de usuarios
 * - Eventos de seguridad
 * - Errores del sistema
 * - Acceso a contenido premium
 * - Acciones administrativas
 * 
 * Los logs se almacenan en una BD separada para mayor seguridad
 */

import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { getAuditPrisma } from "../services/auditDb";
import { normalizeIP } from "../utils/networkConstants";

// ============================================
// TIPOS Y ENUMS
// ============================================

export enum ActivityAction {
  // Autenticación
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  REGISTER = "REGISTER",
  PASSWORD_RESET_REQUEST = "PASSWORD_RESET_REQUEST",
  PASSWORD_RESET_COMPLETE = "PASSWORD_RESET_COMPLETE",
  
  // Lecciones
  VIEW_LESSON = "VIEW_LESSON",
  START_LESSON = "START_LESSON",
  COMPLETE_LESSON = "COMPLETE_LESSON",
  DOWNLOAD_LESSON_FILE = "DOWNLOAD_LESSON_FILE",
  
  // Exámenes
  VIEW_EXAM = "VIEW_EXAM",
  START_EXAM = "START_EXAM",
  SUBMIT_EXAM = "SUBMIT_EXAM",
  VIEW_EXAM_RESULTS = "VIEW_EXAM_RESULTS",
  
  // Perfil
  VIEW_PROFILE = "VIEW_PROFILE",
  UPDATE_PROFILE = "UPDATE_PROFILE",
  CHANGE_PASSWORD = "CHANGE_PASSWORD",
  UPLOAD_AVATAR = "UPLOAD_AVATAR",
  
  // Billing
  VIEW_PRICING = "VIEW_PRICING",
  START_SUBSCRIPTION = "START_SUBSCRIPTION",
  CANCEL_SUBSCRIPTION = "CANCEL_SUBSCRIPTION",
  ADD_PAYMENT_METHOD = "ADD_PAYMENT_METHOD",
  REMOVE_PAYMENT_METHOD = "REMOVE_PAYMENT_METHOD",
  
  // Juegos
  PLAY_GAME = "PLAY_GAME",
  COMPLETE_GAME = "COMPLETE_GAME",
}

export enum SecurityEvent {
  FAILED_LOGIN = "FAILED_LOGIN",
  MULTIPLE_FAILED_LOGINS = "MULTIPLE_FAILED_LOGINS",
  PASSWORD_CHANGE = "PASSWORD_CHANGE",
  ROLE_CHANGE = "ROLE_CHANGE",
  REAUTH_SUCCESS = "REAUTH_SUCCESS",
  REAUTH_FAILED = "REAUTH_FAILED",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  ACCOUNT_UNLOCKED = "ACCOUNT_UNLOCKED",
  TOKEN_REVOKED = "TOKEN_REVOKED",
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
  PREMIUM_ACCESS_DENIED = "PREMIUM_ACCESS_DENIED",
}

export enum SecuritySeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum ResourceType {
  LESSON = "LESSON",
  EXAM = "EXAM",
  PROFILE = "PROFILE",
  GAME = "GAME",
  SUBSCRIPTION = "SUBSCRIPTION",
  PAYMENT_METHOD = "PAYMENT_METHOD",
}

// ============================================
// HELPER PARA OBTENER IP
// ============================================

/**
 * Helper para obtener la IP real del cliente
 * Maneja proxies, IPv6 loopback, y múltiples formatos
 */
export function getClientIP(req: Request | AuthRequest): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  const realIP = req.headers["x-real-ip"];
  
  let ip: string | undefined;
  
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    ip = ips.split(",")[0].trim();
  } else if (realIP) {
    ip = Array.isArray(realIP) ? realIP[0] : realIP;
  } else {
    ip = req.ip || req.socket?.remoteAddress;
  }
  
  return normalizeIP(ip);
}

// ============================================
// FUNCIONES DE LOGGING (Para uso interno)
// ============================================

/**
 * Registra actividad de usuario
 */
export async function logUserActivity(
  req: Request | AuthRequest,
  data: {
    userId: string;
    username?: string;
    email?: string;
    action: ActivityAction | string;
    resource?: string;
    resourceType?: ResourceType | string;
    success?: boolean;
    details?: Record<string, any>;
    duration?: number;
  }
): Promise<void> {
  try {
    const auditPrisma = getAuditPrisma();
    
    await auditPrisma.userActivityLog.create({
      data: {
        userId: data.userId,
        username: data.username || null,
        email: data.email || null,
        action: data.action,
        resource: data.resource || null,
        resourceType: data.resourceType || null,
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"] || null,
        success: data.success ?? true,
        details: data.details ? JSON.stringify(data.details) : null,
        duration: data.duration || null,
      },
    });
  } catch (error) {
    // No fallar si el logging falla - solo registrar en consola
    console.error("[AuditLog] Failed to log user activity:", error);
  }
}

/**
 * Registra evento de seguridad
 */
export async function logSecurityEvent(
  req: Request | AuthRequest,
  data: {
    userId?: string;
    username?: string;
    event: SecurityEvent | string;
    severity: SecuritySeverity;
    details?: Record<string, any>;
  }
): Promise<void> {
  try {
    const auditPrisma = getAuditPrisma();
    
    await auditPrisma.securityLog.create({
      data: {
        userId: data.userId || null,
        username: data.username || null,
        event: data.event,
        severity: data.severity,
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"] || null,
        details: data.details ? JSON.stringify(data.details) : null,
        resolved: false,
      },
    });
    
    // Para eventos críticos, también loguear en consola
    if (data.severity === SecuritySeverity.CRITICAL) {
      console.warn(`[SECURITY CRITICAL] ${data.event} - User: ${data.userId || 'unknown'} - IP: ${getClientIP(req)}`);
    }
  } catch (error) {
    console.error("[AuditLog] Failed to log security event:", error);
  }
}

/**
 * Registra error del sistema
 */
export async function logError(
  req: Request | AuthRequest | null,
  data: {
    userId?: string;
    errorType: string;
    endpoint?: string;
    method?: string;
    message: string;
    stack?: string;
    context?: Record<string, any>;
  }
): Promise<void> {
  try {
    const auditPrisma = getAuditPrisma();
    
    await auditPrisma.errorLog.create({
      data: {
        userId: data.userId || null,
        errorType: data.errorType,
        endpoint: data.endpoint || null,
        method: data.method || null,
        message: data.message,
        stack: data.stack || null,
        context: data.context ? JSON.stringify(data.context) : null,
        ipAddress: req ? getClientIP(req) : null,
        userAgent: req?.headers["user-agent"] || null,
      },
    });
  } catch (error) {
    console.error("[AuditLog] Failed to log error:", error);
  }
}

/**
 * Registra acceso a contenido premium
 */
export async function logPremiumAccess(
  req: Request | AuthRequest,
  data: {
    userId: string;
    username?: string;
    contentType: "LESSON" | "EXAM";
    contentId: string;
    contentTitle?: string;
    accessType: "VIEW" | "DOWNLOAD" | "COMPLETE";
  }
): Promise<void> {
  try {
    const auditPrisma = getAuditPrisma();
    
    await auditPrisma.premiumAccessLog.create({
      data: {
        userId: data.userId,
        username: data.username || null,
        contentType: data.contentType,
        contentId: data.contentId,
        contentTitle: data.contentTitle || null,
        accessType: data.accessType,
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"] || null,
      },
    });
  } catch (error) {
    console.error("[AuditLog] Failed to log premium access:", error);
  }
}

/**
 * Registra acción administrativa
 */
export async function logAdminAction(
  req: AuthRequest,
  data: {
    adminId: string;
    adminEmail?: string;
    action: string;
    targetUserId?: string;
    targetResource?: string;
    resourceType?: string;
    oldValue?: any;
    newValue?: any;
    success?: boolean;
    details?: Record<string, any>;
  }
): Promise<void> {
  try {
    const auditPrisma = getAuditPrisma();
    
    await auditPrisma.adminActionLog.create({
      data: {
        adminId: data.adminId,
        adminEmail: data.adminEmail || null,
        action: data.action,
        targetUserId: data.targetUserId || null,
        targetResource: data.targetResource || null,
        resourceType: data.resourceType || null,
        oldValue: data.oldValue ? JSON.stringify(data.oldValue) : null,
        newValue: data.newValue ? JSON.stringify(data.newValue) : null,
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"] || null,
        success: data.success ?? true,
        details: data.details ? JSON.stringify(data.details) : null,
      },
    });
  } catch (error) {
    console.error("[AuditLog] Failed to log admin action:", error);
  }
}

// ============================================
// ENDPOINTS DE CONSULTA (Solo Admin)
// ============================================

/**
 * Obtener logs de actividad de usuarios
 * Solo accesible por administradores
 */
export const getActivityLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, action, startDate, endDate, page = 1, limit = 50 } = req.query;
    const auditPrisma = getAuditPrisma();
    
    const where: any = {};
    
    if (userId) where.userId = userId as string;
    if (action) where.action = action as string;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }
    
    const [logs, total] = await Promise.all([
      auditPrisma.userActivityLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: Number(limit),
        skip: (Number(page) - 1) * Number(limit),
      }),
      auditPrisma.userActivityLog.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ error: "Failed to fetch activity logs" });
  }
};

/**
 * Obtener logs de seguridad
 * Solo accesible por administradores
 */
export const getSecurityLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, event, severity, resolved, startDate, endDate, page = 1, limit = 50 } = req.query;
    const auditPrisma = getAuditPrisma();
    
    const where: any = {};
    
    if (userId) where.userId = userId as string;
    if (event) where.event = event as string;
    if (severity) where.severity = severity as string;
    if (resolved !== undefined) where.resolved = resolved === "true";
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }
    
    const [logs, total] = await Promise.all([
      auditPrisma.securityLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: Number(limit),
        skip: (Number(page) - 1) * Number(limit),
      }),
      auditPrisma.securityLog.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching security logs:", error);
    res.status(500).json({ error: "Failed to fetch security logs" });
  }
};

/**
 * Obtener logs de errores
 * Solo accesible por administradores
 */
export const getErrorLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { errorType, endpoint, startDate, endDate, page = 1, limit = 50 } = req.query;
    const auditPrisma = getAuditPrisma();
    
    const where: any = {};
    
    if (errorType) where.errorType = errorType as string;
    if (endpoint) where.endpoint = { contains: endpoint as string };
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }
    
    const [logs, total] = await Promise.all([
      auditPrisma.errorLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: Number(limit),
        skip: (Number(page) - 1) * Number(limit),
      }),
      auditPrisma.errorLog.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching error logs:", error);
    res.status(500).json({ error: "Failed to fetch error logs" });
  }
};

/**
 * Obtener logs de acceso premium
 * Solo accesible por administradores
 */
export const getPremiumAccessLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, contentType, contentId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const auditPrisma = getAuditPrisma();
    
    const where: any = {};
    
    if (userId) where.userId = userId as string;
    if (contentType) where.contentType = contentType as string;
    if (contentId) where.contentId = contentId as string;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }
    
    const [logs, total] = await Promise.all([
      auditPrisma.premiumAccessLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: Number(limit),
        skip: (Number(page) - 1) * Number(limit),
      }),
      auditPrisma.premiumAccessLog.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching premium access logs:", error);
    res.status(500).json({ error: "Failed to fetch premium access logs" });
  }
};

/**
 * Obtener logs de acciones administrativas
 * Solo accesible por administradores
 */
export const getAdminActionLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { adminId, action, targetUserId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const auditPrisma = getAuditPrisma();
    
    const where: any = {};
    
    if (adminId) where.adminId = adminId as string;
    if (action) where.action = action as string;
    if (targetUserId) where.targetUserId = targetUserId as string;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }
    
    const [logs, total] = await Promise.all([
      auditPrisma.adminActionLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: Number(limit),
        skip: (Number(page) - 1) * Number(limit),
      }),
      auditPrisma.adminActionLog.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching admin action logs:", error);
    res.status(500).json({ error: "Failed to fetch admin action logs" });
  }
};

/**
 * Obtener estadísticas de logs (Dashboard)
 */
export const getLogStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { days = 7 } = req.query;
    const auditPrisma = getAuditPrisma();
    const since = new Date();
    since.setDate(since.getDate() - Number(days));
    
    const [
      activityCount,
      securityCount,
      errorCount,
      premiumCount,
      adminCount,
      criticalSecurityEvents,
      recentErrors,
    ] = await Promise.all([
      auditPrisma.userActivityLog.count({
        where: { timestamp: { gte: since } },
      }),
      auditPrisma.securityLog.count({
        where: { timestamp: { gte: since } },
      }),
      auditPrisma.errorLog.count({
        where: { timestamp: { gte: since } },
      }),
      auditPrisma.premiumAccessLog.count({
        where: { timestamp: { gte: since } },
      }),
      auditPrisma.adminActionLog.count({
        where: { timestamp: { gte: since } },
      }),
      auditPrisma.securityLog.count({
        where: { 
          timestamp: { gte: since },
          severity: { in: ["HIGH", "CRITICAL"] },
          resolved: false,
        },
      }),
      auditPrisma.errorLog.findMany({
        where: { timestamp: { gte: since } },
        orderBy: { timestamp: "desc" },
        take: 5,
        select: {
          id: true,
          errorType: true,
          message: true,
          endpoint: true,
          timestamp: true,
        },
      }),
    ]);
    
    res.json({
      success: true,
      data: {
        period: `Last ${days} days`,
        counts: {
          activity: activityCount,
          security: securityCount,
          errors: errorCount,
          premiumAccess: premiumCount,
          adminActions: adminCount,
        },
        alerts: {
          unresolvedCriticalEvents: criticalSecurityEvents,
        },
        recentErrors,
      },
    });
  } catch (error) {
    console.error("Error fetching log stats:", error);
    res.status(500).json({ error: "Failed to fetch log statistics" });
  }
};

/**
 * Marcar evento de seguridad como resuelto
 */
export const resolveSecurityEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const auditPrisma = getAuditPrisma();
    
    const event = await auditPrisma.securityLog.update({
      where: { id },
      data: { resolved: true },
    });
    
    // Log la acción del admin
    await logAdminAction(req, {
      adminId: req.userId!,
      action: "RESOLVE_SECURITY_EVENT",
      targetResource: id,
      resourceType: "SECURITY_LOG",
      details: { event: event.event, severity: event.severity },
    });
    
    res.json({
      success: true,
      message: "Security event marked as resolved",
    });
  } catch (error) {
    console.error("Error resolving security event:", error);
    res.status(500).json({ error: "Failed to resolve security event" });
  }
};

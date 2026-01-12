/**
 * ============================================================================
 * HU05 - MIDDLEWARE DE CONTROL DE ACCESO FREEMIUM
 * ============================================================================
 * 
 * @module checkPremiumAccess
 * @description
 * Sistema de control de acceso basado en roles para contenido premium.
 * Implementa el modelo freemium donde usuarios gratuitos tienen acceso
 * limitado y usuarios premium tienen acceso completo.
 * 
 * ## Historia de Usuario:
 * 
 * ### HU05 - Control de Acceso Freemium
 * 
 * **Criterios de Aceptación:**
 * - Si Rol == STUDENT_FREE y Recurso == PREMIUM → Denegar Acceso
 * - Si Rol == STUDENT_PRO → Permitir Acceso a todo
 * - TUTOR y ADMIN tienen acceso de lectura a todos los recursos
 * 
 * ## Mapeo Common Criteria (ISO/IEC 15408):
 * 
 * | Componente | Nombre | Implementación |
 * |------------|--------|----------------|
 * | FDP_ACC.1  | Subset access control | checkLessonPremiumAccess() |
 * | FDP_ACF.1  | Security attribute based access control | Role-based checks |
 * | FMT_MSA.1  | Management of security attributes | userRole property |
 * 
 * ## Matriz de Acceso:
 * 
 * | Rol | Contenido FREE | Contenido PREMIUM |
 * |-----|----------------|-------------------|
 * | STUDENT_FREE | ✅ Permitido | ❌ Denegado (upgrade required) |
 * | STUDENT_PRO | ✅ Permitido | ✅ Permitido |
 * | TUTOR | ✅ Permitido | ✅ Permitido (lectura) |
 * | ADMIN | ✅ Permitido | ✅ Permitido |
 * 
 * ## Flujo de Verificación:
 * 
 * ```
 * Request a recurso → Extraer userRole del JWT →
 * → Si ADMIN/TUTOR: Permitir →
 * → Si STUDENT_PRO: Permitir →
 * → Si STUDENT_FREE: Consultar si recurso es premium →
 * → Si es premium: 403 + log de acceso denegado
 * → Si es free: Permitir
 * ```
 * 
 * @author EduSoft Development Team
 * @version 2.0.0
 * @since 2024-01-15
 */

import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth";
import { PrismaClient } from "@prisma/client";
import {
  logSecurityEvent,
  SecurityEvent,
  SecuritySeverity,
} from "../controllers/audit-ctrl";

const prisma = new PrismaClient();

// ============================================================================
// MIDDLEWARE GENÉRICO DE VERIFICACIÓN PREMIUM
// ============================================================================

/**
 * Middleware genérico para verificar acceso premium
 * 
 * ## Comportamiento por Rol:
 * - **ADMIN**: Acceso inmediato
 * - **TUTOR**: Acceso inmediato
 * - **STUDENT_PRO**: Acceso inmediato
 * - **STUDENT_FREE**: Marca flag para verificación posterior
 * 
 * ## Uso:
 * Se usa como primera capa de verificación. Si el usuario es FREE,
 * un middleware posterior (checkLessonPremiumAccess) verifica el recurso.
 * 
 * @implements HU05 - Control de acceso freemium
 */
export const checkPremiumAccess = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  const userRole = req.userRole;

  // ADMIN y TUTOR siempre tienen acceso
  if (userRole === "ADMIN" || userRole === "TUTOR") {
    next();
    return;
  }

  // STUDENT_PRO tiene acceso
  if (userRole === "STUDENT_PRO") {
    next();
    return;
  }

  // STUDENT_FREE - necesita verificación adicional del recurso
  // Este middleware marca que se debe verificar el recurso
  req.requiresPremiumCheck = true;
  next();
};

// ============================================================================
// MIDDLEWARE ESPECÍFICO PARA LECCIONES
// ============================================================================

/**
 * Middleware específico para verificar acceso a una lección premium
 * 
 * ## Proceso:
 * 1. Verificar rol del usuario (fast-path para ADMIN/TUTOR/PRO)
 * 2. Si es STUDENT_FREE, consultar BD para verificar si lección es premium
 * 3. Si es premium, denegar con respuesta informativa
 * 4. Si es free, permitir acceso
 * 
 * ## Respuesta de Acceso Denegado (403):
 * ```json
 * {
 *   "error": "Premium content",
 *   "message": "This lesson requires a premium subscription",
 *   "lessonTitle": "Advanced Grammar",
 *   "upgradeRequired": true,
 *   "code": "PREMIUM_REQUIRED"
 * }
 * ```
 * 
 * ## Logging:
 * Cada acceso denegado se registra para análisis de:
 * - Contenido más demandado
 * - Posibles intentos de bypass
 * - Métricas de conversión
 * 
 * @implements HU05 - Control de acceso a lecciones (FDP_ACC.1)
 * @requires authenticate - Debe usarse después de authenticate middleware
 */
export const checkLessonPremiumAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userRole = req.userRole;
    const lessonId = req.params.id;

    // ADMIN y TUTOR siempre tienen acceso
    if (userRole === "ADMIN" || userRole === "TUTOR") {
      next();
      return;
    }

    // STUDENT_PRO tiene acceso a todo
    if (userRole === "STUDENT_PRO") {
      next();
      return;
    }

    // STUDENT_FREE - verificar si la lección es premium
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { isPremium: true, title: true },
    });

    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    // Si la lección es premium y el usuario es FREE -> denegar
    if (lesson.isPremium) {
      // Log de acceso denegado a contenido premium
      if (req.userId) {
        await logSecurityEvent(req, {
          userId: req.userId,
          event: SecurityEvent.PREMIUM_ACCESS_DENIED,
          severity: SecuritySeverity.LOW,
          details: {
            contentType: "LESSON",
            contentId: lessonId,
            contentTitle: lesson.title,
            userRole,
          },
        });
      }

      res.status(403).json({
        error: "Premium content",
        message: "This lesson requires a premium subscription",
        lessonTitle: lesson.title,
        upgradeRequired: true,
        code: "PREMIUM_REQUIRED",
      });
      return;
    }

    // Lección gratuita - permitir acceso
    next();
  } catch (error) {
    console.error("Error checking lesson premium access:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ============================================================================
// MIDDLEWARE ESPECÍFICO PARA EXÁMENES
// ============================================================================

/**
 * Middleware específico para verificar acceso a un examen premium
 * 
 * ## Comportamiento:
 * Idéntico a checkLessonPremiumAccess pero para recursos de tipo Exam.
 * 
 * ## Respuesta de Acceso Denegado (403):
 * ```json
 * {
 *   "error": "Premium content",
 *   "message": "This exam requires a premium subscription",
 *   "examTitle": "TOEFL Practice Test",
 *   "upgradeRequired": true,
 *   "code": "PREMIUM_REQUIRED"
 * }
 * ```
 * 
 * @implements HU05 - Control de acceso a exámenes (FDP_ACC.1)
 * @requires authenticate - Debe usarse después de authenticate middleware
 */
export const checkExamPremiumAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userRole = req.userRole;
    const examId = req.params.id;

    // ADMIN y TUTOR siempre tienen acceso
    if (userRole === "ADMIN" || userRole === "TUTOR") {
      next();
      return;
    }

    // STUDENT_PRO tiene acceso a todo
    if (userRole === "STUDENT_PRO") {
      next();
      return;
    }

    // STUDENT_FREE - verificar si el examen es premium
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { isPremium: true, title: true },
    });

    if (!exam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }

    // Si el examen es premium y el usuario es FREE -> denegar
    if (exam.isPremium) {
      // Log de acceso denegado a contenido premium
      if (req.userId) {
        await logSecurityEvent(req, {
          userId: req.userId,
          event: SecurityEvent.PREMIUM_ACCESS_DENIED,
          severity: SecuritySeverity.LOW,
          details: {
            contentType: "EXAM",
            contentId: examId,
            contentTitle: exam.title,
            userRole,
          },
        });
      }

      res.status(403).json({
        error: "Premium content",
        message: "This exam requires a premium subscription",
        examTitle: exam.title,
        upgradeRequired: true,
        code: "PREMIUM_REQUIRED",
      });
      return;
    }

    // Examen gratuito - permitir acceso
    next();
  } catch (error) {
    console.error("Error checking exam premium access:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Middleware para marcar contenido como premium en la respuesta
 * Agrega información sobre si el contenido es premium y si el usuario tiene acceso
 */
export const markPremiumContent = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  const userRole = req.userRole;
  
  // Agregar helper al request para uso en controladores
  req.canAccessPremium = 
    userRole === "ADMIN" || 
    userRole === "TUTOR" || 
    userRole === "STUDENT_PRO";
  
  next();
};

// Extender la interfaz AuthRequest
declare module "./auth" {
  interface AuthRequest {
    requiresPremiumCheck?: boolean;
    canAccessPremium?: boolean;
  }
}

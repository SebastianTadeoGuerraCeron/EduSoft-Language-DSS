/**
 * Middleware para verificar acceso a contenido Premium
 * 
 * Cumple con:
 * - HU05: Control de Acceso Freemium
 *   - Si Rol == STUDENT_FREE y Recurso == PREMIUM -> Denegar Acceso
 *   - El Tutor debe tener acceso de lectura a ambos tipos de lecciones
 * 
 * Mapeo Common Criteria: FDP_ACC.1 (Subset access control)
 */

import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Middleware genérico para verificar acceso premium
 * Usado en rutas que requieren validación de contenido premium
 */
export const checkPremiumAccess = (
  req: AuthRequest,
  res: Response,
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

/**
 * Middleware específico para verificar acceso a una lección premium
 * Debe usarse después de authenticate
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

/**
 * Middleware específico para verificar acceso a un examen premium
 * Debe usarse después de authenticate
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
  res: Response,
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

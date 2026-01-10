import { PrismaClient } from "@prisma/client";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import {
  logUserActivity,
  logPremiumAccess,
  ActivityAction,
  ResourceType,
} from "./audit-ctrl";

const prisma = new PrismaClient();

// Tipos auxiliares para estadísticas
interface ExamStatItem {
  examId: string;
  examTitle: string;
  lessonTitle: string;
  totalAttempts: number;
  finishedAttempts: number;
  averageScore: number;
  passRate: number;
  passingPercentage: number;
}

interface AttemptScore {
  score: number | null;
}

// ========== ENDPOINTS PARA TUTORES ==========

/**
 * Crear un nuevo examen (solo TUTOR)
 * POST /exams/create
 */
export const createExamCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const {
      title,
      description,
      lessonId,
      isPremium,
      timeLimit,
      passingPercentage,
      questions,
    } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validar campos requeridos
    if (!title || !description || !lessonId || !timeLimit) {
      res.status(400).json({
        error: "Title, description, lessonId and timeLimit are required",
      });
      return;
    }

    // Verificar que la lección pertenece al tutor
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, createdBy: true, title: true },
    });

    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    if (lesson.createdBy !== userId) {
      res.status(403).json({
        error: "You can only create exams for your own lessons",
      });
      return;
    }

    // Validar que haya al menos una pregunta
    if (!questions || questions.length === 0) {
      res.status(400).json({ error: "At least one question is required" });
      return;
    }

    // Crear el examen con sus preguntas en una transacción
    const exam = await prisma.exam.create({
      data: {
        title,
        description,
        lessonId,
        isPremium: isPremium || false,
        timeLimit: parseInt(timeLimit, 10),
        passingPercentage: passingPercentage || 60,
        createdBy: userId,
        questions: {
          create: questions.map((q: any, idx: number) => ({
            text: q.text,
            type: q.type || "MULTIPLE_CHOICE",
            options: q.options || null,
            correctAnswer: q.correctAnswer,
            points: q.points || 1,
            order: idx + 1,
          })),
        },
      },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        lesson: {
          select: { id: true, title: true },
        },
        tutor: {
          select: { id: true, username: true },
        },
      },
    });

    res.status(201).json({ exam });
  } catch (error) {
    console.error("Error creating exam:", error);
    res.status(500).json({
      error: "Internal server error",
      details: (error as any).message,
    });
  }
};

/**
 * Actualizar un examen (solo el tutor creador)
 * PUT /exams/:id
 */
export const updateExamCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const {
      title,
      description,
      isPremium,
      timeLimit,
      passingPercentage,
      questions,
    } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Verificar que el examen existe y pertenece al tutor
    const existingExam = await prisma.exam.findUnique({
      where: { id },
      select: { createdBy: true },
    });

    if (!existingExam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }

    if (existingExam.createdBy !== userId) {
      res.status(403).json({ error: "You can only update your own exams" });
      return;
    }

    // Validar campos requeridos
    if (!title || !timeLimit) {
      res.status(400).json({ error: "Title and timeLimit are required" });
      return;
    }

    // Validar que haya al menos una pregunta
    if (!questions || questions.length === 0) {
      res.status(400).json({ error: "At least one question is required" });
      return;
    }

    // Actualizar en una transacción: eliminar preguntas antiguas y crear nuevas
    const exam = await prisma.$transaction(async (tx) => {
      // Eliminar preguntas existentes
      await tx.question.deleteMany({
        where: { examId: id },
      });

      // Actualizar el examen y crear nuevas preguntas
      return tx.exam.update({
        where: { id },
        data: {
          title,
          description,
          isPremium: isPremium || false,
          timeLimit: parseInt(timeLimit, 10),
          passingPercentage: passingPercentage || 60,
          questions: {
            create: questions.map((q: any, idx: number) => ({
              text: q.text,
              type: q.type || "MULTIPLE_CHOICE",
              options: q.options || null,
              correctAnswer: q.correctAnswer,
              points: q.points || 1,
              order: idx + 1,
            })),
          },
        },
        include: {
          questions: {
            orderBy: { order: "asc" },
          },
          lesson: {
            select: { id: true, title: true },
          },
          tutor: {
            select: { id: true, username: true },
          },
        },
      });
    });

    res.json({ exam });
  } catch (error) {
    console.error("Error updating exam:", error);
    res.status(500).json({
      error: "Internal server error",
      details: (error as any).message,
    });
  }
};

/**
 * Obtener lecciones del tutor para dropdown
 * GET /tutor/lessons
 */
export const getTutorLessonsCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const lessons = await prisma.lesson.findMany({
      where: { createdBy: userId },
      select: {
        id: true,
        title: true,
        isPremium: true,
        level: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ lessons });
  } catch (error) {
    console.error("Error fetching tutor lessons:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Obtener estadísticas del tutor
 * GET /tutor/stats
 */
export const getTutorStatsCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Obtener exámenes del tutor con estadísticas
    const exams = await prisma.exam.findMany({
      where: { createdBy: userId },
      include: {
        lesson: {
          select: { title: true },
        },
        attempts: {
          where: { status: "FINISHED" },
          select: {
            id: true,
            score: true,
            userId: true,
            user: {
              select: { username: true },
            },
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
    });

    // Calcular estadísticas por examen
    const examStats: ExamStatItem[] = exams.map((exam: any) => {
      const finishedAttempts = exam.attempts;
      const totalAttempts = exam._count.attempts;
      const avgScore =
        finishedAttempts.length > 0
          ? finishedAttempts.reduce((acc: number, a: AttemptScore) => acc + (a.score || 0), 0) /
            finishedAttempts.length
          : 0;
      const passedCount = finishedAttempts.filter(
        (a: AttemptScore) => (a.score || 0) >= exam.passingPercentage
      ).length;

      return {
        examId: exam.id,
        examTitle: exam.title,
        lessonTitle: exam.lesson.title,
        totalAttempts,
        finishedAttempts: finishedAttempts.length,
        averageScore: Math.round(avgScore * 100) / 100,
        passRate:
          finishedAttempts.length > 0
            ? Math.round((passedCount / finishedAttempts.length) * 100)
            : 0,
        passingPercentage: exam.passingPercentage,
      };
    });

    // Estadísticas globales
    const totalExams = exams.length;
    const totalAttempts = examStats.reduce((acc: number, e: ExamStatItem) => acc + e.totalAttempts, 0);
    const overallAvgScore =
      examStats.length > 0
        ? examStats.reduce((acc: number, e: ExamStatItem) => acc + e.averageScore, 0) / examStats.length
        : 0;

    res.json({
      stats: {
        totalExams,
        totalAttempts,
        overallAverageScore: Math.round(overallAvgScore * 100) / 100,
        examStats,
      },
    });
  } catch (error) {
    console.error("Error fetching tutor stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ========== ENDPOINTS PARA ESTUDIANTES ==========

/**
 * Obtener todos los exámenes (con filtros)
 * GET /exams
 * Para estudiantes: solo exámenes de lecciones asignadas
 */
export const getAllExamsCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId, isPremium } = req.query;
    const userId = req.userId;
    const userRole = req.userRole;

    const where: any = { isActive: true };

    if (lessonId) {
      where.lessonId = lessonId as string;
    }

    if (isPremium !== undefined) {
      where.isPremium = isPremium === "true";
    }

    // Si es estudiante, filtrar solo exámenes de lecciones asignadas
    if (userRole === "STUDENT_FREE" || userRole === "STUDENT_PRO") {
      // Obtener IDs de lecciones asignadas al estudiante
      const assignedLessons = await prisma.lessonAssignment.findMany({
        where: { userId: userId },
        select: { lessonId: true },
      });

      const assignedLessonIds = assignedLessons.map((a) => a.lessonId);

      // Si no tiene lecciones asignadas, retornar lista vacía
      if (assignedLessonIds.length === 0) {
        res.json({ exams: [] });
        return;
      }

      // Filtrar exámenes solo de lecciones asignadas
      where.lessonId = { in: assignedLessonIds };
    }

    const exams = await prisma.exam.findMany({
      where,
      include: {
        lesson: {
          select: { id: true, title: true, level: true },
        },
        tutor: {
          select: { id: true, username: true },
        },
        _count: {
          select: { questions: true, attempts: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ exams });
  } catch (error) {
    console.error("Error fetching exams:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Obtener un examen por ID (sin respuestas correctas para estudiantes)
 * GET /exams/:id
 */
export const getExamByIdCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        lesson: {
          select: { id: true, title: true, level: true },
        },
        tutor: {
          select: { id: true, username: true },
        },
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            text: true,
            type: true,
            options: true,
            points: true,
            order: true,
            // NO incluir correctAnswer para estudiantes
            ...(userRole === "TUTOR" || userRole === "ADMIN"
              ? { correctAnswer: true }
              : {}),
          },
        },
      },
    });

    if (!exam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }

    // Verificar si el usuario tiene un intento activo
    let activeAttempt = null;
    if (userId) {
      activeAttempt = await prisma.examAttempt.findFirst({
        where: {
          userId,
          examId: id,
          status: "IN_PROGRESS",
        },
        select: {
          id: true,
          startedAt: true,
        },
      });
    }

    res.json({ exam, activeAttempt });
  } catch (error) {
    console.error("Error fetching exam:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Iniciar un intento de examen
 * POST /exams/:id/start
 */
export const startExamCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Obtener el examen
    const exam = await prisma.exam.findUnique({
      where: { id },
      select: {
        id: true,
        isPremium: true,
        timeLimit: true,
        isActive: true,
      },
    });

    if (!exam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }

    if (!exam.isActive) {
      res.status(400).json({ error: "This exam is no longer active" });
      return;
    }

    // Verificar acceso premium
    if (exam.isPremium && userRole === "STUDENT_FREE") {
      res.status(403).json({
        error: "Premium content",
        message: "This exam requires a PRO subscription",
      });
      return;
    }

    // Verificar si ya hay un intento en progreso
    const existingAttempt = await prisma.examAttempt.findFirst({
      where: {
        userId,
        examId: id,
        status: "IN_PROGRESS",
      },
    });

    if (existingAttempt) {
      // Retornar el intento existente
      res.json({
        attempt: existingAttempt,
        message: "Resuming existing attempt",
      });
      return;
    }

    // Crear nuevo intento
    const attempt = await prisma.examAttempt.create({
      data: {
        userId,
        examId: id,
        status: "IN_PROGRESS",
      },
    });

    // Log de inicio de examen
    await logUserActivity(req, {
      userId,
      action: ActivityAction.START_EXAM,
      resource: id,
      resourceType: ResourceType.EXAM,
      success: true,
      details: { attemptId: attempt.id, isPremium: exam.isPremium },
    });

    // Si es premium, también registrar en logs de acceso premium
    if (exam.isPremium) {
      await logPremiumAccess(req, {
        userId,
        contentType: "EXAM",
        contentId: id,
        accessType: "VIEW",
      });
    }

    res.status(201).json({ attempt });
  } catch (error) {
    console.error("Error starting exam:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Enviar respuestas y calificar examen
 * POST /exams/:id/submit
 */
export const submitExamCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { attemptId, answers, timeTaken } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Verificar el intento
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            questions: true,
          },
          select: undefined,
        },
      },
    });

    if (!attempt) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }

    if (attempt.userId !== userId) {
      res.status(403).json({ error: "This attempt does not belong to you" });
      return;
    }

    if (attempt.status === "FINISHED") {
      res.status(400).json({ error: "This attempt has already been submitted" });
      return;
    }

    // Calificar el examen
    const questions = attempt.exam.questions;
    let totalPoints = 0;
    let earnedPoints = 0;
    const gradedAnswers: any = {};

    for (const question of questions) {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      const isCorrect =
        userAnswer?.toString().toLowerCase().trim() ===
        question.correctAnswer.toLowerCase().trim();

      gradedAnswers[question.id] = {
        userAnswer: userAnswer || null,
        correctAnswer: question.correctAnswer,
        isCorrect,
        pointsEarned: isCorrect ? question.points : 0,
      };

      if (isCorrect) {
        earnedPoints += question.points;
      }
    }

    // Calcular puntaje como porcentaje
    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

    // Actualizar el intento
    const updatedAttempt = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        answers: gradedAnswers,
        score: Math.round(score * 100) / 100,
        totalPoints: earnedPoints,
        maxPoints: totalPoints,
        status: "FINISHED",
        finishedAt: new Date(),
        timeTaken: timeTaken || null,
      },
      include: {
        exam: {
          select: {
            title: true,
            passingPercentage: true,
          },
        },
      },
    });

    const passed = score >= attempt.exam.passingPercentage;

    // Log de envío de examen
    await logUserActivity(req, {
      userId,
      action: ActivityAction.SUBMIT_EXAM,
      resource: attempt.examId,
      resourceType: ResourceType.EXAM,
      success: true,
      duration: timeTaken || undefined,
      details: { 
        attemptId, 
        score: Math.round(score * 100) / 100, 
        passed,
        earnedPoints,
        totalPoints 
      },
    });

    // Si es premium, registrar acceso completado
    if (attempt.exam.isPremium) {
      await logPremiumAccess(req, {
        userId,
        contentType: "EXAM",
        contentId: attempt.examId,
        contentTitle: attempt.exam.title,
        accessType: "COMPLETE",
      });
    }

    res.json({
      attempt: updatedAttempt,
      results: {
        score: Math.round(score * 100) / 100,
        earnedPoints,
        totalPoints,
        passed,
        passingPercentage: attempt.exam.passingPercentage,
        gradedAnswers,
      },
    });
  } catch (error) {
    console.error("Error submitting exam:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Obtener historial de intentos del usuario
 * GET /exams/user/:userId/attempts
 */
export const getUserAttemptsCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { userId: targetUserId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    // Verificar autorización
    if (userId !== targetUserId && userRole !== "ADMIN" && userRole !== "TUTOR") {
      res.status(403).json({ error: "You can only view your own attempts" });
      return;
    }

    const attempts = await prisma.examAttempt.findMany({
      where: {
        userId: targetUserId,
        status: "FINISHED",
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            passingPercentage: true,
            lesson: {
              select: { title: true },
            },
          },
        },
      },
      orderBy: { finishedAt: "desc" },
    });

    // Calcular estadísticas
    const stats = {
      totalAttempts: attempts.length,
      averageScore:
        attempts.length > 0
          ? Math.round(
              (attempts.reduce((acc: number, a: any) => acc + (a.score || 0), 0) /
                attempts.length) *
                100
            ) / 100
          : 0,
      passedCount: attempts.filter(
        (a: any) => (a.score || 0) >= (a.exam.passingPercentage || 60)
      ).length,
    };

    res.json({ attempts, stats });
  } catch (error) {
    console.error("Error fetching user attempts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Registrar actividad de auditoría (anti-trampa)
 * POST /exams/audit
 */
export const auditExamCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { attemptId, activityType, details } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Verificar que el intento pertenece al usuario
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { userId: true, status: true },
    });

    if (!attempt) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }

    if (attempt.userId !== userId) {
      res.status(403).json({ error: "This attempt does not belong to you" });
      return;
    }

    if (attempt.status !== "IN_PROGRESS") {
      res.status(400).json({ error: "Attempt is not in progress" });
      return;
    }

    // Registrar el log de auditoría
    const auditLog = await prisma.examAuditLog.create({
      data: {
        attemptId,
        activityType,
        details: details || null,
      },
    });

    res.status(201).json({ auditLog });
  } catch (error) {
    console.error("Error recording audit log:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Obtener resultados detallados de un intento
 * GET /exams/:id/results/:attemptId
 */
export const getExamResultsCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { attemptId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            questions: {
              orderBy: { order: "asc" },
            },
            lesson: {
              select: { id: true, title: true },
            },
          },
        },
        auditLogs: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!attempt) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }

    // Verificar autorización
    const isOwner = attempt.userId === userId;
    const isTutor = attempt.exam.createdBy === userId;
    const isAdmin = userRole === "ADMIN";

    if (!isOwner && !isTutor && !isAdmin) {
      res.status(403).json({ error: "You do not have access to these results" });
      return;
    }

    const passed = (attempt.score || 0) >= attempt.exam.passingPercentage;

    res.json({
      attempt,
      passed,
      // Solo mostrar logs de auditoría a tutores y admins
      auditLogs: isTutor || isAdmin ? attempt.auditLogs : undefined,
    });
  } catch (error) {
    console.error("Error fetching exam results:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Eliminar un examen (solo el tutor creador)
 * DELETE /exams/:id
 */
export const deleteExamCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const exam = await prisma.exam.findUnique({
      where: { id },
      select: { createdBy: true },
    });

    if (!exam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }

    if (exam.createdBy !== userId) {
      res.status(403).json({ error: "You can only delete your own exams" });
      return;
    }

    await prisma.exam.delete({
      where: { id },
    });

    res.json({ message: "Exam deleted successfully" });
  } catch (error) {
    console.error("Error deleting exam:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Obtener exámenes creados por el tutor
 * GET /tutor/exams
 */
export const getTutorExamsCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const exams = await prisma.exam.findMany({
      where: { createdBy: userId },
      include: {
        lesson: {
          select: { id: true, title: true },
        },
        _count: {
          select: { questions: true, attempts: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ exams });
  } catch (error) {
    console.error("Error fetching tutor exams:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

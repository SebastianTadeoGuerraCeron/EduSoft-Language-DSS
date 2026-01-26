import { PrismaClient } from "@prisma/client";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import {
  logUserActivity,
  logPremiumAccess,
  logAdminAction,
  ActivityAction,
  ResourceType,
} from "./audit-ctrl";

const prisma = new PrismaClient();

/**
 * Crear una nueva lección (solo TUTOR)
 * POST /lessons/create
 */
export const createLessonCtrl = async (req: AuthRequest, res: Response) => {
  try {
    let { title, description, type, level, isPremium, content, miniatura, duration, modules } = req.body;
    const userId = req.userId;

    console.log("=== createLessonCtrl DEBUG ===");
    console.log("userId:", userId);
    console.log("title:", title);
    console.log("description:", description);
    console.log("modules count:", modules?.length);

    // Convertir duration a número si es string
    if (duration && typeof duration === "string") {
      duration = parseInt(duration, 10);
    }

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validar campos requeridos
    if (!title || !description) {
      res.status(400).json({ error: "Title and description are required" });
      return;
    }

    // Validar que máximo haya 5 módulos
    if (modules && modules.length > 5) {
      res.status(400).json({ error: "Maximum 5 modules per lesson" });
      return;
    }

    const lesson = await prisma.lesson.create({
      data: {
        title,
        description,
        type: type || "TEXT",
        level: level || "BEGINNER",
        isPremium: isPremium || false,
        content: content || "",
        miniatura: miniatura || null,
        duration: duration || null,
        createdBy: userId,
        modules: {
          create: modules?.map((mod: any, idx: number) => ({
            titulo: mod.titulo,
            contenido: mod.contenido,
            orden: idx + 1,
          })) || [],
        },
      },
      include: {
        modules: true,
        tutor: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    // Log de creación de lección
    await logAdminAction(req, {
      adminId: userId,
      action: "CREATE_LESSON",
      targetResource: lesson.id,
      resourceType: ResourceType.LESSON,
      newValue: { title, isPremium, type, level },
      success: true,
    });

    res.status(201).json({ lesson });
  } catch (error) {
    console.error("=== ERROR CREATING LESSON ===");
    console.error("Error object:", error);
    console.error("Error message:", (error as any).message);
    console.error("Error stack:", (error as any).stack);
    res.status(500).json({ 
      error: "Internal server error",
      details: (error as any).message,
    });
  }
};

/**
 * Obtener todas las lecciones
 * GET /lessons
 */
export const getAllLessonsCtrl = async (_req: AuthRequest, res: Response) => {
  try {
    const lessons = await prisma.lesson.findMany({
      include: {
        tutor: {
          select: { id: true, username: true },
        },
        modules: {
          orderBy: { orden: "asc" },
        },
        _count: {
          select: {
            assignments: true,
            progress: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ lessons });
  } catch (error) {
    console.error("Error fetching lessons:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Obtener udna lección por ID
 * GET /lessons/:id
 */
export const getLessonByIdCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        tutor: {
          select: { id: true, username: true, email: true },
        },
        modules: {
          orderBy: { orden: "asc" },
        },
        assignments: {
          select: {
            user: { select: { id: true, username: true, email: true } },
            assignedAt: true,
          },
        },
      },
    });

    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    // Log de visualización de lección
    if (req.userId) {
      await logUserActivity(req, {
        userId: req.userId,
        action: ActivityAction.VIEW_LESSON,
        resource: lesson.id,
        resourceType: ResourceType.LESSON,
        success: true,
        details: { title: lesson.title, isPremium: lesson.isPremium },
      });

      // Si es premium, también registrar en logs de acceso premium
      if (lesson.isPremium) {
        await logPremiumAccess(req, {
          userId: req.userId,
          contentType: "LESSON",
          contentId: lesson.id,
          contentTitle: lesson.title,
          accessType: "VIEW",
        });
      }
    }

    res.json({ lesson });
  } catch (error) {
    console.error("Error fetching lesson:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Actualizar una lección (solo tutor creator)
 * PUT /lessons/:id
 */
export const updateLessonCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, type, level, isPremium, content, miniatura, duration, modules } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Obtener información del usuario
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Verificar que la lección existe
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    // Permitir edición solo si es el creador o ADMIN
    const canEdit = lesson.createdBy === userId || user.role === "ADMIN";
    if (!canEdit) {
      res.status(403).json({ error: "Forbidden: Only the lesson creator or admin can edit" });
      return;
    }

    // Actualizar datos básicos de la lección solo si se proporcionan
    if (title || description || type || level !== undefined || isPremium !== undefined || content || miniatura || duration !== undefined) {
      await prisma.lesson.update({
        where: { id },
        data: {
          title: title || undefined,
          description: description || undefined,
          type: type || undefined,
          level: level || undefined,
          isPremium: isPremium !== undefined ? isPremium : undefined,
          content: content || undefined,
          miniatura: miniatura || undefined,
          duration: duration || undefined,
        },
      });
    }

    // Actualizar módulos si se proporcionan
    if (modules && Array.isArray(modules)) {
      // Obtener IDs de módulos actuales
      const currentModules = await prisma.lessonModule.findMany({
        where: { lessonId: id },
      });
      const currentModuleIds = currentModules.map((m) => m.id);
      const incomingModuleIds = modules.filter((m: any) => m.id && currentModuleIds.includes(m.id)).map((m: any) => m.id);

      // Eliminar módulos que no están en la lista de entrada
      const modulesToDelete = currentModuleIds.filter((id) => !incomingModuleIds.includes(id));
      if (modulesToDelete.length > 0) {
        await prisma.lessonModule.deleteMany({
          where: { id: { in: modulesToDelete } },
        });
      }

      // Actualizar o crear módulos
      for (let idx = 0; idx < modules.length; idx++) {
        const module = modules[idx];
        if (module.id && currentModuleIds.includes(module.id)) {
          // Actualizar módulo existente
          await prisma.lessonModule.update({
            where: { id: module.id },
            data: {
              titulo: module.titulo,
              contenido: module.contenido,
              orden: idx + 1,
            },
          });
        } else {
          // Crear nuevo módulo
          await prisma.lessonModule.create({
            data: {
              lessonId: id,
              titulo: module.titulo,
              contenido: module.contenido,
              orden: idx + 1,
            },
          });
        }
      }
    }

    // Obtener la lección actualizada con módulos
    const finalLesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        modules: { orderBy: { orden: "asc" } },
        tutor: { select: { id: true, username: true } },
      },
    });

    res.json({ lesson: finalLesson });
  } catch (error) {
    console.error("Error updating lesson:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Eliminar una lección (solo tutor creator)
 * DELETE /lessons/:id
 */
export const deleteLessonCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Obtener información del usuario
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Verificar que la lección existe
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    // Permitir eliminación solo si es el creador o ADMIN
    const canDelete = lesson.createdBy === userId || user.role === "ADMIN";
    if (!canDelete) {
      res.status(403).json({ error: "Forbidden: Only the lesson creator or admin can delete" });
      return;
    }

    await prisma.lesson.delete({ where: { id } });
    
    // Log de eliminación de lección
    await logAdminAction(req, {
      adminId: userId,
      action: "DELETE_LESSON",
      targetResource: id,
      resourceType: ResourceType.LESSON,
      oldValue: { title: lesson.title, isPremium: lesson.isPremium },
      success: true,
    });

    res.json({ message: "Lesson deleted successfully" });
  } catch (error) {
    console.error("Error deleting lesson:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Obtener estudiantes candidatos para asignación (todos los estudiantes)
 * GET /lessons/candidates
 */
export const getLessonCandidatesCtrl = async (_req: AuthRequest, res: Response) => {
  try {
    const candidates = await prisma.user.findMany({
      where: {
        role: {
          in: ["STUDENT_PRO", "STUDENT_FREE"],
        },
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
      },
      orderBy: { username: "asc" },
    });

    res.json({ candidates });
  } catch (error) {
    console.error("Error fetching candidates:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Asignar lección a estudiantes
 * POST /lessons/assign
 */
export const assignLessonCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId, userIds } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!lessonId || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ error: "lessonId and userIds array are required" });
      return;
    }

    // Verificar que la lección existe y que el usuario es el creador
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson || lesson.createdBy !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Validar que los usuarios existen y son estudiantes (cualquier tipo)
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        role: { in: ["STUDENT_PRO", "STUDENT_FREE"] },
      },
      select: { id: true },
    });

    if (validUsers.length === 0) {
      res.status(400).json({ error: "No valid students found" });
      return;
    }

    // Crear asignaciones
    const assignments = await prisma.lessonAssignment.createMany({
      data: validUsers.map((user) => ({
        lessonId,
        userId: user.id,
      })),
      skipDuplicates: true,
    });

    // Crear registros de progreso iniciales
    await prisma.lessonProgress.createMany({
      data: validUsers.map((user) => ({
        lessonId,
        userId: user.id,
        percentage: 0,
        modulosVistos: 0,
      })),
      skipDuplicates: true,
    });

    res.status(201).json({
      message: "Lesson assigned successfully",
      assignedCount: assignments.count,
    });
  } catch (error) {
    console.error("Error assigning lesson:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Actualizar progreso de la lección (marcar módulo como visto)
 * POST /lessons/progress
 */
export const updateLessonProgressCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId, moduleOrder } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!lessonId || moduleOrder === undefined) {
      res.status(400).json({ error: "lessonId and moduleOrder are required" });
      return;
    }

    // Obtener la lección y módulos
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { modules: true },
    });

    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    const totalModules = lesson.modules.length;
    const modulosVistos = moduleOrder; // moduleOrder es el número de módulos vistos

    // Obtener o crear el progreso
    let progress = await prisma.lessonProgress.findUnique({
      where: {
        lessonId_userId: { lessonId, userId },
      },
    });

    if (!progress) {
      progress = await prisma.lessonProgress.create({
        data: {
          lessonId,
          userId,
          modulosVistos,
          percentage: Math.round((modulosVistos / totalModules) * 100),
        },
      });
    } else {
      // Actualizar módulos vistos y recalcular porcentaje
      const newModulosVistos = Math.min(modulosVistos, totalModules);
      const newPercentage = Math.round((newModulosVistos / totalModules) * 100);
      const isCompleted = newPercentage === 100;

      progress = await prisma.lessonProgress.update({
        where: {
          lessonId_userId: { lessonId, userId },
        },
        data: {
          modulosVistos: newModulosVistos,
          percentage: newPercentage,
          status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
          completedAt: isCompleted ? new Date() : null,
          lastAccessAt: new Date(),
        },
      });

      // Log de completar lección
      if (isCompleted) {
        await logUserActivity(req, {
          userId,
          action: ActivityAction.COMPLETE_LESSON,
          resource: lessonId,
          resourceType: ResourceType.LESSON,
          success: true,
          details: { 
            lessonTitle: lesson.title, 
            totalModules,
            isPremium: lesson.isPremium,
          },
        });

        // Si es premium, registrar acceso completado
        if (lesson.isPremium) {
          await logPremiumAccess(req, {
            userId,
            contentType: "LESSON",
            contentId: lessonId,
            contentTitle: lesson.title,
            accessType: "COMPLETE",
          });
        }
      }
    }

    res.json({ progress });
  } catch (error) {
    console.error("Error updating lesson progress:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Obtener progreso del estudiante en una lección
 * GET /lessons/:id/progress
 */
export const getStudentLessonProgressCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let progress = await prisma.lessonProgress.findUnique({
      where: {
        lessonId_userId: { lessonId: id, userId },
      },
      include: {
        lesson: {
          include: { modules: { orderBy: { orden: "asc" } } },
        },
      },
    });

    // Si no existe progreso, crear uno nuevo con valores iniciales
    if (!progress) {
      const lesson = await prisma.lesson.findUnique({
        where: { id },
        include: { modules: { orderBy: { orden: "asc" } } },
      });

      if (!lesson) {
        res.status(404).json({ error: "Lesson not found" });
        return;
      }

      progress = await prisma.lessonProgress.create({
        data: {
          lessonId: id,
          userId,
          percentage: 0,
          modulosVistos: 0,
          status: "IN_PROGRESS",
        },
        include: {
          lesson: {
            include: { modules: { orderBy: { orden: "asc" } } },
          },
        },
      });
    }

    res.json({ progress });
  } catch (error) {
    console.error("Error fetching progress:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Obtener todas las lecciones asignadas a un estudiante
 * GET /lessons/student/my-lessons
 */
export const getStudentLessonsCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const assignments = await prisma.lessonAssignment.findMany({
      where: { userId },
      include: {
        lesson: {
          include: {
            tutor: { select: { id: true, username: true } },
            modules: { orderBy: { orden: "asc" } },
            progress: {
              where: { userId },
              select: { percentage: true, modulosVistos: true, status: true },
            },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    res.json({ lessons: assignments.map((a) => a.lesson) });
  } catch (error) {
    console.error("Error fetching student lessons:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Obtener todas las lecciones creadas por el tutor actual
 * GET /lessons/tutor/my-lessons
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
      include: {
        tutor: {
          select: { id: true, username: true },
        },
        modules: {
          orderBy: { orden: "asc" },
        },
        _count: {
          select: {
            assignments: true,
            progress: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ lessons });
  } catch (error) {
    console.error("Error fetching tutor lessons:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

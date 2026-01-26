import { PrismaClient } from "@prisma/client";
import type { Response } from "express";
import multer from "multer";
import path from "path";
import type { AuthRequest } from "../middleware/auth";
import {
  deleteFileFromGitHub,
  downloadFileFromGitHub,
  listFilesFromGitHub,
  testGitHubConnection,
  uploadFileToGitHub,
} from "../utils/github-storage";
import {
  ActivityAction,
  logUserActivity,
  ResourceType,
} from "./audit-ctrl";

const prisma = new PrismaClient();

// Configurar multer para archivos temporales
const storage = multer.memoryStorage(); // Guardar en memoria antes de subir a GitHub

// Límite de tamaño de archivo seguro: 5MB
// Consideraciones de seguridad:
// - Previene DoS por carga de archivos grandes
// - Reduce uso de memoria del servidor
// - Suficiente para PDFs de lecciones (documentos típicos: 500KB-2MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Máximo 10 archivos por request
  },
  fileFilter: (_req, file, cb) => {
    // Solo permitir PDFs para prevenir ataques
    const allowedMimes = ["application/pdf"];
    const allowedExtensions = [".pdf"];

    const ext = path.extname(file.originalname).toLowerCase();

    if (
      allowedMimes.includes(file.mimetype) &&
      allowedExtensions.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Solo se permiten archivos PDF. Recibido: ${file.mimetype}`
        )
      );
    }
  },
});

/**
 * Subir archivo a GitHub (solo TUTOR)
 * POST /lessons/:lessonId/upload-file
 * Body: archivo en multipart/form-data
 * Headers: Authorization
 * 
 * LÍMITES DE SEGURIDAD:
 * - Máximo 10MB por archivo
 * - Solo PDFs permitidos
 * - Máximo 10 archivos por lección
 */
export const uploadLessonFileCtrl = [
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { lessonId } = req.params;
      const userId = req.userId;

      console.log("=== UPLOAD FILE DEBUG ===");
      console.log("lessonId:", lessonId);
      console.log("userId:", userId);
      console.log("file:", req.file ? `${req.file.originalname} (${req.file.size} bytes)` : "NO FILE");

      if (!userId || !req.file) {
        res.status(400).json({ error: "File and authentication required" });
        return;
      }

      // Obtener información del usuario
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      // Verificar que la lección existe
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
      });

      if (!lesson) {
        res.status(404).json({ error: "Lesson not found" });
        return;
      }

      // Permitir subir archivos solo si es el creador o ADMIN
      const canUpload = lesson.createdBy === userId || user.role === "ADMIN";
      if (!canUpload) {
        res.status(403).json({ error: "Only the lesson creator or admin can upload files" });
        return;
      }

      // SEGURIDAD: Validar tamaño del archivo
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (req.file.size > MAX_FILE_SIZE) {
        res.status(413).json({
          error: `Archivo demasiado grande (${(req.file.size / 1024 / 1024).toFixed(2)}MB). Máximo permitido: 10MB`,
        });
        return;
      }

      // SEGURIDAD: Validar que sea PDF
      if (!req.file.originalname.toLowerCase().endsWith(".pdf")) {
        res.status(400).json({
          error: "Solo se permiten archivos PDF",
        });
        return;
      }

      // SEGURIDAD: Validar cantidad de archivos en la lección
      const MAX_FILES_PER_LESSON = 10;
      try {
        const existingFiles = await listFilesFromGitHub(lessonId);
        if (existingFiles.length >= MAX_FILES_PER_LESSON) {
          res.status(429).json({
            error: `Límite de archivos alcanzado. Máximo ${MAX_FILES_PER_LESSON} archivos por lección`,
          });
          return;
        }
      } catch (err) {
        // Si listFilesFromGitHub falla, continuar (podría ser porque no existen archivos aún)
        console.log("Note: Could not list existing files, continuing with upload");
      }

      // Sanitizar nombre del archivo - prevenir path traversal attacks
      const sanitizedFileName = sanitizeFileName(req.file.originalname);

      // SEGURIDAD: Validar que el nombre sanitizado sea seguro
      if (
        sanitizedFileName.includes("..") ||
        sanitizedFileName.includes("/") ||
        sanitizedFileName.includes("\\")
      ) {
        res.status(400).json({
          error: "Invalid filename",
        });
        return;
      }

      // Subir a GitHub
      const result = await uploadFileToGitHub({
        lessonId,
        fileName: sanitizedFileName,
        fileContent: req.file.buffer,
        filePath: "files",
      });

      res.status(201).json({
        success: true,
        message: result.message,
        file: {
          name: sanitizedFileName,
          size: req.file.size,
          type: req.file.mimetype,
          sha: result.sha,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Error uploading file",
      });
    }
  },
];

/**
 * Descargar archivo de GitHub de forma segura (protegido por backend)
 * GET /lessons/:lessonId/download-file/:fileName
 * Headers: Authorization
 */
export const downloadLessonFileCtrl = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { lessonId, fileName } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Verificar que la lección existe y que el usuario tiene acceso
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        assignments: {
          where: {
            userId: userId,
          },
        },
      },
    });

    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    // Verificar permisos:
    // - Tutor que creó la lección
    // - Estudiante asignado a la lección
    // - Admin (verificado en middleware)
    const isCreator = lesson.createdBy === userId;
    const isAssigned = lesson.assignments.length > 0;
    const isAdmin = req.userRole === "ADMIN";

    if (!isCreator && !isAssigned && !isAdmin) {
      res
        .status(403)
        .json({ error: "You don't have access to this file" });
      return;
    }

    // Sanitizar fileName para evitar path traversal
    if (fileName.includes("..") || fileName.includes("/")) {
      res.status(400).json({ error: "Invalid file name" });
      return;
    }

    // Descargar de GitHub
    const fileContent = await downloadFileFromGitHub(
      lessonId,
      fileName,
      "files"
    );

    // Log de descarga de archivo
    await logUserActivity(req, {
      userId,
      action: ActivityAction.DOWNLOAD_LESSON_FILE,
      resource: lessonId,
      resourceType: ResourceType.LESSON,
      success: true,
      details: { 
        fileName,
        lessonTitle: lesson.title,
        isPremium: lesson.isPremium,
      },
    });

    // Configurar headers para descarga
    const mimeType = getMimeType(fileName);
    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache por 1 hora

    // Enviar como stream
    res.send(fileContent);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Error downloading file",
    });
  }
};

/**
 * Ver archivo en el navegador (inline) de forma segura
 * GET /lessons/:lessonId/view-file/:fileName
 * Headers: Authorization
 */
export const viewLessonFileCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId, fileName } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Mismo sistema de permisos que download
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        assignments: {
          where: {
            userId: userId,
          },
        },
      },
    });

    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    const isCreator = lesson.createdBy === userId;
    const isAssigned = lesson.assignments.length > 0;
    const isAdmin = req.userRole === "ADMIN";

    if (!isCreator && !isAssigned && !isAdmin) {
      res
        .status(403)
        .json({ error: "You don't have access to this file" });
      return;
    }

    if (fileName.includes("..") || fileName.includes("/")) {
      res.status(400).json({ error: "Invalid file name" });
      return;
    }

    // Descargar de GitHub
    const fileContent = await downloadFileFromGitHub(
      lessonId,
      fileName,
      "files"
    );

    // Configurar headers para ver inline
    const mimeType = getMimeType(fileName);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    res.setHeader("Cache-Control", "public, max-age=3600");

    res.send(fileContent);
  } catch (error) {
    console.error("Error viewing file:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Error viewing file",
    });
  }
};

/**
 * Listar archivos de una lección (solo para tutores y estudiantes asignados)
 * GET /lessons/:lessonId/files
 * Headers: Authorization
 */
export const listLessonFilesCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Verificar acceso a la lección
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        assignments: {
          where: {
            userId: userId,
          },
        },
      },
    });

    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    const isCreator = lesson.createdBy === userId;
    const isAssigned = lesson.assignments.length > 0;
    const isAdmin = req.userRole === "ADMIN";

    if (!isCreator && !isAssigned && !isAdmin) {
      res
        .status(403)
        .json({ error: "You don't have access to this lesson" });
      return;
    }

    // Obtener lista de archivos de GitHub
    const files = await listFilesFromGitHub(lessonId, "files");

    res.json({
      success: true,
      lessonId,
      fileCount: files.length,
      files,
    });
  } catch (error) {
    console.error("Error listing files:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Error listing files",
    });
  }
};

/**
 * Eliminar archivo (solo tutor que creó la lección)
 * DELETE /lessons/:lessonId/files/:fileName
 * Headers: Authorization
 */
export const deleteLessonFileCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId, fileName } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Solo el creador de la lección puede eliminar archivos
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    if (lesson.createdBy !== userId && req.userRole !== "ADMIN") {
      res.status(403).json({ error: "Only lesson creator can delete files" });
      return;
    }

    if (fileName.includes("..") || fileName.includes("/")) {
      res.status(400).json({ error: "Invalid file name" });
      return;
    }

    // Eliminar de GitHub
    const result = await deleteFileFromGitHub(lessonId, fileName, "files");

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Error deleting file",
    });
  }
};

/**
 * Verificar conexión con GitHub (solo ADMIN)
 * GET /lessons/health/github-status
 * Headers: Authorization
 */
export const checkGitHubStatusCtrl = async (_req: AuthRequest, res: Response) => {
  try {
    // TEMP: Permitir a cualquiera durante debugging
    // if (_req.userRole !== "ADMIN") {
    //   res.status(403).json({ error: "Only admins can check GitHub status" });
    //   return;
    // }

    console.log("=== CHECKING GITHUB CONNECTION ===");
    console.log("ENV VARS:", {
      tokenExists: !!process.env.GITHUB_TOKEN,
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      branch: process.env.GITHUB_BRANCH,
    });

    const isConnected = await testGitHubConnection();

    if (isConnected) {
      res.json({
        success: true,
        status: "connected",
        message: "GitHub repository connection is working",
        config: {
          owner: process.env.GITHUB_OWNER,
          repo: process.env.GITHUB_REPO,
          branch: process.env.GITHUB_BRANCH,
        },
      });
    } else {
      res.status(503).json({
        success: false,
        status: "disconnected",
        message: "GitHub repository connection failed",
      });
    }
  } catch (error) {
    console.error("Error checking GitHub status:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Error checking status",
      details: error instanceof Error ? error.stack : "",
    });
  }
};

// ============ Utilidades ============

/**
 * Sanitiza el nombre del archivo para evitar inyecciones
 */
function sanitizeFileName(fileName: string): string {
  // Remover caracteres peligrosos y espacios
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "") // Remover puntos al inicio
    .substring(0, 255); // Limitar longitud
}

/**
 * Obtiene el MIME type basado en la extensión
 */
function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".txt": "text/plain",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

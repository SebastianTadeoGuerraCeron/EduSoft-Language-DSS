import express from "express";
import {
  createLessonCtrl,
  getAllLessonsCtrl,
  getLessonByIdCtrl,
  updateLessonCtrl,
  deleteLessonCtrl,
  getLessonCandidatesCtrl,
  assignLessonCtrl,
  updateLessonProgressCtrl,
  getStudentLessonProgressCtrl,
  getStudentLessonsCtrl,
  getTutorLessonsCtrl,
} from "../controllers/lesson-ctrl";
import {
  uploadLessonFileCtrl,
  downloadLessonFileCtrl,
  viewLessonFileCtrl,
  listLessonFilesCtrl,
  deleteLessonFileCtrl,
  checkGitHubStatusCtrl,
} from "../controllers/file-ctrl";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { checkLessonPremiumAccess, markPremiumContent } from "../middleware/checkPremiumAccess";

const routerLesson = express.Router();

// ===== Rutas públicas =====
/**
 * GET /lessons
 * Obtener todas las lecciones
 */
routerLesson.get("/", getAllLessonsCtrl as express.RequestHandler);

// ===== Rutas protegidas (requieren autenticación) - ESPECÍFICAS PRIMERO =====

/**
 * POST /lessons/create
 * Crear una nueva lección (solo TUTOR)
 */
routerLesson.post(
  "/create",
  authenticate as express.RequestHandler,
  authorize("TUTOR") as express.RequestHandler,
  createLessonCtrl as express.RequestHandler
);

/**
 * POST /lessons/assign
 * Asignar lección a estudiantes (solo TUTOR que creó la lección)
 */
routerLesson.post(
  "/assign",
  authenticate as express.RequestHandler,
  authorize("TUTOR") as express.RequestHandler,
  assignLessonCtrl as express.RequestHandler
);

/**
 * POST /lessons/progress
 * Actualizar progreso de la lección
 */
routerLesson.post(
  "/progress",
  authenticate as express.RequestHandler,
  updateLessonProgressCtrl as express.RequestHandler
);

/**
 * GET /lessons/candidates
 * Obtener estudiantes candidatos para asignación
 * Query params: type=PRO|FREE
 */
routerLesson.get(
  "/candidates",
  authenticate as express.RequestHandler,
  authorize("TUTOR") as express.RequestHandler,
  getLessonCandidatesCtrl as express.RequestHandler
);

/**
 * GET /lessons/student/my-lessons
 * Obtener todas las lecciones asignadas a un estudiante
 */
routerLesson.get(
  "/student/my-lessons",
  authenticate as express.RequestHandler,
  getStudentLessonsCtrl as express.RequestHandler
);

/**
 * GET /lessons/tutor/my-lessons
 * Obtener todas las lecciones creadas por el tutor
 */
routerLesson.get(
  "/tutor/my-lessons",
  authenticate as express.RequestHandler,
  authorize("TUTOR") as express.RequestHandler,
  getTutorLessonsCtrl as express.RequestHandler
);

/**
 * GET /lessons/health/github-status
 * Verificar estado de conexión con GitHub
 * TEMP: Public for debugging
 */
routerLesson.get(
  "/health/github-status",
  checkGitHubStatusCtrl as express.RequestHandler
);

// ===== Rutas dinámicas (con :id) - VAN DESPUÉS DE LAS ESPECÍFICAS =====

/**
 * GET /lessons/:id
 * Obtener una lección por ID
 * Incluye validación de acceso premium (HU05)
 */
routerLesson.get(
  "/:id",
  authenticate as express.RequestHandler,
  markPremiumContent as express.RequestHandler,
  checkLessonPremiumAccess as express.RequestHandler,
  getLessonByIdCtrl as express.RequestHandler
);

/**
 * PUT /lessons/:id
 * Actualizar una lección (solo el creador)
 */
routerLesson.put(
  "/:id",
  authenticate as express.RequestHandler,
  updateLessonCtrl as express.RequestHandler
);

/**
 * DELETE /lessons/:id
 * Eliminar una lección (solo el creador)
 */
routerLesson.delete(
  "/:id",
  authenticate as express.RequestHandler,
  deleteLessonCtrl as express.RequestHandler
);

/**
 * GET /lessons/:id/progress
 * Obtener progreso del estudiante en una lección
 */
routerLesson.get(
  "/:id/progress",
  authenticate as express.RequestHandler,
  getStudentLessonProgressCtrl as express.RequestHandler
);

// ===== Rutas de archivos (con GitHub) =====

/**
 * POST /lessons/:lessonId/upload-file
 * Subir archivo a una lección (solo TUTOR que creó la lección)
 * Multipart form-data con campo "file"
 */
routerLesson.post(
  "/:lessonId/upload-file",
  authenticate as express.RequestHandler,
  authorize("TUTOR") as express.RequestHandler,
  uploadLessonFileCtrl as any
);

/**
 * GET /lessons/:lessonId/files
 * Listar archivos de una lección (protegido por permisos)
 */
routerLesson.get(
  "/:lessonId/files",
  authenticate as express.RequestHandler,
  listLessonFilesCtrl as express.RequestHandler
);

/**
 * GET /lessons/:lessonId/download-file/:fileName
 * Descargar archivo de una lección (seguro a través del backend)
 * El backend valida permisos antes de servir el archivo
 */
routerLesson.get(
  "/:lessonId/download-file/:fileName",
  authenticate as express.RequestHandler,
  downloadLessonFileCtrl as express.RequestHandler
);

/**
 * GET /lessons/:lessonId/view-file/:fileName
 * Ver archivo en el navegador (inline) de forma segura
 * El backend valida permisos antes de servir el archivo
 */
routerLesson.get(
  "/:lessonId/view-file/:fileName",
  authenticate as express.RequestHandler,
  viewLessonFileCtrl as express.RequestHandler
);

/**
 * DELETE /lessons/:lessonId/files/:fileName
 * Eliminar archivo de una lección (solo creador de la lección o ADMIN)
 */
routerLesson.delete(
  "/:lessonId/files/:fileName",
  authenticate as express.RequestHandler,
  deleteLessonFileCtrl as express.RequestHandler
);

export { routerLesson };

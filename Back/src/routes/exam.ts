import express from "express";
import {
    auditExamCtrl,
    createExamCtrl,
    deleteExamCtrl,
    getAllExamsCtrl,
    getExamByIdCtrl,
    getExamResultsCtrl,
    getTutorExamsCtrl,
    getTutorLessonsCtrl,
    getTutorStatsCtrl,
    getUserAttemptsCtrl,
    startExamCtrl,
    submitExamCtrl,
    updateExamCtrl,
} from "../controllers/exam-ctrl";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { checkExamPremiumAccess, markPremiumContent } from "../middleware/checkPremiumAccess";

const routerExam = express.Router();

// ===== Rutas para TUTORES =====

/**
 * GET /exams/tutor/lessons
 * Obtener lecciones del tutor para el dropdown de crear examen
 */
routerExam.get(
  "/tutor/lessons",
  authenticate as express.RequestHandler,
  authorize("TUTOR") as express.RequestHandler,
  getTutorLessonsCtrl as express.RequestHandler
);

/**
 * GET /exams/tutor/exams
 * Obtener exámenes creados por el tutor
 */
routerExam.get(
  "/tutor/exams",
  authenticate as express.RequestHandler,
  authorize("TUTOR") as express.RequestHandler,
  getTutorExamsCtrl as express.RequestHandler
);

/**
 * GET /exams/tutor/stats
 * Obtener estadísticas del tutor
 */
routerExam.get(
  "/tutor/stats",
  authenticate as express.RequestHandler,
  authorize("TUTOR") as express.RequestHandler,
  getTutorStatsCtrl as express.RequestHandler
);

/**
 * POST /exams/create
 * Crear un nuevo examen (solo TUTOR)
 */
routerExam.post(
  "/create",
  authenticate as express.RequestHandler,
  authorize("TUTOR") as express.RequestHandler,
  createExamCtrl as express.RequestHandler
);

// ===== Rutas para ESTUDIANTES =====

/**
 * POST /exams/audit
 * Registrar actividad de auditoría (anti-trampa)
 */
routerExam.post(
  "/audit",
  authenticate as express.RequestHandler,
  auditExamCtrl as express.RequestHandler
);

/**
 * GET /exams/user/:userId/attempts
 * Obtener historial de intentos del usuario
 */
routerExam.get(
  "/user/:userId/attempts",
  authenticate as express.RequestHandler,
  getUserAttemptsCtrl as express.RequestHandler
);

/**
 * GET /exams
 * Obtener todos los exámenes (con filtros opcionales)
 * Requiere autenticación para filtrar por lecciones asignadas
 */
routerExam.get(
  "/",
  authenticate as express.RequestHandler,
  getAllExamsCtrl as express.RequestHandler
);

/**
 * GET /exams/:id
 * Obtener un examen por ID (sin respuestas correctas para estudiantes)
 */
routerExam.get(
  "/:id",
  authenticate as express.RequestHandler,
  getExamByIdCtrl as express.RequestHandler
);

/**
 * POST /exams/:id/start
 * Iniciar un intento de examen
 * Incluye validación de acceso premium (HU05)
 */
routerExam.post(
  "/:id/start",
  authenticate as express.RequestHandler,
  markPremiumContent as express.RequestHandler,
  checkExamPremiumAccess as express.RequestHandler,
  startExamCtrl as express.RequestHandler
);

/**
 * POST /exams/:id/submit
 * Enviar respuestas y calificar examen
 */
routerExam.post(
  "/:id/submit",
  authenticate as express.RequestHandler,
  submitExamCtrl as express.RequestHandler
);

/**
 * GET /exams/:id/results/:attemptId
 * Obtener resultados detallados de un intento
 */
routerExam.get(
  "/:id/results/:attemptId",
  authenticate as express.RequestHandler,
  getExamResultsCtrl as express.RequestHandler
);

/**
 * DELETE /exams/:id
 * Eliminar un examen (solo el tutor creador)
 */
routerExam.delete(
  "/:id",
  authenticate as express.RequestHandler,
  authorize("TUTOR") as express.RequestHandler,
  deleteExamCtrl as express.RequestHandler
);

/**
 * PUT /exams/:id
 * Actualizar un examen (solo el tutor creador)
 */
routerExam.put(
  "/:id",
  authenticate as express.RequestHandler,
  authorize("TUTOR") as express.RequestHandler,
  updateExamCtrl as express.RequestHandler
);

export { routerExam };


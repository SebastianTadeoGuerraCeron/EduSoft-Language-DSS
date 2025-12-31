import api from "../API";

// ===== Servicios de Exámenes =====

/**
 * Obtener todos los exámenes
 * @param {Object} filters - Filtros opcionales (lessonId, isPremium)
 */
export const getAllExams = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.lessonId) params.append("lessonId", filters.lessonId);
    if (filters.isPremium !== undefined) params.append("isPremium", filters.isPremium);
    
    const response = await api.get(`/exams?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching exams:", error);
    throw error;
  }
};

/**
 * Obtener un examen por ID
 * @param {string} id - ID del examen
 */
export const getExamById = async (id) => {
  try {
    const response = await api.get(`/exams/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching exam:", error);
    throw error;
  }
};

/**
 * Crear un nuevo examen (solo TUTOR)
 * @param {Object} examData - Datos del examen
 */
export const createExam = async (examData) => {
  try {
    const response = await api.post("/exams/create", examData);
    return response.data;
  } catch (error) {
    console.error("Error creating exam:", error);
    throw error;
  }
};

/**
 * Iniciar un intento de examen
 * @param {string} examId - ID del examen
 */
export const startExam = async (examId) => {
  try {
    const response = await api.post(`/exams/${examId}/start`);
    return response.data;
  } catch (error) {
    console.error("Error starting exam:", error);
    throw error;
  }
};

/**
 * Enviar respuestas y calificar examen
 * @param {string} examId - ID del examen
 * @param {string} attemptId - ID del intento
 * @param {Object} answers - Respuestas { questionId: answer }
 * @param {number} timeTaken - Tiempo tomado en segundos
 */
export const submitExam = async (examId, attemptId, answers, timeTaken) => {
  try {
    const response = await api.post(`/exams/${examId}/submit`, {
      attemptId,
      answers,
      timeTaken,
    });
    return response.data;
  } catch (error) {
    console.error("Error submitting exam:", error);
    throw error;
  }
};

/**
 * Obtener resultados de un intento
 * @param {string} examId - ID del examen
 * @param {string} attemptId - ID del intento
 */
export const getExamResults = async (examId, attemptId) => {
  try {
    const response = await api.get(`/exams/${examId}/results/${attemptId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching exam results:", error);
    throw error;
  }
};

/**
 * Obtener historial de intentos del usuario
 * @param {string} userId - ID del usuario
 */
export const getUserAttempts = async (userId) => {
  try {
    const response = await api.get(`/exams/user/${userId}/attempts`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user attempts:", error);
    throw error;
  }
};

/**
 * Registrar actividad de auditoría (anti-trampa)
 * @param {string} attemptId - ID del intento
 * @param {string} activityType - Tipo de actividad (tab_switch, window_blur, etc.)
 * @param {Object} details - Detalles adicionales opcionales
 */
export const recordAudit = async (attemptId, activityType, details = null) => {
  try {
    const response = await api.post("/exams/audit", {
      attemptId,
      activityType,
      details,
    });
    return response.data;
  } catch (error) {
    console.error("Error recording audit:", error);
    // No lanzar error para no interrumpir el examen
  }
};

/**
 * Eliminar un examen (solo TUTOR creador)
 * @param {string} examId - ID del examen
 */
export const deleteExam = async (examId) => {
  try {
    const response = await api.delete(`/exams/${examId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting exam:", error);
    throw error;
  }
};

// ===== Servicios para TUTORES =====

/**
 * Obtener lecciones del tutor (para dropdown)
 */
export const getTutorLessons = async () => {
  try {
    const response = await api.get("/exams/tutor/lessons");
    return response.data;
  } catch (error) {
    console.error("Error fetching tutor lessons:", error);
    throw error;
  }
};

/**
 * Obtener exámenes creados por el tutor
 */
export const getTutorExams = async () => {
  try {
    const response = await api.get("/exams/tutor/exams");
    return response.data;
  } catch (error) {
    console.error("Error fetching tutor exams:", error);
    throw error;
  }
};

/**
 * Obtener estadísticas del tutor
 */
export const getTutorStats = async () => {
  try {
    const response = await api.get("/exams/tutor/stats");
    return response.data;
  } catch (error) {
    console.error("Error fetching tutor stats:", error);
    throw error;
  }
};

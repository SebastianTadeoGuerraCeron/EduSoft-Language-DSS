import api from "../API";

// ===== Servicios de Lecciones =====

/**
 * Obtener todas las lecciones
 */
export const getAllLessons = async () => {
  try {
    const response = await api.get("/lessons");
    return response.data;
  } catch (error) {
    console.error("Error fetching lessons:", error);
    throw error;
  }
};

/**
 * Obtener una lección por ID
 */
export const getLessonById = async (id) => {
  try {
    const response = await api.get(`/lessons/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching lesson:", error);
    throw error;
  }
};

/**
 * Crear una nueva lección
 */
export const createLesson = async (lessonData) => {
  try {
    const response = await api.post("/lessons/create", lessonData);
    return response.data;
  } catch (error) {
    console.error("Error creating lesson:", error);
    throw error;
  }
};

/**
 * Actualizar una lección
 */
export const updateLesson = async (id, lessonData) => {
  try {
    const response = await api.put(`/lessons/${id}`, lessonData);
    return response.data;
  } catch (error) {
    console.error("Error updating lesson:", error);
    throw error;
  }
};

/**
 * Eliminar una lección
 */
export const deleteLesson = async (id) => {
  try {
    const response = await api.delete(`/lessons/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting lesson:", error);
    throw error;
  }
};

/**
 * Obtener candidatos para asignación (todos los estudiantes)
 */
export const getLessonCandidates = async () => {
  try {
    const response = await api.get("/lessons/candidates");
    return response.data;
  } catch (error) {
    console.error("Error fetching candidates:", error);
    throw error;
  }
};

/**
 * Asignar lección a estudiantes
 */
export const assignLesson = async (lessonId, userIds) => {
  try {
    const response = await api.post("/lessons/assign", {
      lessonId,
      userIds,
    });
    return response.data;
  } catch (error) {
    console.error("Error assigning lesson:", error);
    throw error;
  }
};

/**
 * Actualizar progreso de la lección
 */
export const updateLessonProgress = async (lessonId, moduleOrder) => {
  try {
    const response = await api.post("/lessons/progress", {
      lessonId,
      moduleOrder,
    });
    return response.data;
  } catch (error) {
    console.error("Error updating progress:", error);
    throw error;
  }
};

/**
 * Obtener progreso del estudiante en una lección
 */
export const getStudentLessonProgress = async (lessonId) => {
  try {
    const response = await api.get(`/lessons/${lessonId}/progress`);
    return response.data;
  } catch (error) {
    console.error("Error fetching student progress:", error);
    throw error;
  }
};

/**
 * Obtener todas las lecciones asignadas al estudiante
 */
export const getStudentLessons = async () => {
  try {
    const response = await api.get("/lessons/student/my-lessons");
    return response.data;
  } catch (error) {
    console.error("Error fetching student lessons:", error);
    throw error;
  }
};

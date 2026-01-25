import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Interceptor de requests: Headers adicionales si es necesario
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de responses: Manejar errores de autenticación
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Si el token ha expirado o es inválido
    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.error;

      // Solo hacer logout automático si el error es de token
      if (
        errorMessage === "Token expired" ||
        errorMessage === "Invalid token" ||
        errorMessage === "No token provided"
      ) {
        // Marcar sesión como expirada y redirigir
        localStorage.setItem("sessionExpired", "true");
        window.location.href = "#/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;

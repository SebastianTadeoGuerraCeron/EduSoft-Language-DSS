import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor de requests: Agregar token JWT a todas las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
        // Limpiar datos de autenticación
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.setItem("sessionExpired", "true");

        // Redirigir al login
        window.location.href = "#/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;

import { createContext, useContext, useEffect, useState } from "react";
import api from "../API";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Verificar sesión al cargar llamando al backend
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await api.get("/user/me");
        if (response.data.user) {
          setUser(response.data.user);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    // Verificar sesión cada 5 minutos
    const interval = setInterval(checkSession, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const login = async (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post("/user/logout");
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      localStorage.setItem(
        "logoutSuccess",
        "Session closed successfully, see you soon!",
      );
      localStorage.removeItem("loginSuccess");
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
  };

  const hasRole = (roles) => {
    if (!user || !user.role) return false;
    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    return user.role === roles;
  };

  // Verificar si el usuario tiene acceso premium (HU05)
  const isPremium = () => {
    if (!user || !user.role) return false;
    return (
      user.role === "STUDENT_PRO" ||
      user.role === "ADMIN" ||
      user.role === "TUTOR"
    );
  };

  // Verificar si puede acceder a contenido premium
  const canAccessPremiumContent = (content) => {
    if (!content) return false;
    // Contenido gratuito - todos pueden acceder
    if (!content.isPremium) return true;
    // Contenido premium - verificar rol
    return isPremium();
  };

  // Refrescar datos del usuario desde el servidor
  const refreshUser = async () => {
    try {
      const response = await api.get("/user/me");
      if (response.data.user) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        login,
        logout,
        updateUser,
        refreshUser,
        hasRole,
        isPremium,
        canAccessPremiumContent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../API';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
    });

    // Verificar expiración del token al cargar
    useEffect(() => {
        const checkTokenExpiration = () => {
            const token = localStorage.getItem('token');

            if (!token) {
                setIsAuthenticated(false);
                setUser(null);
                setIsLoading(false);
                return;
            }

            try {
                const decoded = jwtDecode(token);
                const currentTime = Date.now() / 1000;

                // Si el token ha expirado
                if (decoded.exp < currentTime) {
                    logout();
                    localStorage.setItem('sessionExpired', 'true');
                } else {
                    setIsAuthenticated(true);
                    const stored = localStorage.getItem('user');
                    if (stored) {
                        setUser(JSON.parse(stored));
                    }
                }
            } catch (error) {
                console.error('Error decoding token:', error);
                logout();
            } finally {
                setIsLoading(false);
            }
        };

        checkTokenExpiration();

        // Verificar expiración cada 5 minutos
        const interval = setInterval(checkTokenExpiration, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    const login = (userData, token) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setIsAuthenticated(true);
        setUser(userData);
    };

    const logout = () => {
        localStorage.setItem('logoutSuccess', 'Session closed successfully, see you soon!');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('loginSuccess');
        setIsAuthenticated(false);
        setUser(null);
    };

    const updateUser = (userData) => {
        localStorage.setItem('user', JSON.stringify(userData));
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
        return user.role === 'STUDENT_PRO' || user.role === 'ADMIN' || user.role === 'TUTOR';
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
            const response = await api.get('/user/me');
            if (response.data.user) {
                localStorage.setItem('user', JSON.stringify(response.data.user));
                setUser(response.data.user);
            }
        } catch (error) {
            console.error('Error refreshing user:', error);
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
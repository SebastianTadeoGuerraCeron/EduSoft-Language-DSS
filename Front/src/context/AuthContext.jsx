import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
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

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
                user,
                login,
                logout,
                updateUser,
                hasRole,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
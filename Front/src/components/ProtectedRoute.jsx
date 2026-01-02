import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';

/**
 * Componente para proteger rutas por autenticación y roles
 * @param {ReactNode} children - Componentes hijos a renderizar si está autorizado
 * @param {string|string[]} allowedRoles - Rol o array de roles permitidos (opcional)
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { isAuthenticated, isLoading, hasRole } = useAuth();

    // Mostrar loading mientras se verifica la autenticación
    if (isLoading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '100vh',
                fontSize: '18px',
                color: '#666'
            }}>
                Loading...
            </div>
        );
    }

    // Si no está autenticado, redirigir al login
    if (!isAuthenticated) {
        localStorage.setItem(
            'redirectMessage',
            'Debes iniciar sesión para acceder a esta página'
        );
        return <Navigate to="/login" replace />;
    }

    // Si se especificaron roles permitidos, verificar que el usuario tenga uno
    if (allowedRoles && !hasRole(allowedRoles)) {
        localStorage.setItem(
            'redirectMessage',
            'No tienes permisos para acceder a esta página'
        );
        return <Navigate to="/home" replace />;
    }

    // Usuario autenticado y autorizado
    return children;
};

export default ProtectedRoute;

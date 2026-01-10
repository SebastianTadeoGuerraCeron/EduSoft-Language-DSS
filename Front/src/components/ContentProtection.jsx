import { useCallback, useEffect } from 'react';

// Estilos CSS para la protección
const protectionStyles = {
    container: {
        position: 'relative',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
    },
    // Marca de agua permanente
    watermarkOverlay: {
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 99990,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
    },
    watermarkItem: {
        transform: 'rotate(-25deg)',
        whiteSpace: 'nowrap',
        padding: '2.5rem 3.5rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.1rem',
    },
};

/**
 * Hook personalizado para protección de contenido
 * Bloquea atajos de teclado (Ctrl+C, Ctrl+P, etc.)
 */
export const useContentProtection = ({ 
    enabled = true, 
    onViolation = null,
    contentType = 'lesson',
} = {}) => {

    // Log de violación
    const logViolation = useCallback((type) => {
        if (onViolation) {
            onViolation({
                type,
                timestamp: new Date().toISOString(),
                contentType,
            });
        }
        console.warn(`[ContentProtection] Blocked: ${type}`);
    }, [contentType, onViolation]);

    // Handler para keydown (atajos de teclado)
    const handleKeyDown = useCallback((e) => {
        if (!enabled) return;

        // Ctrl+P (imprimir) - BLOQUEABLE
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            logViolation('PRINT_ATTEMPT');
            return;
        }

        // Ctrl+C (copiar) - solo en contenido protegido
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                logViolation('COPY_ATTEMPT');
                return;
            }
        }

        // Ctrl+S (guardar)
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            logViolation('SAVE_ATTEMPT');
            return;
        }

        // Ctrl+A (seleccionar todo)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                logViolation('SELECT_ALL_ATTEMPT');
                return;
            }
        }

        // F12 (DevTools)
        if (e.key === 'F12') {
            e.preventDefault();
            logViolation('DEVTOOLS_ATTEMPT');
            return;
        }

        // Ctrl+Shift+I (DevTools)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I')) {
            e.preventDefault();
            logViolation('DEVTOOLS_ATTEMPT');
            return;
        }

        // Ctrl+Shift+C (DevTools element picker)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            logViolation('DEVTOOLS_ATTEMPT');
            return;
        }

        // Ctrl+U (view source)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
            e.preventDefault();
            logViolation('VIEW_SOURCE_ATTEMPT');
            return;
        }
    }, [enabled, logViolation]);

    // Bloquear menú contextual
    const handleContextMenu = useCallback((e) => {
        if (!enabled) return;
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            logViolation('CONTEXT_MENU');
        }
    }, [enabled, logViolation]);

    // Bloquear arrastrar imágenes
    const handleDragStart = useCallback((e) => {
        if (!enabled) return;
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            logViolation('IMAGE_DRAG');
        }
    }, [enabled, logViolation]);

    // Configurar event listeners
    useEffect(() => {
        if (!enabled) return;

        // Agregar listeners
        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('contextmenu', handleContextMenu, true);
        document.addEventListener('dragstart', handleDragStart);

        // Deshabilitar selección via CSS
        const originalUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none';

        // Cleanup
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('contextmenu', handleContextMenu, true);
            document.removeEventListener('dragstart', handleDragStart);
            document.body.style.userSelect = originalUserSelect;
        };
    }, [enabled, handleKeyDown, handleContextMenu, handleDragStart]);

    return {};
};

/**
 * Componente wrapper para proteger contenido con marca de agua
 */
export const ContentProtection = ({ 
    children, 
    enabled = true,
    onViolation = null,
    contentType = 'lesson',
    userName = '',
    userEmail = '',
}) => {
    useContentProtection({ 
        enabled, 
        onViolation,
        contentType,
    });

    if (!enabled) {
        return <>{children}</>;
    }

    // Opacidad según tipo de contenido
    // Lecciones: sutil pero visible (8%)
    // Exámenes: más visible (12%)
    const watermarkOpacity = contentType === 'exam' ? 0.12 : 0.08;
    const watermarkColor = `rgba(128, 128, 128, ${watermarkOpacity})`;

    return (
        <div style={protectionStyles.container}>
            {/* Marca de agua permanente */}
            <div 
                style={protectionStyles.watermarkOverlay}
                aria-hidden="true"
            >
                {Array.from({ length: 12 }).map((_, i) => (
                    <div 
                        key={i} 
                        style={{
                            ...protectionStyles.watermarkItem,
                            color: watermarkColor,
                            fontSize: contentType === 'exam' ? '1.1rem' : '1rem',
                            fontWeight: contentType === 'exam' ? 600 : 500,
                        }}
                    >
                        <span>{contentType === 'exam' ? 'PROTECTED EXAM' : 'PROTECTED'}</span>
                        {userEmail && <span style={{ fontSize: '0.8rem' }}>{userEmail}</span>}
                        {userName && <span style={{ fontSize: '0.75rem' }}>{userName}</span>}
                    </div>
                ))}
            </div>

            {/* Contenido protegido */}
            <div>
                {children}
            </div>
        </div>
    );
};

/**
 * Componente de badge para indicar contenido protegido
 */
export const ProtectedContentBadge = () => (
    <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        backgroundColor: '#1e40af',
        color: 'white',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem',
        fontSize: '0.75rem',
        fontWeight: '500',
    }}>
        <span>Protected Content</span>
    </div>
);

export default ContentProtection;

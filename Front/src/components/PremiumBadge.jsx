import React from 'react';
import '../styles/Billing.css';

/**
 * Badge de contenido Premium
 * Muestra un indicador visual para contenido que requiere suscripción
 */
const PremiumBadge = ({ 
    size = 'normal', // 'small', 'normal', 'large'
    showText = true,
    style = {}
}) => {
    const sizeStyles = {
        small: { padding: '0.15rem 0.5rem', fontSize: '0.65rem' },
        normal: { padding: '0.25rem 0.75rem', fontSize: '0.75rem' },
        large: { padding: '0.35rem 1rem', fontSize: '0.875rem' }
    };

    return (
        <span 
            className="premium-badge"
            style={{ ...sizeStyles[size], ...style }}
        >
            {showText && 'PRO'}
        </span>
    );
};

/**
 * Badge de rol del usuario
 * Muestra el rol actual con estilo apropiado
 */
export const RoleBadge = ({ role, size = 'normal' }) => {
    const roleConfig = {
        ADMIN: { label: 'Admin', color: '#dc2626', bg: '#fee2e2' },
        TUTOR: { label: 'Tutor', color: '#2563eb', bg: '#dbeafe' },
        STUDENT_PRO: { label: 'Pro', color: '#7c3aed', bg: '#ede9fe' },
        STUDENT_FREE: { label: 'Free', color: '#6b7280', bg: '#f3f4f6' }
    };

    const config = roleConfig[role] || roleConfig.STUDENT_FREE;

    const sizeStyles = {
        small: { padding: '0.15rem 0.5rem', fontSize: '0.65rem' },
        normal: { padding: '0.25rem 0.75rem', fontSize: '0.75rem' },
        large: { padding: '0.35rem 1rem', fontSize: '0.875rem' }
    };

    if (role === 'STUDENT_PRO') {
        return <PremiumBadge size={size} />;
    }

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: '999px',
            fontWeight: '600',
            color: config.color,
            background: config.bg,
            ...sizeStyles[size]
        }}>
            {config.label}
        </span>
    );
};

/**
 * Icono de candado para contenido premium bloqueado
 */
export const PremiumLock = ({ size = 20 }) => {
    return (
        <span style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size,
            height: size,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: 'white',
            borderRadius: '4px',
            fontSize: size * 0.6
        }}>
            🔒
        </span>
    );
};

/**
 * Overlay de contenido premium bloqueado
 */
export const PremiumOverlay = ({ onUpgrade }) => {
    return (
        <div className="premium-lock-overlay">
            <div className="premium-lock-content">
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Premium Content</h3>
                <p style={{ margin: '0 0 1rem 0', opacity: 0.9 }}>
                    Upgrade to Pro to access this content
                </p>
                <button 
                    onClick={onUpgrade}
                    style={{
                        background: 'white',
                        color: '#7c3aed',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}
                >
                    Upgrade Now
                </button>
            </div>
        </div>
    );
};

export default PremiumBadge;

import React from 'react';
import { Link } from 'react-router';
import '../styles/Billing.css';

/**
 * Banner promocional para usuarios FREE
 * Se muestra en el dashboard y otras páginas para incentivar el upgrade
 */
const PremiumBanner = ({ 
    variant = 'full', // 'full', 'compact', 'minimal'
    onDismiss 
}) => {
    if (variant === 'minimal') {
        return (
            <Link 
                to="/pricing" 
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '999px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    textDecoration: 'none',
                    transition: 'transform 0.2s'
                }}
                className="hover-scale"
            >
                <span>👑</span>
                <span>Upgrade to Pro</span>
            </Link>
        );
    }

    if (variant === 'compact') {
        return (
            <div style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: 'white',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>👑</span>
                    <span>Unlock all premium content!</span>
                </div>
                <Link 
                    to="/pricing"
                    style={{
                        background: 'white',
                        color: '#7c3aed',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        fontWeight: '600',
                        textDecoration: 'none',
                        fontSize: '0.875rem'
                    }}
                >
                    Upgrade
                </Link>
            </div>
        );
    }

    // Full variant
    return (
        <div className="promo-banner">
            <div className="promo-banner-text">
                <h3>🚀 Unlock Your Full Potential!</h3>
                <p>Get access to all premium lessons, unlimited exams, and exclusive content.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link to="/pricing" className="promo-banner-button">
                    Upgrade to Pro
                </Link>
                {onDismiss && (
                    <button 
                        onClick={onDismiss}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '0.5rem',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        aria-label="Dismiss"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
};

/**
 * Banner de suscripción próxima a expirar
 */
export const ExpiringBanner = ({ daysLeft, onRenew }) => {
    return (
        <div style={{
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            color: '#92400e',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
        }}>
            <div>
                <strong>⚠️ Your subscription expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                    Renew now to keep access to premium content.
                </p>
            </div>
            <button 
                onClick={onRenew}
                style={{
                    background: '#92400e',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer'
                }}
            >
                Renew Subscription
            </button>
        </div>
    );
};

export default PremiumBanner;

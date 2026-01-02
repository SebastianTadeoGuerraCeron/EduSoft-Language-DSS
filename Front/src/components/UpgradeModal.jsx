import React from 'react';
import { Link, useNavigate } from 'react-router';
import '../styles/Billing.css';

/**
 * Modal de Upgrade
 * Se muestra cuando un usuario FREE intenta acceder a contenido premium
 */
const UpgradeModal = ({ 
    isOpen, 
    onClose, 
    contentTitle = 'this content',
    contentType = 'lesson' // 'lesson' o 'exam'
}) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleUpgrade = () => {
        onClose();
        navigate('/pricing');
    };

    return (
        <div className="upgrade-modal-overlay" onClick={onClose}>
            <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👑</div>
                
                <h2>Upgrade to Premium</h2>
                <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                    Access to <strong>{contentTitle}</strong> requires a premium subscription.
                </p>

                <div className="premium-features">
                    <h4 style={{ margin: '0 0 1rem 0' }}>What you'll get:</h4>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                        <li>✅ Access to all premium {contentType === 'lesson' ? 'lessons' : 'exams'}</li>
                        <li>✅ Unlimited exam attempts</li>
                        <li>✅ Priority support</li>
                        <li>✅ Ad-free experience</li>
                        <li>✅ Early access to new content</li>
                    </ul>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <button 
                        className="plan-button secondary"
                        onClick={onClose}
                        style={{ flex: 1 }}
                    >
                        Maybe Later
                    </button>
                    <button 
                        className="plan-button primary"
                        onClick={handleUpgrade}
                        style={{ flex: 1 }}
                    >
                        View Plans
                    </button>
                </div>

                <p style={{ 
                    marginTop: '1rem', 
                    fontSize: '0.875rem', 
                    color: '#666',
                    textAlign: 'center'
                }}>
                    Starting at just <strong>$9.99/month</strong>
                </p>
            </div>
        </div>
    );
};

export default UpgradeModal;

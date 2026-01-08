import React, { useState } from 'react';
import '../styles/Billing.css';

/**
 * Modal de Re-autenticación
 * Cumple con HU06: Re-autenticación para acciones críticas
 * 
 * Se muestra antes de realizar operaciones sensibles como:
 * - Cancelar suscripción
 * - Actualizar método de pago
 * - Ver datos sensibles de billing
 */
const ReAuthModal = ({
    title = 'Confirm Action',
    message = 'Please enter your password to continue.',
    onConfirm,
    onCancel,
    loading = false,
    confirmText = 'Confirm',
    confirmDanger = false
}) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!password.trim()) {
            setError('Please enter your password');
            return;
        }

        try {
            await onConfirm(password);
        } catch (err) {
            setError(err.message || 'Authentication failed. Please try again.');
        }
    };

    return (
        <div className="reauth-modal-overlay" onClick={onCancel}>
            <div className="reauth-modal" onClick={(e) => e.stopPropagation()}>
                <h3>{title}</h3>
                <p>{message}</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="reauth-password">Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="reauth-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                autoFocus
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '1rem'
                                }}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            color: '#dc2626',
                            fontSize: '0.875rem',
                            marginTop: '0.5rem',
                            padding: '0.5rem',
                            background: '#fee2e2',
                            borderRadius: '4px'
                        }}>
                            {error}
                        </div>
                    )}

                    <div className="reauth-buttons">
                        <button
                            type="button"
                            className="cancel-btn"
                            onClick={onCancel}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="confirm-btn"
                            disabled={loading}
                            style={confirmDanger ? { background: '#dc2626' } : {}}
                        >
                            {loading ? 'Verifying...' : confirmText}
                        </button>
                    </div>
                </form>

                <div style={{
                    marginTop: '1rem',
                    fontSize: '0.75rem',
                    color: '#666',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <span></span>
                    <span>This verification helps protect your account security</span>
                </div>
            </div>
        </div>
    );
};

export default ReAuthModal;

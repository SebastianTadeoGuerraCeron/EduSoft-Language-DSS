import React, { useState } from 'react';

/**
 * Modal de Confirmación para Eliminación de Cuenta (HU10)
 * Cumple con FDP_RIP.1 - Eliminación segura de datos residuales
 * 
 * Realiza:
 * 1. Confirmación explícita del usuario
 * 2. Solicitud de contraseña para validar identidad
 * 3. Advertencia clara sobre la irreversibilidad
 */
const DeleteAccountModal = ({
    isOpen = false,
    onConfirm,
    onCancel,
    loading = false,
    username = 'User'
}) => {
    const [password, setPassword] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    const handleConfirm = async () => {
        setError(null);

        // Validar que escribió el texto de confirmación
        if (confirmText !== username) {
            setError(`Please type "${username}" to confirm`);
            return;
        }

        // Validar contraseña
        if (!password.trim()) {
            setError('Please enter your password to confirm deletion');
            return;
        }

        try {
            await onConfirm(password);
        } catch (err) {
            setError(err.message || 'Failed to delete account. Please try again.');
        }
    };

    const handleCancel = () => {
        setPassword('');
        setConfirmText('');
        setError(null);
        onCancel();
    };

    if (!isOpen) return null;

    return (
        <div className="delete-account-overlay" onClick={handleCancel}>
            <div 
                className="delete-account-modal" 
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    padding: '2rem',
                    maxWidth: '500px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                    border: '2px solid #dc2626'
                }}
            >
                {/* Header con advertencia */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ 
                        color: '#dc2626', 
                        marginBottom: '0.5rem',
                        fontSize: '1.5rem'
                    }}>
                        Delete Account
                    </h2>
                    <p style={{ color: '#666', margin: 0 }}>
                        This action cannot be undone
                    </p>
                </div>

                {/* Advertencias */}
                <div style={{
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    fontSize: '0.95rem'
                }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                        All data will be permanently deleted:
                    </p>
                    <ul style={{ margin: '0.5rem 0 0 1.5rem', paddingLeft: 0 }}>
                        <li>Profile information</li>
                        <li>Learning progress</li>
                        <li>Game history</li>
                        <li>Payment history</li>
                        <li>All subscriptions</li>
                    </ul>
                </div>

                {/* Formulario */}
                <form onSubmit={(e) => { e.preventDefault(); handleConfirm(); }}>
                    {/* Confirmación de tipo */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontWeight: '500',
                            fontSize: '0.9rem'
                        }}>
                            Type "{username}" to confirm:
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder={username}
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '1rem',
                                fontFamily: 'monospace',
                                boxSizing: 'border-box',
                                opacity: loading ? 0.5 : 1,
                                cursor: loading ? 'not-allowed' : 'text'
                            }}
                        />
                    </div>

                    {/* Contraseña */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontWeight: '500',
                            fontSize: '0.9rem'
                        }}>
                            Password:
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                disabled={loading}
                                autoFocus
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    paddingRight: '40px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '1rem',
                                    boxSizing: 'border-box',
                                    opacity: loading ? 0.5 : 1,
                                    cursor: loading ? 'not-allowed' : 'text'
                                }}
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
                                    fontSize: '0.85rem',
                                    opacity: loading ? 0.5 : 1,
                                    color: '#666'
                                }}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    {/* Mensaje de error */}
                    {error && (
                        <div style={{
                            color: '#dc2626',
                            fontSize: '0.875rem',
                            marginBottom: '1rem',
                            padding: '0.75rem',
                            backgroundColor: '#fee2e2',
                            borderRadius: '4px'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Botones */}
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        justifyContent: 'flex-end'
                    }}>
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={loading}
                            style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#f3f4f6',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontSize: '1rem',
                                opacity: loading ? 0.5 : 1,
                                fontWeight: '500'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !password || !confirmText}
                            style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: (loading || !password || !confirmText) ? 'not-allowed' : 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                opacity: (loading || !password || !confirmText) ? 0.5 : 1
                            }}
                        >
                            {loading ? 'Deleting...' : 'Delete Account Permanently'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeleteAccountModal;

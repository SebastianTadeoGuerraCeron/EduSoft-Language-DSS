import React from 'react';
import { Link } from 'react-router';
import '../../styles/Billing.css';

/**
 * Página de Pago Cancelado
 * Se muestra cuando el usuario cancela el checkout en Stripe
 */
const Cancel = () => {
    return (
        <div className="result-container">
            <div className="result-icon cancel">
                ×
            </div>
            <h1 className="result-title">Payment Cancelled</h1>
            <p className="result-message">
                Your payment was cancelled and you have not been charged.<br />
                No worries - your cart is saved and you can complete the purchase whenever you're ready.
            </p>

            <div style={{
                background: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '2rem',
                textAlign: 'left'
            }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#92400e' }}>
                    Having trouble?
                </h3>
                <p style={{ margin: 0, color: '#78350f' }}>
                    If you experienced any issues during checkout, please contact our support team.
                    We're here to help!
                </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Link
                    to="/pricing"
                    className="plan-button primary"
                    style={{ textDecoration: 'none', display: 'inline-block' }}
                >
                    Try Again
                </Link>
                <Link
                    to="/home"
                    className="plan-button secondary"
                    style={{ textDecoration: 'none', display: 'inline-block' }}
                >
                    Go to Dashboard
                </Link>
            </div>

            <div style={{
                marginTop: '3rem',
                padding: '1.5rem',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
                <h3 style={{ margin: '0 0 1rem 0' }}>Why go Pro?</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}></div>
                        <strong>All Lessons</strong>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#666' }}>
                            Access every premium lesson
                        </p>
                    </div>
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}></div>
                        <strong>Unlimited Exams</strong>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#666' }}>
                            Practice without limits
                        </p>
                    </div>
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}></div>
                        <strong>Priority Support</strong>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#666' }}>
                            Get help when you need it
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Cancel;

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import '../../styles/Billing.css';

/**
 * Página de Pago Exitoso
 * Se muestra después de completar el checkout en Stripe
 */
const Success = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { updateUser, user } = useAuth();
    const [loading, setLoading] = useState(true);

    const sessionId = searchParams.get('session_id');

    useEffect(() => {
        // Simular verificación de la sesión
        const verifyPayment = async () => {
            try {
                // En producción, verificaríamos con el backend
                // que la sesión de Stripe es válida
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Actualizar el rol del usuario a PRO
                if (user) {
                    updateUser({
                        ...user,
                        role: 'STUDENT_PRO'
                    });
                }
            } catch (err) {
                console.error('Error verifying payment:', err);
            } finally {
                setLoading(false);
            }
        };

        verifyPayment();
    }, [sessionId, user, updateUser]);

    if (loading) {
        return (
            <div className="result-container">
                <div style={{ textAlign: 'center' }}>
                    <div className="result-icon success" style={{ animation: 'pulse 1.5s infinite' }}>
                        ⏳
                    </div>
                    <h2>Verifying your payment...</h2>
                    <p style={{ color: '#666' }}>Please wait while we confirm your subscription.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="result-container">
            <div className="result-icon success">
                ✓
            </div>
            <h1 className="result-title">Payment Successful!</h1>
            <p className="result-message">
                Welcome to EduSoft Pro! 🎉<br />
                Your subscription has been activated and you now have access to all premium content.
            </p>

            <div style={{ 
                background: '#f0fdf4', 
                border: '1px solid #bbf7d0',
                borderRadius: '12px', 
                padding: '1.5rem',
                marginBottom: '2rem',
                textAlign: 'left'
            }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#16a34a' }}>What's included:</h3>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#166534' }}>
                    <li>✅ Access to all premium lessons</li>
                    <li>✅ Unlimited exam attempts</li>
                    <li>✅ Priority support</li>
                    <li>✅ Ad-free experience</li>
                    <li>✅ Early access to new content</li>
                </ul>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Link 
                    to="/student/lessons" 
                    className="plan-button primary"
                    style={{ textDecoration: 'none', display: 'inline-block' }}
                >
                    Explore Premium Lessons
                </Link>
                <Link 
                    to="/billing/subscription" 
                    className="plan-button secondary"
                    style={{ textDecoration: 'none', display: 'inline-block' }}
                >
                    View Subscription
                </Link>
            </div>

            <p style={{ marginTop: '2rem', color: '#666', fontSize: '0.875rem' }}>
                A confirmation email has been sent to your registered email address.
            </p>
        </div>
    );
};

export default Success;

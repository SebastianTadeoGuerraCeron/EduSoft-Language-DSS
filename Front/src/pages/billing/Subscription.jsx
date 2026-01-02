import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { 
    getSubscriptionStatus, 
    getPaymentHistory, 
    cancelSubscription,
    formatSubscriptionDate,
    formatPrice,
    isPremiumUser 
} from '../../services/billingService';
import ReAuthModal from '../../components/ReAuthModal';
import '../../styles/Billing.css';

/**
 * Página Mi Suscripción
 * Muestra el estado de la suscripción y permite gestionarla
 */
const Subscription = () => {
    const { user, updateUser, hasRole } = useAuth();
    const navigate = useNavigate();
    const [subscriptionData, setSubscriptionData] = useState(null);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showReAuthModal, setShowReAuthModal] = useState(false);
    const [showUpdatePaymentModal, setShowUpdatePaymentModal] = useState(false);
    const [cancelPending, setCancelPending] = useState(false);
    const [cancelImmediate, setCancelImmediate] = useState(false);

    useEffect(() => {
        // Verificar que sea estudiante
        if (user && !hasRole(['STUDENT_FREE', 'STUDENT_PRO'])) {
            navigate('/home');
            return;
        }
        loadData();
    }, [user]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [subData, historyData] = await Promise.all([
                getSubscriptionStatus(),
                getPaymentHistory()
            ]);

            setSubscriptionData(subData);
            setPayments(historyData.payments || []);
        } catch (err) {
            console.error('Error loading subscription data:', err);
            setError('Failed to load subscription data.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelClick = (immediate = false) => {
        setCancelImmediate(immediate);
        setShowReAuthModal(true);
    };

    const handleReAuthConfirm = async (password) => {
        try {
            setCancelPending(true);
            await cancelSubscription(password, cancelImmediate);
            
            // Actualizar datos
            await loadData();
            
            // Si fue cancelación inmediata, actualizar el rol del usuario
            if (cancelImmediate && user) {
                updateUser({
                    ...user,
                    role: 'STUDENT_FREE'
                });
            }

            setShowReAuthModal(false);
            alert(cancelImmediate 
                ? 'Subscription cancelled immediately.' 
                : 'Subscription will be cancelled at the end of your billing period.');
        } catch (err) {
            console.error('Error cancelling subscription:', err);
            throw new Error(err.response?.data?.message || 'Failed to cancel subscription');
        } finally {
            setCancelPending(false);
        }
    };

    const handleUpdatePaymentConfirm = async (password) => {
        try {
            // Por ahora, simplemente mostrar un mensaje
            // En el futuro, aquí iría la lógica para actualizar el método de pago
            alert('Payment method update feature is coming soon. For now, you can cancel and create a new subscription.');
            setShowUpdatePaymentModal(false);
        } catch (err) {
            console.error('Error updating payment method:', err);
            throw new Error('Failed to update payment method');
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'ACTIVE': return 'active';
            case 'CANCELED': 
            case 'EXPIRED': return 'canceled';
            default: return 'pending';
        }
    };

    if (loading) {
        return (
            <div className="subscription-container">
                <div className="subscription-card">
                    <p style={{ textAlign: 'center' }}>Loading subscription data...</p>
                </div>
            </div>
        );
    }

    const { subscription, paymentMethod } = subscriptionData || {};
    const userIsPremium = isPremiumUser(user);

    return (
        <div className="subscription-container">
            <h1 style={{ marginBottom: '2rem' }}>My Subscription</h1>

            {error && (
                <div style={{ 
                    background: '#fee2e2', 
                    color: '#dc2626', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    marginBottom: '1rem' 
                }}>
                    {error}
                </div>
            )}

            {/* Current Plan Card */}
            <div className="subscription-card">
                <div className="subscription-status">
                    <h2 style={{ margin: 0 }}>Current Plan</h2>
                    {userIsPremium ? (
                        <span className="premium-badge">PRO</span>
                    ) : (
                        <span className="status-badge pending">FREE</span>
                    )}
                    {subscription && (
                        <span className={`status-badge ${getStatusBadgeClass(subscription.status)}`}>
                            {subscription.status}
                        </span>
                    )}
                </div>

                {subscription ? (
                    <>
                        <div className="subscription-details">
                            <div className="detail-item">
                                <label>Plan</label>
                                <span>{subscription.plan === 'YEARLY' ? 'Yearly Pro' : 'Monthly Pro'}</span>
                            </div>
                            <div className="detail-item">
                                <label>Next Billing Date</label>
                                <span>
                                    {subscription.autoRenewal 
                                        ? formatSubscriptionDate(subscription.currentPeriodEnd)
                                        : 'Not renewing'}
                                </span>
                            </div>
                            <div className="detail-item">
                                <label>Auto Renewal</label>
                                <span>{subscription.autoRenewal ? 'Enabled' : 'Disabled'}</span>
                            </div>
                            {subscription.canceledAt && (
                                <div className="detail-item">
                                    <label>Cancelled On</label>
                                    <span>{formatSubscriptionDate(subscription.canceledAt)}</span>
                                </div>
                            )}
                        </div>

                        {subscription.status === 'ACTIVE' && subscription.autoRenewal && (
                            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <button 
                                    className="plan-button secondary"
                                    onClick={() => handleCancelClick(false)}
                                >
                                    Cancel at Period End
                                </button>
                                <button 
                                    className="plan-button secondary"
                                    onClick={() => handleCancelClick(true)}
                                    style={{ color: '#dc2626' }}
                                >
                                    Cancel Immediately
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <p style={{ color: '#666', marginBottom: '1rem' }}>
                            You're on the free plan. Upgrade to Pro for unlimited access!
                        </p>
                        <Link to="/pricing" className="plan-button primary" style={{ textDecoration: 'none' }}>
                            Upgrade to Pro
                        </Link>
                    </div>
                )}
            </div>

            {/* Payment Method Card */}
            <div className="subscription-card">
                <h2 style={{ marginBottom: '1rem' }}>Payment Methods</h2>
                {paymentMethod ? (
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '1rem',
                        padding: '1rem',
                        background: '#f9fafb',
                        borderRadius: '8px'
                    }}>
                        <div style={{ fontSize: '2rem' }}>💳</div>
                        <div>
                            <strong>{paymentMethod.cardBrand}</strong> ending in {paymentMethod.lastFourDigits}
                            {paymentMethod.isDefault && (
                                <span style={{
                                    marginLeft: '0.5rem',
                                    fontSize: '0.75rem',
                                    background: '#22c55e',
                                    color: 'white',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '4px',
                                }}>
                                    Default
                                </span>
                            )}
                            <br />
                            <span style={{ color: '#666', fontSize: '0.875rem' }}>
                                {paymentMethod.cardholderName}
                            </span>
                        </div>
                    </div>
                ) : (
                    <p style={{ color: '#666' }}>No payment methods saved.</p>
                )}
                <Link 
                    to="/billing/payment-methods"
                    className="plan-button secondary"
                    style={{ marginTop: '1rem', textDecoration: 'none', display: 'inline-block' }}
                >
                    Manage Payment Methods
                </Link>
            </div>

            {/* Payment History */}
            <div className="payment-history">
                <h2>Payment History</h2>
                {payments.length > 0 ? (
                    <table className="payment-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((payment) => (
                                <tr key={payment.id}>
                                    <td>{formatSubscriptionDate(payment.createdAt)}</td>
                                    <td>{payment.description || 'Subscription payment'}</td>
                                    <td>{formatPrice(payment.amount / 100, payment.currency)}</td>
                                    <td>
                                        <span className={`payment-status ${payment.status.toLowerCase()}`}>
                                            {payment.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
                        No payment history yet.
                    </p>
                )}
            </div>

            {/* Re-Auth Modal */}
            {showReAuthModal && (
                <ReAuthModal
                    title={cancelImmediate ? "Cancel Subscription Immediately" : "Cancel Subscription"}
                    message={cancelImmediate 
                        ? "This will cancel your subscription immediately and you will lose access to premium content. Please enter your password to confirm."
                        : "Your subscription will be cancelled at the end of your current billing period. Please enter your password to confirm."}
                    onConfirm={handleReAuthConfirm}
                    onCancel={() => setShowReAuthModal(false)}
                    loading={cancelPending}
                    confirmText={cancelImmediate ? "Cancel Now" : "Cancel Subscription"}
                    confirmDanger={cancelImmediate}
                />
            )}

            {/* Update Payment Method Modal */}
            {showUpdatePaymentModal && (
                <ReAuthModal
                    title="Update Payment Method"
                    message="This feature is coming soon. For now, you can cancel your current subscription and create a new one with a different payment method. Please enter your password to confirm."
                    onConfirm={handleUpdatePaymentConfirm}
                    onCancel={() => setShowUpdatePaymentModal(false)}
                    loading={false}
                    confirmText="OK"
                    confirmDanger={false}
                />
            )}
        </div>
    );
};

export default Subscription;

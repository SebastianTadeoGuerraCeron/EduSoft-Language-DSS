import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getPlans, createCheckout, getPaymentMethod, subscribeWithSavedCard } from '../../services/billingService';
import '../../styles/Billing.css';

/**
 * Página de Upgrade - Flujo de checkout
 * Permite al usuario seleccionar un plan y proceder al pago
 */
const Upgrade = () => {
    const { user, refreshUser, hasRole } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preselectedPlan = searchParams.get('plan') || 'MONTHLY';

    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(preselectedPlan);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Estado para tarjeta guardada
    const [savedCard, setSavedCard] = useState(null);
    const [useSavedCard, setUseSavedCard] = useState(false);

    // Estado del formulario de tarjeta (para guardar encriptado)
    const [cardData, setCardData] = useState({
        cardNumber: '',
        cardholderName: '',
        expiry: '',
        cvv: '',
    });
    const [saveCard, setSaveCard] = useState(true);

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
            
            // Cargar planes
            const plansData = await getPlans();
            setPlans(plansData.plans || []);
            
            // Verificar si hay tarjeta guardada
            try {
                const cardInfo = await getPaymentMethod();
                if (cardInfo.paymentMethod) {
                    setSavedCard(cardInfo.paymentMethod);
                    setUseSavedCard(true);
                }
            } catch (err) {
                // No hay tarjeta guardada - OK
                console.log('No saved card found');
            }
        } catch (err) {
            console.error('Error loading data:', err);
            setError('Failed to load plans.');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let formattedValue = value;

        // Formatear número de tarjeta
        if (name === 'cardNumber') {
            formattedValue = value
                .replace(/\D/g, '')
                .replace(/(\d{4})(?=\d)/g, '$1 ')
                .substring(0, 19);
        }

        // Formatear fecha de expiración
        if (name === 'expiry') {
            formattedValue = value
                .replace(/\D/g, '')
                .replace(/(\d{2})(?=\d)/, '$1/')
                .substring(0, 5);
        }

        // Limitar CVV
        if (name === 'cvv') {
            formattedValue = value.replace(/\D/g, '').substring(0, 4);
        }

        setCardData(prev => ({ ...prev, [name]: formattedValue }));
    };

    const validateForm = () => {
        // Si usa tarjeta guardada, no necesita validar
        if (useSavedCard && savedCard) {
            return true;
        }
        
        if (!cardData.cardNumber || cardData.cardNumber.replace(/\s/g, '').length < 15) {
            setError('Please enter a valid card number');
            return false;
        }
        if (!cardData.cardholderName.trim()) {
            setError('Please enter the cardholder name');
            return false;
        }
        if (!cardData.expiry || cardData.expiry.length < 5) {
            setError('Please enter a valid expiry date (MM/YY)');
            return false;
        }
        if (!cardData.cvv || cardData.cvv.length < 3) {
            setError('Please enter a valid CVV');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (!validateForm()) return;

        try {
            setProcessing(true);

            // OPCIÓN 1: Usar tarjeta guardada (datos encriptados en nuestra BD)
            if (useSavedCard && savedCard) {
                try {
                    const data = await subscribeWithSavedCard(selectedPlan);
                    
                    if (data.success) {
                        setSuccessMessage('¡Suscripción creada exitosamente! Tu cuenta ha sido actualizada a Premium.');
                        // Refrescar usuario para obtener el nuevo rol
                        if (refreshUser) {
                            await refreshUser();
                        }
                        // Redirigir después de 2 segundos
                        setTimeout(() => {
                            navigate('/home');
                        }, 2000);
                        return;
                    }
                } catch (savedCardError) {
                    console.error('Error with saved card:', savedCardError);
                    const errorMsg = savedCardError.response?.data?.error || '';
                    
                    // Si el error es sobre datos de tarjeta inválidos, desmarcar "usar tarjeta guardada"
                    if (errorMsg.includes('cannot be used') || 
                        errorMsg.includes('decrypt') || 
                        errorMsg.includes('Incomplete card data')) {
                        setUseSavedCard(false);
                        setError('Your saved card cannot be used. Please enter your card details below.');
                        setProcessing(false);
                        return;
                    }
                    
                    // Para otros errores, lanzar para que se maneje abajo
                    throw savedCardError;
                }
            }

            // OPCIÓN 2: Nueva tarjeta - siempre enviar datos para procesar directamente
            // El backend decidirá si guarda o no basado en el flag saveCard
            const cardToSend = {
                cardNumber: cardData.cardNumber.replace(/\s/g, ''),
                cvv: cardData.cvv,
                expiry: cardData.expiry,
                cardholderName: cardData.cardholderName,
                saveCard: saveCard, // Enviar flag para que el backend decida si guarda
            };

            const data = await createCheckout(selectedPlan, cardToSend);

            // El backend siempre procesará directamente con datos de tarjeta
            if (data.success) {
                setSuccessMessage('¡Suscripción creada exitosamente! Tu cuenta ha sido actualizada a Premium.');
                if (refreshUser) {
                    await refreshUser();
                }
                setTimeout(() => {
                    navigate('/home');
                }, 2000);
                return;
            }

            // Este caso no debería ocurrir si se enviaron datos de tarjeta
            if (data.sessionUrl) {
                console.warn('Unexpected redirect to Stripe Checkout');
                window.location.href = data.sessionUrl;
            }
        } catch (err) {
            console.error('Error creating checkout:', err);
            setError(err.response?.data?.error || 'Failed to process. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const selectedPlanData = plans.find(p => p.id === selectedPlan);

    if (loading) {
        return (
            <div className="checkout-container">
                <div className="checkout-card">
                    <p style={{ textAlign: 'center' }}>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="checkout-container">
            <div className="checkout-card">
                <div className="checkout-header">
                    <h2>Complete Your Upgrade</h2>
                    <p>You're one step away from premium access!</p>
                </div>

                {/* Plan Selection */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                        Select Plan
                    </label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {plans.map(plan => (
                            <button
                                key={plan.id}
                                type="button"
                                onClick={() => setSelectedPlan(plan.id)}
                                style={{
                                    flex: 1,
                                    padding: '1rem',
                                    border: selectedPlan === plan.id ? '2px solid #7c3aed' : '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    background: selectedPlan === plan.id ? '#f5f3ff' : 'white',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                }}
                            >
                                <strong>{plan.name}</strong>
                                <br />
                                <span style={{ color: '#666' }}>${plan.price}/{plan.interval}</span>
                                {plan.savings && (
                                    <span className="plan-savings" style={{ marginLeft: '0.5rem' }}>
                                        {plan.savings}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Order Summary */}
                <div className="checkout-summary">
                    <div className="checkout-summary-row">
                        <span>Plan</span>
                        <span>{selectedPlanData?.name || selectedPlan}</span>
                    </div>
                    <div className="checkout-summary-row">
                        <span>Billing</span>
                        <span>{selectedPlanData?.interval === 'year' ? 'Yearly' : 'Monthly'}</span>
                    </div>
                    <div className="checkout-summary-row total">
                        <span>Total</span>
                        <span>${selectedPlanData?.price || '0.00'}</span>
                    </div>
                </div>

                {/* Success Message */}
                {successMessage && (
                    <div style={{
                        padding: '1rem',
                        background: '#dcfce7',
                        border: '1px solid #22c55e',
                        borderRadius: '8px',
                        color: '#166534',
                        marginBottom: '1rem',
                    }}>
                        ✅ {successMessage}
                    </div>
                )}

                {/* Saved Card Option */}
                {savedCard && (
                    <div style={{
                        padding: '1rem',
                        background: '#f0fdf4',
                        border: '1px solid #22c55e',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input
                                type="checkbox"
                                id="useSavedCard"
                                checked={useSavedCard}
                                onChange={(e) => setUseSavedCard(e.target.checked)}
                            />
                            <label htmlFor="useSavedCard" style={{ fontWeight: '600' }}>
                                Use saved card
                            </label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534' }}>
                            <span style={{ fontSize: '1.25rem' }}>
                                {savedCard.cardBrand === 'Visa' && '💳'}
                                {savedCard.cardBrand === 'Mastercard' && '💳'}
                                {savedCard.cardBrand === 'American Express' && '💳'}
                            </span>
                            <span>
                                {savedCard.cardBrand} •••• {savedCard.lastFourDigits}
                            </span>
                            <span style={{ color: '#888', fontSize: '0.875rem' }}>
                                ({savedCard.cardholderName})
                            </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.5rem' }}>
                            🔒 Your card data is stored encrypted with AES-256-GCM
                        </p>
                    </div>
                )}

                {/* Card Form - Only show if not using saved card */}
                <form onSubmit={handleSubmit} className="card-form">
                    {(!useSavedCard || !savedCard) && (
                        <>
                            <div className="form-group">
                                <label htmlFor="cardNumber">Card Number</label>
                                <input
                                    type="text"
                                    id="cardNumber"
                                    name="cardNumber"
                                    value={cardData.cardNumber}
                                    onChange={handleInputChange}
                                    placeholder="1234 5678 9012 3456"
                                    autoComplete="cc-number"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="cardholderName">Cardholder Name</label>
                                <input
                                    type="text"
                                    id="cardholderName"
                                    name="cardholderName"
                                    value={cardData.cardholderName}
                                    onChange={handleInputChange}
                                    placeholder="John Doe"
                                    autoComplete="cc-name"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="expiry">Expiry Date</label>
                                    <input
                                        type="text"
                                        id="expiry"
                                        name="expiry"
                                        value={cardData.expiry}
                                        onChange={handleInputChange}
                                        placeholder="MM/YY"
                                        autoComplete="cc-exp"
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="cvv">CVV</label>
                                    <input
                                        type="text"
                                        id="cvv"
                                        name="cvv"
                                        value={cardData.cvv}
                                        onChange={handleInputChange}
                                        placeholder="123"
                                        autoComplete="cc-csc"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="saveCard"
                                    checked={saveCard}
                                    onChange={(e) => setSaveCard(e.target.checked)}
                                />
                                <label htmlFor="saveCard" style={{ fontSize: '0.875rem', color: '#666' }}>
                                    Save card for future payments (encrypted)
                                </label>
                            </div>
                        </>
                    )}

                    {error && (
                        <div style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="plan-button primary"
                        disabled={processing}
                        style={{ marginTop: '1rem' }}
                    >
                        {processing ? 'Processing...' : (useSavedCard && savedCard 
                            ? `Pay $${selectedPlanData?.price || '0.00'} with saved card`
                            : `Pay $${selectedPlanData?.price || '0.00'}`
                        )}
                    </button>

                    <div className="secure-badge">
                        <span>🔒</span>
                        <span>Secured with AES-256 encryption</span>
                    </div>
                </form>

                {/* Test Card Info - Only show if entering new card */}
                {(!useSavedCard || !savedCard) && (
                    <div style={{ 
                        marginTop: '1.5rem', 
                        padding: '1rem', 
                        background: '#fef3c7', 
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                    }}>
                        <strong>🧪 Test Mode</strong>
                        <p style={{ margin: '0.5rem 0 0 0', color: '#92400e' }}>
                            Use card number: <code>4242 4242 4242 4242</code><br />
                            Any future date and any 3-digit CVV
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Upgrade;

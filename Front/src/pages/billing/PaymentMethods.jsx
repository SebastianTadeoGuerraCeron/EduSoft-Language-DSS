import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import {
    getPaymentMethods,
    addPaymentMethod,
    setDefaultPaymentMethod,
    deletePaymentMethod,
} from '../../services/billingService';
import '../../styles/Billing.css';

/**
 * Página de Gestión de Métodos de Pago
 * Permite al usuario ver, agregar, eliminar y establecer tarjetas predeterminadas
 */
const PaymentMethods = () => {
    const { user, hasRole } = useAuth();
    const navigate = useNavigate();

    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Estado para agregar nueva tarjeta
    const [showAddForm, setShowAddForm] = useState(false);
    const [addingCard, setAddingCard] = useState(false);
    const [newCard, setNewCard] = useState({
        cardNumber: '',
        cardholderName: '',
        expiry: '',
        cvv: '',
        nickname: '',
    });
    const [setAsDefault, setSetAsDefault] = useState(true);

    // Estado para eliminar tarjeta
    const [deletingCardId, setDeletingCardId] = useState(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [cardToDelete, setCardToDelete] = useState(null);

    useEffect(() => {
        // Verificar que sea estudiante
        if (user && !hasRole(['STUDENT_FREE', 'STUDENT_PRO'])) {
            navigate('/home');
            return;
        }
        loadCards();
    }, [user]);

    // Auto-hide success message
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    const loadCards = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getPaymentMethods();
            setCards(data.paymentMethods || []);
        } catch (err) {
            console.error('Error loading cards:', err);
            if (err.response?.status !== 404) {
                setError('Failed to load payment methods');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let formattedValue = value;

        if (name === 'cardNumber') {
            formattedValue = value
                .replace(/\D/g, '')
                .replace(/(\d{4})(?=\d)/g, '$1 ')
                .substring(0, 19);
        }

        if (name === 'expiry') {
            formattedValue = value
                .replace(/\D/g, '')
                .replace(/(\d{2})(?=\d)/, '$1/')
                .substring(0, 5);
        }

        if (name === 'cvv') {
            formattedValue = value.replace(/\D/g, '').substring(0, 4);
        }

        setNewCard(prev => ({ ...prev, [name]: formattedValue }));
    };

    const validateCard = () => {
        if (!newCard.cardNumber || newCard.cardNumber.replace(/\s/g, '').length < 15) {
            setError('Please enter a valid card number');
            return false;
        }
        if (!newCard.cardholderName.trim()) {
            setError('Please enter the cardholder name');
            return false;
        }
        if (!newCard.expiry || newCard.expiry.length < 5) {
            setError('Please enter a valid expiry date (MM/YY)');
            return false;
        }
        if (!newCard.cvv || newCard.cvv.length < 3) {
            setError('Please enter a valid CVV');
            return false;
        }
        return true;
    };

    const handleAddCard = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (!validateCard()) return;

        try {
            setAddingCard(true);

            const cardData = {
                cardNumber: newCard.cardNumber.replace(/\s/g, ''),
                cvv: newCard.cvv,
                expiry: newCard.expiry,
                cardholderName: newCard.cardholderName,
            };

            await addPaymentMethod(cardData, newCard.nickname || null, setAsDefault);

            setSuccessMessage('Card added successfully!');
            setNewCard({
                cardNumber: '',
                cardholderName: '',
                expiry: '',
                cvv: '',
                nickname: '',
            });
            setShowAddForm(false);
            loadCards();
        } catch (err) {
            console.error('Error adding card:', err);
            setError(err.response?.data?.error || 'Failed to add card');
        } finally {
            setAddingCard(false);
        }
    };

    const handleSetDefault = async (cardId) => {
        try {
            setError(null);
            await setDefaultPaymentMethod(cardId);
            setSuccessMessage('Default payment method updated!');
            loadCards();
        } catch (err) {
            console.error('Error setting default:', err);
            setError('Failed to update default payment method');
        }
    };

    const openDeleteModal = (card) => {
        setCardToDelete(card);
        setDeletePassword('');
        setShowDeleteModal(true);
    };

    const handleDeleteCard = async () => {
        if (!deletePassword) {
            setError('Please enter your password to confirm');
            return;
        }

        try {
            setDeletingCardId(cardToDelete.id);
            setError(null);
            await deletePaymentMethod(cardToDelete.id, deletePassword);
            setSuccessMessage('Card removed successfully!');
            setShowDeleteModal(false);
            setCardToDelete(null);
            setDeletePassword('');
            loadCards();
        } catch (err) {
            console.error('Error deleting card:', err);
            setError(err.response?.data?.error || 'Failed to remove card. Check your password.');
        } finally {
            setDeletingCardId(null);
        }
    };

    const getCardBrandIcon = (brand) => {
        const brandLower = brand?.toLowerCase() || '';
        if (brandLower.includes('visa')) return '💳';
        if (brandLower.includes('master')) return '💳';
        if (brandLower.includes('amex')) return '💳';
        return '💳';
    };

    if (loading) {
        return (
            <div className="checkout-container">
                <div className="checkout-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="loading-spinner"></div>
                    <p style={{ marginTop: '1rem', color: '#666' }}>Loading payment methods...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="checkout-container" style={{ maxWidth: '700px' }}>
            {/* Header */}
            <div className="checkout-header" style={{ borderBottom: 'none', marginBottom: '1rem' }}>
                <h1 style={{ fontSize: '2rem', color: '#1a1a2e', marginBottom: '0.5rem' }}>
                    💳 Payment Methods
                </h1>
                <p style={{ color: '#666' }}>Manage your saved cards securely</p>
            </div>

            {/* Messages */}
            {error && (
                <div className="alert-message error">
                    <span>❌</span> {error}
                </div>
            )}

            {successMessage && (
                <div className="alert-message success">
                    <span>✅</span> {successMessage}
                </div>
            )}

            {/* Cards List */}
            <div className="checkout-card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ 
                    marginBottom: '1.5rem', 
                    color: '#1a1a2e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <span>🗂️</span> Your Cards
                </h3>

                {cards.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">💳</div>
                        <h4>No payment methods saved</h4>
                        <p>Add a card to make payments easier and faster.</p>
                    </div>
                ) : (
                    <div className="cards-list">
                        {cards.map((card) => (
                            <div
                                key={card.id}
                                className={`payment-card-item ${card.isDefault ? 'default' : ''}`}
                            >
                                <div className="card-info">
                                    <div className="card-icon">
                                        {getCardBrandIcon(card.cardBrand)}
                                    </div>
                                    <div className="card-details">
                                        <div className="card-number">
                                            <strong>{card.cardBrand}</strong>
                                            <span className="dots">••••</span>
                                            <span className="last-four">{card.lastFourDigits}</span>
                                            {card.isDefault && (
                                                <span className="default-badge">Default</span>
                                            )}
                                        </div>
                                        <div className="card-holder">
                                            {card.cardholderName}
                                            {card.nickname && (
                                                <span className="card-nickname">• {card.nickname}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="card-actions">
                                    {!card.isDefault && (
                                        <button
                                            onClick={() => handleSetDefault(card.id)}
                                            className="action-btn set-default"
                                            title="Set as default"
                                        >
                                            ⭐ Set Default
                                        </button>
                                    )}
                                    <button
                                        onClick={() => openDeleteModal(card)}
                                        disabled={deletingCardId === card.id}
                                        className="action-btn remove"
                                        title="Remove card"
                                    >
                                        {deletingCardId === card.id ? '...' : '🗑️'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Card Button */}
            {!showAddForm && (
                <button
                    onClick={() => setShowAddForm(true)}
                    className="plan-button primary"
                    style={{ 
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <span style={{ fontSize: '1.25rem' }}>+</span> Add New Card
                </button>
            )}

            {/* Add Card Form */}
            {showAddForm && (
                <div className="checkout-card">
                    <h3 style={{ 
                        marginBottom: '1.5rem', 
                        color: '#1a1a2e',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span>➕</span> Add New Card
                    </h3>

                    <form onSubmit={handleAddCard} className="card-form">
                        <div className="form-group">
                            <label htmlFor="cardNumber">Card Number</label>
                            <input
                                type="text"
                                id="cardNumber"
                                name="cardNumber"
                                value={newCard.cardNumber}
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
                                value={newCard.cardholderName}
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
                                    value={newCard.expiry}
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
                                    value={newCard.cvv}
                                    onChange={handleInputChange}
                                    placeholder="123"
                                    autoComplete="cc-csc"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="nickname">Nickname <span style={{ color: '#999', fontWeight: 'normal' }}>(optional)</span></label>
                            <input
                                type="text"
                                id="nickname"
                                name="nickname"
                                value={newCard.nickname}
                                onChange={handleInputChange}
                                placeholder="e.g., Personal, Work, Travel"
                            />
                        </div>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={setAsDefault}
                                onChange={(e) => setSetAsDefault(e.target.checked)}
                            />
                            <span>Set as default payment method</span>
                        </label>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="plan-button primary"
                                disabled={addingCard}
                            >
                                {addingCard ? 'Adding...' : '💳 Add Card'}
                            </button>
                            <button
                                type="button"
                                className="plan-button secondary"
                                onClick={() => setShowAddForm(false)}
                            >
                                Cancel
                            </button>
                        </div>

                        <div className="secure-badge">
                            <span>🔒</span>
                            <span>Your card is secured with AES-256 encryption</span>
                        </div>
                    </form>

                    {/* Test Card Info */}
                    <div className="test-mode-banner">
                        <strong>🧪 Test Mode</strong>
                        <p>
                            Use card: <code>4242 4242 4242 4242</code> | 
                            Any future date | Any 3-digit CVV
                        </p>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>🗑️ Remove Card</h3>
                        </div>
                        <div className="modal-body">
                            <p>
                                Are you sure you want to remove the card ending in{' '}
                                <strong>{cardToDelete?.lastFourDigits}</strong>?
                            </p>
                            <p className="modal-warning">
                                Enter your password to confirm this action:
                            </p>

                            <input
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                placeholder="Your password"
                                className="modal-input"
                            />
                        </div>
                        <div className="modal-actions">
                            <button
                                onClick={handleDeleteCard}
                                disabled={deletingCardId}
                                className="plan-button danger"
                            >
                                {deletingCardId ? 'Removing...' : 'Remove Card'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setCardToDelete(null);
                                    setDeletePassword('');
                                }}
                                className="plan-button secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button
                    onClick={() => navigate('/billing/subscription')}
                    className="link-button"
                >
                    ← Back to Subscription
                </button>
            </div>
        </div>
    );
};

export default PaymentMethods;

import React, { useState } from 'react';
import '../styles/Billing.css';

/**
 * Formulario de captura de datos de tarjeta de crédito
 * Los datos se envían encriptados al backend antes del checkout
 */
const CardInputForm = ({ onSubmit, loading, onCancel }) => {
    const [cardData, setCardData] = useState({
        cardNumber: '',
        cvv: '',
        expiry: '',
        cardholderName: '',
    });
    const [errors, setErrors] = useState({});

    // Formatear número de tarjeta con espacios
    const formatCardNumber = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        return parts.length ? parts.join(' ') : value;
    };

    // Formatear fecha de expiración MM/YY
    const formatExpiry = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        if (v.length >= 2) {
            return v.substring(0, 2) + '/' + v.substring(2, 4);
        }
        return v;
    };

    // Detectar tipo de tarjeta
    const getCardType = (number) => {
        const cleanNumber = number.replace(/\s/g, '');
        if (/^4/.test(cleanNumber)) return 'visa';
        if (/^5[1-5]/.test(cleanNumber)) return 'mastercard';
        if (/^3[47]/.test(cleanNumber)) return 'amex';
        if (/^6(?:011|5)/.test(cleanNumber)) return 'discover';
        return 'unknown';
    };

    // Validación del algoritmo de Luhn
    const validateLuhn = (number) => {
        const digits = number.replace(/\s/g, '').split('').reverse().map(x => parseInt(x));
        let sum = 0;
        for (let i = 0; i < digits.length; i++) {
            let digit = digits[i];
            if (i % 2 === 1) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
        }
        return sum % 10 === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let formattedValue = value;

        if (name === 'cardNumber') {
            formattedValue = formatCardNumber(value);
        } else if (name === 'expiry') {
            formattedValue = formatExpiry(value);
        } else if (name === 'cvv') {
            formattedValue = value.replace(/[^0-9]/g, '').substring(0, 4);
        }

        setCardData(prev => ({ ...prev, [name]: formattedValue }));
        
        // Limpiar error del campo
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validate = () => {
        const newErrors = {};
        const cleanCardNumber = cardData.cardNumber.replace(/\s/g, '');

        // Validar número de tarjeta
        if (!cleanCardNumber || cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
            newErrors.cardNumber = 'Enter a valid card number';
        } else if (!validateLuhn(cleanCardNumber)) {
            newErrors.cardNumber = 'Invalid card number';
        }

        // Validar CVV
        if (!cardData.cvv || cardData.cvv.length < 3) {
            newErrors.cvv = 'Enter CVV';
        }

        // Validar fecha de expiración
        if (!cardData.expiry || cardData.expiry.length < 5) {
            newErrors.expiry = 'Enter expiry date';
        } else {
            const [month, year] = cardData.expiry.split('/');
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear() % 100;
            const currentMonth = currentDate.getMonth() + 1;
            
            if (parseInt(month) < 1 || parseInt(month) > 12) {
                newErrors.expiry = 'Invalid month';
            } else if (parseInt(year) < currentYear || 
                       (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
                newErrors.expiry = 'Card has expired';
            }
        }

        // Validar nombre
        if (!cardData.cardholderName || cardData.cardholderName.trim().length < 2) {
            newErrors.cardholderName = 'Enter cardholder name';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (validate()) {
            // Enviar datos sin espacios en el número de tarjeta
            onSubmit({
                ...cardData,
                cardNumber: cardData.cardNumber.replace(/\s/g, ''),
            });
        }
    };

    const cardType = getCardType(cardData.cardNumber);

    return (
        <div className="card-input-form">
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="cardNumber">Card Number</label>
                    <div className="card-input-wrapper">
                        <input
                            type="text"
                            id="cardNumber"
                            name="cardNumber"
                            value={cardData.cardNumber}
                            onChange={handleChange}
                            placeholder="1234 5678 9012 3456"
                            maxLength="19"
                            autoComplete="cc-number"
                            className={errors.cardNumber ? 'error' : ''}
                        />
                        <span className={`card-type-icon ${cardType}`}>
                            {cardType === 'visa' && '💳 VISA'}
                            {cardType === 'mastercard' && '💳 MC'}
                            {cardType === 'amex' && '💳 AMEX'}
                            {cardType === 'discover' && '💳 DISC'}
                        </span>
                    </div>
                    {errors.cardNumber && <span className="error-text">{errors.cardNumber}</span>}
                </div>

                <div className="form-row">
                    <div className="form-group half">
                        <label htmlFor="expiry">Expiry Date</label>
                        <input
                            type="text"
                            id="expiry"
                            name="expiry"
                            value={cardData.expiry}
                            onChange={handleChange}
                            placeholder="MM/YY"
                            maxLength="5"
                            autoComplete="cc-exp"
                            className={errors.expiry ? 'error' : ''}
                        />
                        {errors.expiry && <span className="error-text">{errors.expiry}</span>}
                    </div>

                    <div className="form-group half">
                        <label htmlFor="cvv">CVV</label>
                        <input
                            type="password"
                            id="cvv"
                            name="cvv"
                            value={cardData.cvv}
                            onChange={handleChange}
                            placeholder="123"
                            maxLength="4"
                            autoComplete="cc-csc"
                            className={errors.cvv ? 'error' : ''}
                        />
                        {errors.cvv && <span className="error-text">{errors.cvv}</span>}
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="cardholderName">Cardholder Name</label>
                    <input
                        type="text"
                        id="cardholderName"
                        name="cardholderName"
                        value={cardData.cardholderName}
                        onChange={handleChange}
                        placeholder="John Doe"
                        autoComplete="cc-name"
                        className={errors.cardholderName ? 'error' : ''}
                    />
                    {errors.cardholderName && <span className="error-text">{errors.cardholderName}</span>}
                </div>

                <div className="security-notice">
                    <span className="lock-icon">🔒</span>
                    <span>Your card information is encrypted with AES-256-GCM before storage</span>
                </div>

                <div className="form-actions">
                    <button 
                        type="button" 
                        className="btn-secondary"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        className="btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : 'Continue to Payment'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CardInputForm;

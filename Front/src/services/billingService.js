/**
 * Servicio de Billing y Suscripciones
 * 
 * HU07 - Protección de Datos de Pagos (Tránsito)
 * 
 * Implementa:
 * - FDP_UCT.1: Basic data exchange confidentiality
 * - FDP_UIT.1: Data exchange integrity
 * 
 * Características de Seguridad:
 * - Verificación de integridad en respuestas (HMAC-SHA256)
 * - Headers de seguridad para prevenir replay attacks
 * - Validación de datos de tarjeta antes del envío
 * - Detección de respuestas manipuladas
 * - Advertencias de conexión insegura
 * 
 * Maneja todas las llamadas a la API relacionadas con:
 * - Suscripciones Premium
 * - Pagos con Stripe
 * - Historial de pagos
 * 
 * @author Anthony Alejandro Morales Vargas
 */

import api from '../API';
import {
    prepareSecurityHeaders,
    sanitizeCardData,
    validateCardDataFormat,
    verifyBillingResponse,
    warnIfInsecure,
} from '../utils/transactionSecurity';

/**
 * Obtener planes disponibles
 */
export const getPlans = async () => {
    const response = await api.get('/billing/plans');
    return response.data;
};

/**
 * Crear sesión de checkout con Stripe
 * 
 * HU07: Aplica headers de seguridad y verifica integridad de respuesta
 * 
 * @param {string} plan - 'MONTHLY' o 'YEARLY'
 * @param {Object} cardData - Datos de tarjeta (opcional, se guardan encriptados)
 * @throws {Error} Si la validación de tarjeta falla o la integridad de respuesta es inválida
 */
export const createCheckout = async (plan, cardData = null) => {
    // Advertir si no es HTTPS
    warnIfInsecure();

    // Preparar datos de tarjeta si se proporcionan
    let sanitizedCardData = null;
    if (cardData) {
        // Validar formato de datos de tarjeta
        const validation = validateCardDataFormat(cardData);
        if (!validation.valid) {
            throw new Error(`Invalid card data: ${validation.errors.join(', ')}`);
        }
        sanitizedCardData = sanitizeCardData(cardData);
    }

    // Preparar headers de seguridad
    const securityHeaders = prepareSecurityHeaders({ plan, cardData: sanitizedCardData });

    const response = await api.post('/billing/create-checkout', {
        plan,
        cardData: sanitizedCardData,
    }, {
        headers: securityHeaders,
    });

    // Verificar integridad de la respuesta
    return verifyBillingResponse(response);
};

/**
 * Obtener estado de suscripción actual
 * HU07: Verifica integridad de respuesta
 */
export const getSubscriptionStatus = async () => {
    const response = await api.get('/billing/subscription');
    return verifyBillingResponse(response);
};

/**
 * Obtener historial de pagos
 * HU07: Verifica integridad de respuesta
 */
export const getPaymentHistory = async () => {
    const response = await api.get('/billing/history');
    return verifyBillingResponse(response);
};

/**
 * Obtener método de pago actual
 * HU07: Verifica integridad de respuesta
 */
export const getPaymentMethod = async () => {
    const response = await api.get('/billing/payment-method');
    return verifyBillingResponse(response);
};

/**
 * Cancelar suscripción
 * Requiere re-autenticación (HU06)
 * HU07: Headers de seguridad + Verificación de integridad
 * 
 * @param {string} password - Contraseña para re-autenticación
 * @param {boolean} immediate - Si es true, cancela inmediatamente
 */
export const cancelSubscription = async (password, immediate = false) => {
    warnIfInsecure();
    
    const securityHeaders = prepareSecurityHeaders({ immediate });
    
    const response = await api.post('/billing/cancel', 
        { immediate },
        {
            headers: {
                'X-Reauth-Password': password,
                ...securityHeaders,
            },
        }
    );
    return verifyBillingResponse(response);
};

/**
 * Reactivate auto-renewal (if previously set to cancel at period end)
 * HU07: Verifica integridad de respuesta
 */
export const reactivateSubscription = async () => {
    const securityHeaders = prepareSecurityHeaders({});
    
    const response = await api.post('/billing/reactivate', {}, {
        headers: securityHeaders,
    });
    return verifyBillingResponse(response);
};

/**
 * Actualizar método de pago
 * Requiere re-autenticación (HU06)
 * HU07: Validación de tarjeta + Headers de seguridad + Verificación de integridad
 * 
 * @param {string} password - Contraseña para re-autenticación
 * @param {Object} cardData - Nuevos datos de tarjeta
 */
export const updatePaymentMethod = async (password, cardData) => {
    warnIfInsecure();
    
    // Validar formato de datos de tarjeta
    const validation = validateCardDataFormat(cardData);
    if (!validation.valid) {
        throw new Error(`Invalid card data: ${validation.errors.join(', ')}`);
    }
    
    const sanitizedCardData = sanitizeCardData(cardData);
    const securityHeaders = prepareSecurityHeaders({ cardData: sanitizedCardData });
    
    const response = await api.post('/billing/update-payment-method',
        { cardData: sanitizedCardData },
        {
            headers: {
                'X-Reauth-Password': password,
                ...securityHeaders,
            },
        }
    );
    return verifyBillingResponse(response);
};

/**
 * Verificar si el usuario tiene acceso premium
 * @param {Object} user - Objeto de usuario del contexto
 */
export const isPremiumUser = (user) => {
    if (!user) return false;
    return user.role === 'STUDENT_PRO' || user.role === 'ADMIN' || user.role === 'TUTOR';
};

/**
 * Suscribirse usando la tarjeta guardada en la BD
 * Este endpoint usa los datos de tarjeta encriptados para crear la suscripción
 * HU07: Headers de seguridad + Verificación de integridad
 * 
 * @param {string} plan - 'MONTHLY' o 'YEARLY'
 * @param {string} cardId - ID de la tarjeta a usar (opcional, usa la default si no se especifica)
 */
export const subscribeWithSavedCard = async (plan, cardId = null) => {
    warnIfInsecure();
    
    const securityHeaders = prepareSecurityHeaders({ plan, cardId });
    
    const response = await api.post('/billing/subscribe-with-saved-card', 
        { plan, cardId },
        { headers: securityHeaders }
    );
    return verifyBillingResponse(response);
};

// ========== GESTIÓN DE MÚLTIPLES TARJETAS ==========
// HU07: Todos los endpoints de tarjetas requieren canal seguro

/**
 * Obtener todas las tarjetas del usuario
 * HU07: Verifica integridad de respuesta
 */
export const getPaymentMethods = async () => {
    const response = await api.get('/billing/payment-methods');
    return verifyBillingResponse(response);
};

/**
 * Agregar una nueva tarjeta
 * HU07: Validación de tarjeta + Headers de seguridad + Verificación de integridad
 * 
 * @param {Object} cardData - Datos de la tarjeta
 * @param {string} nickname - Nombre personalizado (opcional)
 * @param {boolean} setAsDefault - Establecer como predeterminada
 */
export const addPaymentMethod = async (cardData, nickname = null, setAsDefault = false) => {
    warnIfInsecure();
    
    // Validar formato de datos de tarjeta
    const validation = validateCardDataFormat(cardData);
    if (!validation.valid) {
        throw new Error(`Invalid card data: ${validation.errors.join(', ')}`);
    }
    
    const sanitizedCardData = sanitizeCardData(cardData);
    const securityHeaders = prepareSecurityHeaders({ cardData: sanitizedCardData, nickname, setAsDefault });
    
    const response = await api.post('/billing/payment-methods', {
        cardData: sanitizedCardData,
        nickname,
        setAsDefault,
    }, {
        headers: securityHeaders,
    });
    return verifyBillingResponse(response);
};

/**
 * Establecer una tarjeta como predeterminada
 * HU07: Verifica integridad de respuesta
 * 
 * @param {string} cardId - ID de la tarjeta
 */
export const setDefaultPaymentMethod = async (cardId) => {
    const securityHeaders = prepareSecurityHeaders({ cardId });
    
    const response = await api.put(`/billing/payment-methods/${cardId}/default`, {}, {
        headers: securityHeaders,
    });
    return verifyBillingResponse(response);
};

/**
 * Eliminar una tarjeta
 * Requiere re-autenticación (HU06)
 * HU07: Headers de seguridad + Verificación de integridad
 * 
 * @param {string} cardId - ID de la tarjeta
 * @param {string} password - Contraseña para re-autenticación
 */
export const deletePaymentMethod = async (cardId, password) => {
    warnIfInsecure();
    
    const securityHeaders = prepareSecurityHeaders({ cardId });
    
    const response = await api.delete(`/billing/payment-methods/${cardId}`, {
        headers: {
            'X-Reauth-Password': password,
            ...securityHeaders,
        },
    });
    return verifyBillingResponse(response);
};

/**
 * Verificar si el contenido requiere premium
 * @param {Object} content - Lección o examen
 * @param {Object} user - Usuario actual
 */
export const canAccessContent = (content, user) => {
    if (!content) return false;
    
    // Contenido gratuito - todos pueden acceder
    if (!content.isPremium) return true;
    
    // Contenido premium - verificar rol
    return isPremiumUser(user);
};

/**
 * Formatear precio para mostrar
 * @param {number} amount - Monto en centavos
 * @param {string} currency - Código de moneda
 */
export const formatPrice = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount);
};

/**
 * Formatear fecha de suscripción
 * @param {string} dateString - Fecha en formato ISO
 */
export const formatSubscriptionDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

export default {
    getPlans,
    createCheckout,
    getSubscriptionStatus,
    getPaymentHistory,
    getPaymentMethod,
    getPaymentMethods,
    addPaymentMethod,
    setDefaultPaymentMethod,
    deletePaymentMethod,
    cancelSubscription,
    updatePaymentMethod,
    subscribeWithSavedCard,
    isPremiumUser,
    canAccessContent,
    formatPrice,
    formatSubscriptionDate,
};

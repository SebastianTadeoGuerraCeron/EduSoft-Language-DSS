/**
 * Servicio de Billing y Suscripciones
 * 
 * Maneja todas las llamadas a la API relacionadas con:
 * - Suscripciones Premium
 * - Pagos con Stripe
 * - Historial de pagos
 */

import api from '../API';

/**
 * Obtener planes disponibles
 */
export const getPlans = async () => {
    const response = await api.get('/billing/plans');
    return response.data;
};

/**
 * Crear sesión de checkout con Stripe
 * @param {string} plan - 'MONTHLY' o 'YEARLY'
 * @param {Object} cardData - Datos de tarjeta (opcional, se guardan encriptados)
 */
export const createCheckout = async (plan, cardData = null) => {
    const response = await api.post('/billing/create-checkout', {
        plan,
        cardData,
    });
    return response.data;
};

/**
 * Obtener estado de suscripción actual
 */
export const getSubscriptionStatus = async () => {
    const response = await api.get('/billing/subscription');
    return response.data;
};

/**
 * Obtener historial de pagos
 */
export const getPaymentHistory = async () => {
    const response = await api.get('/billing/history');
    return response.data;
};

/**
 * Obtener método de pago actual
 */
export const getPaymentMethod = async () => {
    const response = await api.get('/billing/payment-method');
    return response.data;
};

/**
 * Cancelar suscripción
 * Requiere re-autenticación (HU06)
 * @param {string} password - Contraseña para re-autenticación
 * @param {boolean} immediate - Si es true, cancela inmediatamente
 */
export const cancelSubscription = async (password, immediate = false) => {
    const response = await api.post('/billing/cancel', 
        { immediate },
        {
            headers: {
                'X-Reauth-Password': password,
            },
        }
    );
    return response.data;
};

/**
 * Reactivate auto-renewal (if previously set to cancel at period end)
 */
export const reactivateSubscription = async () => {
    const response = await api.post('/billing/reactivate');
    return response.data;
};

/**
 * Actualizar método de pago
 * Requiere re-autenticación (HU06)
 * @param {string} password - Contraseña para re-autenticación
 * @param {Object} cardData - Nuevos datos de tarjeta
 */
export const updatePaymentMethod = async (password, cardData) => {
    const response = await api.post('/billing/update-payment-method',
        { cardData },
        {
            headers: {
                'X-Reauth-Password': password,
            },
        }
    );
    return response.data;
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
 * @param {string} plan - 'MONTHLY' o 'YEARLY'
 * @param {string} cardId - ID de la tarjeta a usar (opcional, usa la default si no se especifica)
 */
export const subscribeWithSavedCard = async (plan, cardId = null) => {
    const response = await api.post('/billing/subscribe-with-saved-card', { plan, cardId });
    return response.data;
};

// ========== GESTIÓN DE MÚLTIPLES TARJETAS ==========

/**
 * Obtener todas las tarjetas del usuario
 */
export const getPaymentMethods = async () => {
    const response = await api.get('/billing/payment-methods');
    return response.data;
};

/**
 * Agregar una nueva tarjeta
 * @param {Object} cardData - Datos de la tarjeta
 * @param {string} nickname - Nombre personalizado (opcional)
 * @param {boolean} setAsDefault - Establecer como predeterminada
 */
export const addPaymentMethod = async (cardData, nickname = null, setAsDefault = false) => {
    const response = await api.post('/billing/payment-methods', {
        cardData,
        nickname,
        setAsDefault,
    });
    return response.data;
};

/**
 * Establecer una tarjeta como predeterminada
 * @param {string} cardId - ID de la tarjeta
 */
export const setDefaultPaymentMethod = async (cardId) => {
    const response = await api.put(`/billing/payment-methods/${cardId}/default`);
    return response.data;
};

/**
 * Eliminar una tarjeta
 * Requiere re-autenticación
 * @param {string} cardId - ID de la tarjeta
 * @param {string} password - Contraseña para re-autenticación
 */
export const deletePaymentMethod = async (cardId, password) => {
    const response = await api.delete(`/billing/payment-methods/${cardId}`, {
        headers: {
            'X-Reauth-Password': password,
        },
    });
    return response.data;
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

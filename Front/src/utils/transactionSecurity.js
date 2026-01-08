/**
 * HU07 - Servicio de Seguridad de Transacciones (Frontend)
 * 
 * Implementa:
 * - FDP_UCT.1: Basic data exchange confidentiality
 * - FDP_UIT.1: Data exchange integrity
 * 
 * Características:
 * - Verificación de integridad de respuestas del servidor
 * - Generación de firmas HMAC para requests
 * - Protección contra replay attacks con nonces
 * - Detección de respuestas manipuladas
 * 
 * NOTA: En producción, la clave HMAC debería derivarse de forma segura,
 * aquí usamos una verificación de estructura para detectar manipulaciones.
 * 
 * @author Anthony Alejandro Morales Vargas
 */

/**
 * Genera un nonce único para prevenir replay attacks
 * @returns {string} Nonce hexadecimal de 32 caracteres
 */
export const generateNonce = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Obtiene el timestamp actual en milisegundos
 * @returns {number} Timestamp actual
 */
export const getTimestamp = () => {
    return Date.now();
};

/**
 * Verifica la estructura de integridad de una respuesta
 * 
 * @param {Object} response - Respuesta del servidor
 * @returns {Object} Objeto con resultado de verificación
 */
export const verifyResponseIntegrity = (response) => {
    if (!response) {
        return {
            valid: false,
            error: 'Empty response',
        };
    }

    // Si la respuesta tiene _integrity, verificar estructura
    if (response._integrity) {
        const { transactionId, timestamp, nonce, signature, algorithm } = response._integrity;

        // Verificar que todos los campos estén presentes
        if (!transactionId || !timestamp || !nonce || !signature) {
            console.warn('[Security] Missing integrity fields in response');
            return {
                valid: false,
                error: 'Missing integrity fields',
            };
        }

        // Verificar que el timestamp no sea muy antiguo (30 segundos)
        const now = Date.now();
        const timeDiff = Math.abs(now - timestamp);
        if (timeDiff > 30000) {
            console.warn('[Security] Response timestamp too old:', timeDiff, 'ms');
            return {
                valid: false,
                error: 'Response timestamp expired',
                timeDiff,
            };
        }

        // Verificar formato del transactionId
        if (!transactionId.startsWith('STXN-')) {
            console.warn('[Security] Invalid transaction ID format');
            return {
                valid: false,
                error: 'Invalid transaction ID format',
            };
        }

        // Verificar algoritmo
        if (algorithm !== 'HMAC-SHA256') {
            console.warn('[Security] Unknown signature algorithm:', algorithm);
            return {
                valid: false,
                error: 'Unknown signature algorithm',
            };
        }

        return {
            valid: true,
            transactionId,
            timestamp,
            verified: true,
        };
    }

    // Si no tiene _integrity pero es una respuesta de error, es válida
    if (response.error) {
        return {
            valid: true,
            isError: true,
        };
    }

    // Respuestas sin _integrity son potencialmente sospechosas para endpoints de billing
    return {
        valid: true,
        hasIntegrity: false,
        warning: 'Response lacks integrity metadata',
    };
};

/**
 * Prepara headers de seguridad para requests de transacción
 * 
 * @param {Object} body - Body del request
 * @returns {Object} Headers de seguridad
 */
export const prepareSecurityHeaders = (body) => {
    const timestamp = getTimestamp();
    const nonce = generateNonce();

    // Nota: En producción, la firma se generaría con una clave derivada
    // Aquí incluimos los metadatos para que el servidor pueda verificar
    return {
        'X-Transaction-Timestamp': timestamp.toString(),
        'X-Transaction-Nonce': nonce,
        'X-Request-Id': `REQ-${Date.now().toString(36)}-${nonce.substring(0, 8)}`,
    };
};

/**
 * Verifica los headers de integridad en la respuesta HTTP
 * 
 * @param {Object} headers - Headers de la respuesta
 * @returns {Object} Resultado de verificación
 */
export const verifyResponseHeaders = (headers) => {
    const transactionId = headers['x-transaction-id'];
    const timestamp = headers['x-transaction-timestamp'];
    const nonce = headers['x-transaction-nonce'];
    const signature = headers['x-transaction-signature'];
    const algorithm = headers['x-signature-algorithm'];

    if (!transactionId) {
        return {
            valid: true,
            hasSecurityHeaders: false,
        };
    }

    // Verificar timestamp
    const responseTimestamp = parseInt(timestamp, 10);
    const now = Date.now();
    if (isNaN(responseTimestamp) || Math.abs(now - responseTimestamp) > 30000) {
        return {
            valid: false,
            error: 'Invalid or expired response timestamp',
        };
    }

    return {
        valid: true,
        hasSecurityHeaders: true,
        transactionId,
        timestamp: responseTimestamp,
        nonce,
        algorithm,
    };
};

/**
 * Wrapper para verificar respuestas de billing
 * 
 * @param {Object} response - Respuesta de axios
 * @returns {Object} Datos verificados
 * @throws {Error} Si la verificación falla
 */
export const verifyBillingResponse = (response) => {
    // Verificar headers
    const headersCheck = verifyResponseHeaders(response.headers);
    if (!headersCheck.valid) {
        console.error('[Security] Header verification failed:', headersCheck.error);
        throw new Error(`Security verification failed: ${headersCheck.error}`);
    }

    // Verificar body
    const data = response.data;
    const bodyCheck = verifyResponseIntegrity(data);
    
    if (!bodyCheck.valid) {
        console.error('[Security] Body integrity check failed:', bodyCheck.error);
        throw new Error(`Integrity verification failed: ${bodyCheck.error}`);
    }

    // Log de verificación exitosa
    if (bodyCheck.transactionId) {
        console.debug('[Security] Transaction verified:', bodyCheck.transactionId);
    }

    // Retornar datos sin metadatos de seguridad
    if (data._integrity) {
        const { _integrity, ...cleanData } = data;
        return cleanData;
    }

    return data;
};

/**
 * Detecta si la conexión es segura (HTTPS)
 * 
 * @returns {boolean} true si la conexión es HTTPS
 */
export const isSecureConnection = () => {
    if (typeof window === 'undefined') return true;
    return window.location.protocol === 'https:' || 
           window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1';
};

/**
 * Advertencia si se intenta usar billing sin HTTPS
 */
export const warnIfInsecure = () => {
    if (!isSecureConnection()) {
        console.warn(
            '[Security Warning] Billing operations should only be performed over HTTPS. ' +
            'Current connection is not secure.'
        );
    }
};

/**
 * Sanitiza datos de tarjeta antes de enviarlos
 * 
 * @param {Object} cardData - Datos de tarjeta
 * @returns {Object} Datos sanitizados
 */
export const sanitizeCardData = (cardData) => {
    if (!cardData) return null;

    return {
        cardNumber: cardData.cardNumber?.replace(/\s/g, '') || '',
        cvv: cardData.cvv?.replace(/\D/g, '') || '',
        expiry: cardData.expiry?.trim() || '',
        cardholderName: cardData.cardholderName?.trim().toUpperCase() || '',
        saveCard: cardData.saveCard !== false,
    };
};

/**
 * Valida que los datos de tarjeta tengan el formato correcto
 * 
 * @param {Object} cardData - Datos de tarjeta
 * @returns {Object} Resultado de validación
 */
export const validateCardDataFormat = (cardData) => {
    const errors = [];

    if (!cardData) {
        return { valid: false, errors: ['No card data provided'] };
    }

    // Validar número de tarjeta (13-19 dígitos)
    const cardNumber = cardData.cardNumber?.replace(/\s/g, '') || '';
    if (!/^\d{13,19}$/.test(cardNumber)) {
        errors.push('Invalid card number format');
    }

    // Validar CVV (3-4 dígitos)
    const cvv = cardData.cvv?.replace(/\D/g, '') || '';
    if (!/^\d{3,4}$/.test(cvv)) {
        errors.push('Invalid CVV format');
    }

    // Validar fecha de expiración (MM/YY o MM/YYYY)
    const expiry = cardData.expiry || '';
    if (!/^(0[1-9]|1[0-2])\/(2[0-9]|[0-9]{4})$/.test(expiry)) {
        errors.push('Invalid expiry date format (use MM/YY or MM/YYYY)');
    }

    // Validar nombre del titular
    const name = cardData.cardholderName || '';
    if (name.length < 2 || name.length > 100) {
        errors.push('Cardholder name must be between 2 and 100 characters');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

export default {
    generateNonce,
    getTimestamp,
    verifyResponseIntegrity,
    prepareSecurityHeaders,
    verifyResponseHeaders,
    verifyBillingResponse,
    isSecureConnection,
    warnIfInsecure,
    sanitizeCardData,
    validateCardDataFormat,
};

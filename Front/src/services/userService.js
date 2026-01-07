/**
 * Servicio de Usuario
 * Maneja operaciones relacionadas con el perfil y cuenta del usuario
 */

import api from '../API';

/**
 * Obtener información del usuario actual
 */
export const getCurrentUser = async () => {
    const response = await api.get('/user/me');
    return response.data;
};

/**
 * Actualizar perfil de usuario
 * @param {Object} profileData - Datos del perfil a actualizar
 */
export const updateUserProfile = async (profileData) => {
    const response = await api.put('/user/update-profile', profileData);
    return response.data;
};

/**
 * Eliminar cuenta de usuario (HU10)
 * Cumple con FDP_RIP.1 - Eliminación segura de datos
 * 
 * @param {string} password - Contraseña para confirmar eliminación
 * @returns {Promise} Confirmación de eliminación
 */
export const deleteUserAccount = async (password) => {
    const response = await api.delete('/user/delete-account', {
        data: { password }
    });
    return response.data;
};

/**
 * Enviar email de recuperación de contraseña
 * @param {string} email - Email del usuario
 */
export const sendPasswordRecoveryEmail = async (email) => {
    const response = await api.post('/user/send-email', { email });
    return response.data;
};

/**
 * Recuperar contraseña
 * @param {string} email - Email del usuario
 * @param {string} answerSecret - Respuesta a la pregunta secreta
 * @param {string} newPassword - Nueva contraseña
 */
export const recoverPassword = async (email, answerSecret, newPassword) => {
    const response = await api.post('/user/recover-password', {
        email,
        answerSecret,
        newPassword
    });
    return response.data;
};

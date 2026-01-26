/**
 * Rutas de Billing y Suscripciones
 * 
 * HU07 - Protección de Datos de Pagos (Tránsito)
 * 
 * Implementa:
 * - FDP_UCT.1: Basic data exchange confidentiality
 * - FDP_UIT.1: Data exchange integrity
 * 
 * Características de Seguridad:
 * - Canal cifrado obligatorio (HTTPS) para todos los endpoints de transacción
 * - Verificación de integridad mediante HMAC-SHA256 en respuestas
 * - Rate limiting específico para operaciones de pago
 * - Headers de seguridad (HSTS, CSP, X-Frame-Options, etc.)
 * - Protección contra replay attacks con nonces
 * - Protección contra ataques MITM
 * 
 * Endpoints:
 * - POST /billing/create-checkout - Crear sesión de checkout
 * - POST /billing/webhook - Webhook de Stripe
 * - POST /billing/cancel - Cancelar suscripción
 * - GET /billing/history - Historial de pagos
 * - GET /billing/subscription - Estado de suscripción
 * - GET /billing/payment-methods - Obtener todas las tarjetas
 * - POST /billing/payment-methods - Agregar nueva tarjeta
 * - PUT /billing/payment-methods/:cardId/default - Establecer tarjeta predeterminada
 * - DELETE /billing/payment-methods/:cardId - Eliminar tarjeta
 * - GET /billing/payment-method - Obtener tarjeta predeterminada
 * - GET /billing/plans - Obtener planes disponibles
 * 
 * @author Anthony Alejandro Morales Vargas
 */

import express from "express";
import {
    addPaymentMethodCtrl,
    cancelSubscriptionCtrl,
    createCheckoutCtrl,
    deletePaymentMethodCtrl,
    getPaymentHistoryCtrl,
    getPaymentMethodCtrl,
    getPaymentMethodsCtrl,
    getPlansCtrl,
    getSubscriptionStatusCtrl,
    reactivateSubscriptionCtrl,
    setDefaultPaymentMethodCtrl,
    subscribeWithSavedCardCtrl,
    updatePaymentMethodCtrl,
    webhookCtrl,
} from "../controllers/billing-ctrl";
import { authenticate } from "../middleware/auth";
import { requireReAuthentication } from "../middleware/reAuthenticate";
import {
    addResponseIntegrity,
    assignTransactionId,
    billingRateLimiter,
    cardOperationsRateLimiter,
    requireSecureChannel,
    transactionSecurityHeaders,
    verifyRequestIntegrity,
    webhookRateLimiter,
} from "../middleware/transactionSecurity";

const routerBilling = express.Router();

// ============================================================================
// MIDDLEWARES GLOBALES PARA BILLING
// ============================================================================

// Aplicar headers de seguridad a todas las rutas de billing
routerBilling.use(transactionSecurityHeaders as express.RequestHandler);

// ============================================================================
// RUTAS PÚBLICAS
// ============================================================================

/**
 * GET /billing/plans
 * Obtener planes disponibles (público para página de pricing)
 * No requiere canal seguro obligatorio (es información pública)
 */
routerBilling.get("/plans", getPlansCtrl as express.RequestHandler);

/**
 * POST /billing/webhook
 * Webhook de Stripe (debe recibir raw body)
 * NOTA: Este endpoint necesita configuración especial en index.ts
 * 
 * Seguridad:
 * - Rate limiting específico para webhooks
 * - Verificación de firma de Stripe en el controlador
 */
routerBilling.post(
  "/webhook",
  webhookRateLimiter as express.RequestHandler,
  webhookCtrl as express.RequestHandler
);

// ============================================================================
// RUTAS PROTEGIDAS - OPERACIONES DE SUSCRIPCIÓN
// Requieren: HTTPS, autenticación, integridad de datos
// ============================================================================

/**
 * POST /billing/reactivate
 * Reactivar renovación automática si estaba cancelada al final del período
 * 
 * HU07: Canal cifrado + Verificación de integridad
 */
routerBilling.post(
  "/reactivate",
  requireSecureChannel as express.RequestHandler,
  authenticate as express.RequestHandler,
  assignTransactionId as express.RequestHandler,
  billingRateLimiter as express.RequestHandler,
  addResponseIntegrity as express.RequestHandler,
  reactivateSubscriptionCtrl as express.RequestHandler
);

// ============================================================================
// RUTAS PROTEGIDAS - OPERACIONES DE PAGO
// HU07: Canal cifrado obligatorio + Verificación de integridad
// ============================================================================

/**
 * POST /billing/create-checkout
 * Crear sesión de checkout con Stripe
 * 
 * CRÍTICO: Este endpoint maneja datos de tarjeta
 * HU07: HTTPS obligatorio + Rate limiting + Integridad
 */
routerBilling.post(
  "/create-checkout",
  requireSecureChannel as express.RequestHandler,
  authenticate as express.RequestHandler,
  assignTransactionId as express.RequestHandler,
  verifyRequestIntegrity as express.RequestHandler,
  billingRateLimiter as express.RequestHandler,
  addResponseIntegrity as express.RequestHandler,
  createCheckoutCtrl as express.RequestHandler
);

/**
 * GET /billing/subscription
 * Obtener estado de suscripción actual
 * HU07: Canal seguro para datos financieros
 */
routerBilling.get(
  "/subscription",
  requireSecureChannel as express.RequestHandler,
  authenticate as express.RequestHandler,
  addResponseIntegrity as express.RequestHandler,
  getSubscriptionStatusCtrl as express.RequestHandler
);

/**
 * GET /billing/history
 * Obtener historial de pagos
 * HU07: Canal seguro + Integridad en respuesta
 */
routerBilling.get(
  "/history",
  requireSecureChannel as express.RequestHandler,
  authenticate as express.RequestHandler,
  addResponseIntegrity as express.RequestHandler,
  getPaymentHistoryCtrl as express.RequestHandler
);

// ============================================================================
// RUTAS PROTEGIDAS - GESTIÓN DE TARJETAS
// HU07: Máxima seguridad para datos de tarjeta
// ============================================================================

/**
 * GET /billing/payment-method
 * Obtener tarjeta predeterminada (solo datos no sensibles)
 */
routerBilling.get(
  "/payment-method",
  requireSecureChannel as express.RequestHandler,
  authenticate as express.RequestHandler,
  addResponseIntegrity as express.RequestHandler,
  getPaymentMethodCtrl as express.RequestHandler
);

/**
 * GET /billing/payment-methods
 * Obtener todas las tarjetas del usuario
 */
routerBilling.get(
  "/payment-methods",
  requireSecureChannel as express.RequestHandler,
  authenticate as express.RequestHandler,
  addResponseIntegrity as express.RequestHandler,
  getPaymentMethodsCtrl as express.RequestHandler
);

/**
 * POST /billing/payment-methods
 * Agregar una nueva tarjeta
 * CRÍTICO: Datos sensibles de tarjeta
 */
routerBilling.post(
  "/payment-methods",
  requireSecureChannel as express.RequestHandler,
  authenticate as express.RequestHandler,
  assignTransactionId as express.RequestHandler,
  verifyRequestIntegrity as express.RequestHandler,
  cardOperationsRateLimiter as express.RequestHandler,
  addResponseIntegrity as express.RequestHandler,
  addPaymentMethodCtrl as express.RequestHandler
);

/**
 * PUT /billing/payment-methods/:cardId/default
 * Establecer una tarjeta como predeterminada
 */
routerBilling.put(
  "/payment-methods/:cardId/default",
  requireSecureChannel as express.RequestHandler,
  authenticate as express.RequestHandler,
  assignTransactionId as express.RequestHandler,
  cardOperationsRateLimiter as express.RequestHandler,
  addResponseIntegrity as express.RequestHandler,
  setDefaultPaymentMethodCtrl as express.RequestHandler
);

/**
 * DELETE /billing/payment-methods/:cardId
 * Eliminar una tarjeta
 * HU06 + HU07: Re-autenticación + Canal seguro
 */
routerBilling.delete(
  "/payment-methods/:cardId",
  requireSecureChannel as express.RequestHandler,
  authenticate as express.RequestHandler,
  requireReAuthentication as express.RequestHandler,
  assignTransactionId as express.RequestHandler,
  cardOperationsRateLimiter as express.RequestHandler,
  addResponseIntegrity as express.RequestHandler,
  deletePaymentMethodCtrl as express.RequestHandler
);

// ============================================================================
// RUTAS CRÍTICAS - REQUIEREN RE-AUTENTICACIÓN (HU06) + SEGURIDAD (HU07)
// ============================================================================

/**
 * POST /billing/cancel
 * Cancelar suscripción
 * HU06: Re-autenticación obligatoria
 * HU07: Canal cifrado + Integridad
 */
routerBilling.post(
  "/cancel",
  requireSecureChannel as express.RequestHandler,
  authenticate as express.RequestHandler,
  requireReAuthentication as express.RequestHandler,
  assignTransactionId as express.RequestHandler,
  billingRateLimiter as express.RequestHandler,
  addResponseIntegrity as express.RequestHandler,
  cancelSubscriptionCtrl as express.RequestHandler
);

/**
 * POST /billing/update-payment-method
 * Actualizar método de pago
 * HU06: Re-autenticación obligatoria
 * HU07: Canal cifrado + Integridad + Verificación de request
 */
routerBilling.post(
  "/update-payment-method",
  requireSecureChannel as express.RequestHandler,
  authenticate as express.RequestHandler,
  requireReAuthentication as express.RequestHandler,
  assignTransactionId as express.RequestHandler,
  verifyRequestIntegrity as express.RequestHandler,
  cardOperationsRateLimiter as express.RequestHandler,
  addResponseIntegrity as express.RequestHandler,
  updatePaymentMethodCtrl as express.RequestHandler
);

/**
 * POST /billing/subscribe-with-saved-card
 * Suscribirse usando la tarjeta guardada en la BD
 * HU07: Canal cifrado + Rate limiting + Integridad
 */
routerBilling.post(
  "/subscribe-with-saved-card",
  requireSecureChannel as express.RequestHandler,
  authenticate as express.RequestHandler,
  assignTransactionId as express.RequestHandler,
  billingRateLimiter as express.RequestHandler,
  addResponseIntegrity as express.RequestHandler,
  subscribeWithSavedCardCtrl as express.RequestHandler
);

export { routerBilling };

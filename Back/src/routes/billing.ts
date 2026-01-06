/**
 * Rutas de Billing y Suscripciones
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
 */

import express from "express";
import {
  createCheckoutCtrl,
  webhookCtrl,
  cancelSubscriptionCtrl,
  getPaymentHistoryCtrl,
  getSubscriptionStatusCtrl,
  updatePaymentMethodCtrl,
  getPaymentMethodCtrl,
  getPaymentMethodsCtrl,
  addPaymentMethodCtrl,
  setDefaultPaymentMethodCtrl,
  deletePaymentMethodCtrl,
  getPlansCtrl,
  subscribeWithSavedCardCtrl,
  reactivateSubscriptionCtrl,
} from "../controllers/billing-ctrl";
import { authenticate } from "../middleware/auth";
import { requireReAuthentication } from "../middleware/reAuthenticate";

const routerBilling = express.Router();

// ===== Rutas públicas =====

/**
 * GET /billing/plans
 * Obtener planes disponibles (público para página de pricing)
 */
routerBilling.get("/plans", getPlansCtrl as express.RequestHandler);

/**
 * POST /billing/reactivate
 * Reactivar renovación automática si estaba cancelada al final del período
 */
routerBilling.post(
  "/reactivate",
  authenticate as express.RequestHandler,
  reactivateSubscriptionCtrl as express.RequestHandler
);

/**
 * POST /billing/webhook
 * Webhook de Stripe (debe recibir raw body)
 * NOTA: Este endpoint necesita configuración especial en index.ts
 * para recibir el body como raw/buffer
 */
routerBilling.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  webhookCtrl as express.RequestHandler
);

// ===== Rutas protegidas (requieren autenticación) =====

/**
 * POST /billing/create-checkout
 * Crear sesión de checkout con Stripe
 */
routerBilling.post(
  "/create-checkout",
  authenticate as express.RequestHandler,
  createCheckoutCtrl as express.RequestHandler
);

/**
 * GET /billing/subscription
 * Obtener estado de suscripción actual
 */
routerBilling.get(
  "/subscription",
  authenticate as express.RequestHandler,
  getSubscriptionStatusCtrl as express.RequestHandler
);

/**
 * GET /billing/history
 * Obtener historial de pagos
 */
routerBilling.get(
  "/history",
  authenticate as express.RequestHandler,
  getPaymentHistoryCtrl as express.RequestHandler
);

/**
 * GET /billing/payment-method
 * Obtener tarjeta predeterminada (solo datos no sensibles)
 */
routerBilling.get(
  "/payment-method",
  authenticate as express.RequestHandler,
  getPaymentMethodCtrl as express.RequestHandler
);

/**
 * GET /billing/payment-methods
 * Obtener todas las tarjetas del usuario
 */
routerBilling.get(
  "/payment-methods",
  authenticate as express.RequestHandler,
  getPaymentMethodsCtrl as express.RequestHandler
);

/**
 * POST /billing/payment-methods
 * Agregar una nueva tarjeta
 */
routerBilling.post(
  "/payment-methods",
  authenticate as express.RequestHandler,
  addPaymentMethodCtrl as express.RequestHandler
);

/**
 * PUT /billing/payment-methods/:cardId/default
 * Establecer una tarjeta como predeterminada
 */
routerBilling.put(
  "/payment-methods/:cardId/default",
  authenticate as express.RequestHandler,
  setDefaultPaymentMethodCtrl as express.RequestHandler
);

/**
 * DELETE /billing/payment-methods/:cardId
 * Eliminar una tarjeta
 */
routerBilling.delete(
  "/payment-methods/:cardId",
  authenticate as express.RequestHandler,
  requireReAuthentication as express.RequestHandler,
  deletePaymentMethodCtrl as express.RequestHandler
);

// ===== Rutas que requieren re-autenticación (HU06) =====

/**
 * POST /billing/cancel
 * Cancelar suscripción
 * Requiere re-autenticación con header X-Reauth-Password
 */
routerBilling.post(
  "/cancel",
  authenticate as express.RequestHandler,
  requireReAuthentication as express.RequestHandler,
  cancelSubscriptionCtrl as express.RequestHandler
);

/**
 * POST /billing/update-payment-method
 * Actualizar método de pago
 * Requiere re-autenticación con header X-Reauth-Password
 */
routerBilling.post(
  "/update-payment-method",
  authenticate as express.RequestHandler,
  requireReAuthentication as express.RequestHandler,
  updatePaymentMethodCtrl as express.RequestHandler
);

/**
 * POST /billing/subscribe-with-saved-card
 * Suscribirse usando la tarjeta guardada en la BD
 * Desencripta los datos y crea la suscripción en Stripe
 */
routerBilling.post(
  "/subscribe-with-saved-card",
  authenticate as express.RequestHandler,
  subscribeWithSavedCardCtrl as express.RequestHandler
);

export { routerBilling };

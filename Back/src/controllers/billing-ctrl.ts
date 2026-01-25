/**
 * Controlador de Billing y Suscripciones
 * 
 * Maneja todas las operaciones relacionadas con:
 * - Suscripciones Premium
 * - Pagos con Stripe
 * - Almacenamiento seguro de datos de tarjetas
 * - Historial de pagos
 * 
 * Cumple con:
 * - HU06: Re-autenticación para acciones críticas
 * - HU07: Protección de datos en tránsito (hash de integridad)
 * - HU08: Cifrado de datos en reposo (AES-256-GCM)
 */

import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { PrismaClient } from "@prisma/client";
import { normalizeIP } from "../utils/networkConstants";
import {
  encryptCardData,
  decryptCardData,
  generateIntegrityHash,
  generateTransactionId,
  validateCardNumber,
} from "../utils/encryption";
import * as stripeService from "../services/stripe";
import { getBillingPrisma } from "../services/billingDb";
import { getAuditPrisma } from "../services/auditDb";
import {
  logUserActivity,
  ActivityAction,
} from "./audit-ctrl";

const prisma = new PrismaClient();

/**
 * Helper para obtener la IP real del cliente
 * Maneja proxies, IPv6 loopback, y múltiples formatos
 */
function getClientIP(req: AuthRequest): string {
  // Orden de prioridad para obtener la IP
  const forwardedFor = req.headers["x-forwarded-for"];
  const realIP = req.headers["x-real-ip"];
  
  let ip: string | undefined;
  
  // X-Forwarded-For puede tener múltiples IPs separadas por coma
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    ip = ips.split(",")[0].trim();
  } else if (realIP) {
    ip = Array.isArray(realIP) ? realIP[0] : realIP;
  } else {
    ip = req.ip || req.socket?.remoteAddress;
  }
  
  return normalizeIP(ip);
}

/**
 * Crear suscripción con datos de tarjeta propios
 * POST /billing/create-checkout
 * 
 * Si se proporcionan datos de tarjeta, procesa directamente sin Stripe Checkout
 */
export const createCheckoutCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { plan, cardData } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validar plan
    if (!plan || !["MONTHLY", "YEARLY"].includes(plan)) {
      res.status(400).json({ error: "Invalid plan. Must be MONTHLY or YEARLY" });
      return;
    }

    // Obtener información del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true, role: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // VALIDAR QUE SOLO ESTUDIANTES PUEDAN SUSCRIBIRSE
    if (!["STUDENT_FREE", "STUDENT_PRO"].includes(user.role)) {
      res.status(403).json({ error: "Only students can subscribe to premium plans" });
      return;
    }

    // Verificar que no sea ya PRO
    if (user.role === "STUDENT_PRO") {
      res.status(400).json({ error: "User already has a premium subscription" });
      return;
    }

    // ========== FLUJO DIRECTO CON DATOS DE TARJETA ==========
    // Si se proporcionaron datos de tarjeta, procesar directamente sin Stripe Checkout
    if (cardData && cardData.cardNumber && cardData.cvv && cardData.expiry) {
      // Guardar datos encriptados solo si el usuario lo solicita
      if (cardData.saveCard !== false) {
        await saveCardData(userId, cardData, req);
      }

      // Crear PaymentMethod en Stripe con los datos de tarjeta
      const paymentMethod = await stripeService.createPaymentMethodFromCard({
        cardNumber: cardData.cardNumber.replace(/\s/g, ''),
        cvv: cardData.cvv,
        expiry: cardData.expiry,
        cardholderName: cardData.cardholderName,
      });

      // Obtener o crear cliente de Stripe
      const customer = await stripeService.getOrCreateStripeCustomer(user.email, userId, user.username);

      // Adjuntar PaymentMethod al cliente
      await stripeService.attachPaymentMethodToCustomer(paymentMethod.id, customer.id, true);

      // Crear suscripción directamente
      const subscription = await stripeService.createSubscriptionWithPaymentMethod({
        customerId: customer.id,
        paymentMethodId: paymentMethod.id,
        plan: plan as "MONTHLY" | "YEARLY",
        userId,
      });

      // Actualizar registro de suscripción en la BD
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: plan as "MONTHLY" | "YEARLY",
          status: "ACTIVE",
          autoRenewal: true,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: subscription.id,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + (plan === "YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000),
          canceledAt: null,
        },
        update: {
          plan: plan as "MONTHLY" | "YEARLY",
          status: "ACTIVE",
          autoRenewal: true,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: subscription.id,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + (plan === "YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000),
          canceledAt: null,
        },
      });

      // Actualizar rol del usuario a PRO
      await prisma.user.update({
        where: { id: userId },
        data: { role: "STUDENT_PRO" },
      });

      // Crear registro de pago
      await prisma.payment.create({
        data: {
          userId,
          amount: stripeService.PLAN_PRICES[plan as "MONTHLY" | "YEARLY"].amount,
          currency: "USD",
          status: "COMPLETED",
          stripePaymentIntentId: subscription.id,
          transactionId: generateTransactionId(),
          integrityHash: generateIntegrityHash(`${userId}|${plan}|${new Date().toISOString()}`),
        },
      });

      // Log de acceso
      await getAuditPrisma().billingAccessLog.create({
        data: {
          userId,
          action: "PAYMENT",
          ipAddress: getClientIP(req),
          userAgent: req.headers["user-agent"],
          success: true,
        },
      });

      // Responder con éxito (sin redirección a Stripe)
      res.json({
        success: true,
        message: "Subscription created successfully",
        subscription: {
          id: subscription.id,
          plan,
          status: subscription.status,
        },
      });
      return;
    }

    // ========== FLUJO LEGACY: STRIPE CHECKOUT (sin datos de tarjeta) ==========
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    
    const session = await stripeService.createCheckoutSession({
      userId,
      email: user.email,
      plan: plan as "MONTHLY" | "YEARLY",
      customerName: user.username,
      successUrl: `${frontendUrl}/#/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/#/billing/cancel`,
    });

    // Crear registro de suscripción pendiente
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: plan as "MONTHLY" | "YEARLY",
        status: "PENDING",
        stripeCustomerId: session.customer as string,
      },
      update: {
        plan: plan as "MONTHLY" | "YEARLY",
        status: "PENDING",
        stripeCustomerId: session.customer as string,
      },
    });

    res.json({
      sessionId: session.id,
      sessionUrl: session.url,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ 
      error: "Failed to create checkout session",
      details: (error as Error).message,
    });
    return;
  }
};

/**
 * Webhook de Stripe para procesar eventos de pago
 * POST /billing/webhook
 */
export const webhookCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const signature = req.headers["stripe-signature"] as string;

    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    // Verificar y construir el evento
    let event;
    try {
      event = await stripeService.constructWebhookEvent(req.body, signature);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    // Manejar diferentes tipos de eventos
    console.log(`[Webhook] Processing event: ${event.type}`);
    
    switch (event.type) {
      case "checkout.session.completed": {
        console.log(`[Webhook] Checkout session completed`);
        const session = event.data.object as any;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.updated": {
        console.log(`[Webhook] Customer subscription updated`);
        const subscription = event.data.object as any;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
    return;
  }
};

/**
 * Cancelar suscripción
 * POST /billing/cancel
 */
export const cancelSubscriptionCtrl = async (req: AuthRequest, res: Response) => {
  try {
    console.log('[cancelSubscriptionCtrl] Starting cancellation process');
    const userId = req.userId;
    const { immediate } = req.body;

    console.log('[cancelSubscriptionCtrl] Request details:', {
      userId,
      immediate,
      reAuthenticated: req.reAuthenticated,
      headers: Object.keys(req.headers)
    });

    if (!userId) {
      console.log('[cancelSubscriptionCtrl] No userId found');
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Verificar que sea estudiante
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || !["STUDENT_FREE", "STUDENT_PRO"].includes(user.role)) {
      res.status(403).json({ error: "Only students can manage subscriptions" });
      return;
    }

    // Verificar re-autenticación (HU06)
    if (!req.reAuthenticated) {
      console.log('[cancelSubscriptionCtrl] Re-authentication failed');
      res.status(401).json({
        error: "Re-authentication required",
        code: "REAUTH_REQUIRED",
      });
      return;
    }

    console.log('[cancelSubscriptionCtrl] Re-authentication successful, finding subscription');

    // Obtener suscripción actual
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    console.log('[cancelSubscriptionCtrl] Subscription found:', {
      id: subscription?.id,
      status: subscription?.status,
      stripeSubscriptionId: subscription?.stripeSubscriptionId
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      console.log('[cancelSubscriptionCtrl] No active subscription found');
      res.status(404).json({ error: "No active subscription found" });
      return;
    }

    // First check the subscription status in Stripe
    console.log('[cancelSubscriptionCtrl] Checking subscription status in Stripe:', subscription.stripeSubscriptionId);
    const stripeSubscription = await stripeService.getSubscription(subscription.stripeSubscriptionId);

    console.log('[cancelSubscriptionCtrl] Stripe subscription status:', {
      exists: !!stripeSubscription,
      status: stripeSubscription?.status,
      cancel_at_period_end: stripeSubscription?.cancel_at_period_end,
    });

    // If subscription doesn't exist or is already canceled/not active in Stripe
    const inactiveStatuses = ["canceled", "incomplete_expired", "unpaid"];
    if (!stripeSubscription || inactiveStatuses.includes(stripeSubscription.status)) {
      console.log('[cancelSubscriptionCtrl] Subscription already canceled/inactive in Stripe, syncing local DB');
      
      // Just sync the local database
      await prisma.subscription.update({
        where: { userId },
        data: {
          status: "CANCELED",
          autoRenewal: false,
          canceledAt: subscription.canceledAt || new Date(),
        },
      });

      // Update user role to FREE
      await prisma.user.update({
        where: { id: userId },
        data: { role: "STUDENT_FREE" },
      });

      res.json({
        message: "Subscription was already canceled. Your account has been updated.",
        alreadyCanceled: true,
      });
      return;
    }

    // If already set to cancel at period end and user wants period-end cancel, nothing to do
    if (!immediate && stripeSubscription.cancel_at_period_end) {
      console.log('[cancelSubscriptionCtrl] Subscription already set to cancel at period end');
      
      // Sync local DB
      await prisma.subscription.update({
        where: { userId },
        data: {
          autoRenewal: false,
          canceledAt: subscription.canceledAt || new Date(),
        },
      });

      res.json({
        message: "Subscription is already scheduled to cancel at the end of the billing period.",
        alreadyCanceled: true,
      });
      return;
    }

    console.log('[cancelSubscriptionCtrl] Cancelling subscription in Stripe:', subscription.stripeSubscriptionId);

    // Cancelar en Stripe
    const canceledSub = await stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
      immediate === true
    );

    console.log('[cancelSubscriptionCtrl] Stripe cancellation result:', {
      id: canceledSub.id,
      status: canceledSub.status,
      cancel_at: canceledSub.cancel_at
    });

    console.log('[cancelSubscriptionCtrl] Updating subscription in database');

    // Actualizar en BD
    await prisma.subscription.update({
      where: { userId },
      data: {
        status: immediate ? "CANCELED" : "ACTIVE",
        autoRenewal: false,
        canceledAt: new Date(),
      },
    });

    // Si es cancelación inmediata, cambiar rol a FREE
    if (immediate) {
      console.log('[cancelSubscriptionCtrl] Updating user role to STUDENT_FREE');
      await prisma.user.update({
        where: { id: userId },
        data: { role: "STUDENT_FREE" },
      });
    }

    console.log('[cancelSubscriptionCtrl] Cancellation process completed successfully');

    // Log de cancelación de suscripción
    await logUserActivity(req, {
      userId,
      action: ActivityAction.CANCEL_SUBSCRIPTION,
      resourceType: "SUBSCRIPTION",
      resource: subscription.id,
      success: true,
      details: { 
        plan: subscription.plan,
        immediate,
        cancelAt: canceledSub.cancel_at ? new Date(canceledSub.cancel_at * 1000) : null
      },
    });

    res.json({
      message: immediate
        ? "Subscription canceled immediately"
        : "Subscription will be canceled at the end of the billing period",
      cancelAt: canceledSub.cancel_at
        ? new Date(canceledSub.cancel_at * 1000)
        : null,
    });
  } catch (error) {
    console.error("[cancelSubscriptionCtrl] Error canceling subscription:", error);
    res.status(500).json({ error: "Failed to cancel subscription" });
    return;
  }
};

/**
 * Reactivate auto-renewal for a subscription (if it was set to cancel at period end)
 * POST /billing/reactivate
 */
export const reactivateSubscriptionCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const subscription = await prisma.subscription.findUnique({ where: { userId } });

    if (!subscription || !subscription.stripeSubscriptionId) {
      res.status(404).json({ error: "No subscription found to reactivate" });
      return;
    }

    // First check the subscription status in Stripe
    const stripeSubscription = await stripeService.getSubscription(subscription.stripeSubscriptionId);

    if (!stripeSubscription) {
      res.status(404).json({ error: "Subscription not found in Stripe" });
      return;
    }

    // If the subscription is fully canceled, it cannot be reactivated
    if (stripeSubscription.status === "canceled") {
      res.status(400).json({ 
        error: "This subscription has been fully canceled and cannot be reactivated. Please create a new subscription.",
        requiresNewSubscription: true
      });
      return;
    }

    // Only reactivate if it's active but scheduled to cancel
    if (!stripeSubscription.cancel_at_period_end) {
      res.status(400).json({ error: "This subscription is already active and not scheduled for cancellation" });
      return;
    }

    // Reactivate in Stripe (sets cancel_at_period_end to false)
    await stripeService.reactivateSubscription(subscription.stripeSubscriptionId);

    // Update DB (don't change period dates, they remain the same)
    await prisma.subscription.update({
      where: { userId },
      data: {
        status: "ACTIVE",
        autoRenewal: true,
        canceledAt: null,
      },
    });

    res.json({
      message: "Auto-renewal has been re-enabled",
      autoRenewal: true,
    });
  } catch (error) {
    console.error("[reactivateSubscriptionCtrl] Error reactivating subscription:", error);
    res.status(500).json({ error: "Failed to reactivate subscription" });
    return;
  }
};

/**
 * Obtener historial de pagos
 * GET /billing/history
 */
export const getPaymentHistoryCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Obtener pagos de la BD local
    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Generar hash de integridad para la respuesta (HU07)
    const responseData = JSON.stringify(payments);
    const integrityHash = generateIntegrityHash(responseData);

    res.json({
      payments,
      integrityHash,
      total: payments.length,
    });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({ error: "Failed to fetch payment history" });
    return;
  }
};

/**
 * Obtener estado de suscripción actual
 * GET /billing/subscription
 */
export const getSubscriptionStatusCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    let subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    // Sync with Stripe if we have a subscription
    if (subscription?.stripeSubscriptionId) {
      try {
        const stripeSubscription = await stripeService.getSubscription(subscription.stripeSubscriptionId);
        
        if (stripeSubscription) {
          // Check if there's a mismatch and sync
          const stripeAutoRenewal = !stripeSubscription.cancel_at_period_end;
          const stripeStatus = stripeSubscription.status === "active" ? "ACTIVE" : 
                              stripeSubscription.status === "canceled" ? "CANCELED" : subscription.status;
          
          if (subscription.autoRenewal !== stripeAutoRenewal || subscription.status !== stripeStatus) {
            // Update local DB to match Stripe
            subscription = await prisma.subscription.update({
              where: { userId },
              data: {
                autoRenewal: stripeAutoRenewal,
                status: stripeStatus,
                canceledAt: stripeAutoRenewal ? null : subscription.canceledAt,
              },
            });
          }
        }
      } catch (e) {
        console.warn("Could not sync with Stripe:", e);
      }
    }

    // Obtener información de tarjeta (solo últimos 4 dígitos)
    const billingPrisma = getBillingPrisma();
    let cardInfo = null;
    
    try {
      const billingInfo = await billingPrisma.billingInfo.findFirst({
        where: { 
          userId,
          isActive: true,
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          lastFourDigits: true,
          cardBrand: true,
          cardholderName: true,
        },
      });
      cardInfo = billingInfo;
    } catch (e) {
      // BD de billing puede no estar disponible
      console.warn("Could not fetch billing info:", e);
    }

    res.json({
      isPremium: user?.role === "STUDENT_PRO",
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            autoRenewal: subscription.autoRenewal,
            canceledAt: subscription.canceledAt,
          }
        : null,
      paymentMethod: cardInfo,
    });
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    res.status(500).json({ error: "Failed to fetch subscription status" });
    return;
  }
};

/**
 * Actualizar método de pago
 * POST /billing/update-payment-method
 */
export const updatePaymentMethodCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { cardData } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Verificar re-autenticación (HU06)
    if (!req.reAuthenticated) {
      res.status(401).json({
        error: "Re-authentication required",
        code: "REAUTH_REQUIRED",
      });
      return;
    }

    if (!cardData) {
      res.status(400).json({ error: "Card data is required" });
      return;
    }

    // Validar número de tarjeta
    if (!validateCardNumber(cardData.cardNumber)) {
      res.status(400).json({ error: "Invalid card number" });
      return;
    }

    // Guardar datos encriptados
    await saveCardData(userId, cardData, req);

    // Si hay suscripción activa en Stripe, actualizar método de pago
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (subscription?.stripeCustomerId) {
      // Crear SetupIntent para agregar nuevo método de pago
      const setupIntent = await stripeService.createSetupIntent(
        subscription.stripeCustomerId
      );

      res.json({
        message: "Card data saved. Complete setup with Stripe.",
        clientSecret: setupIntent.client_secret,
      });
      return;
    }

    res.json({ message: "Payment method updated successfully" });
  } catch (error) {
    console.error("Error updating payment method:", error);
    res.status(500).json({ error: "Failed to update payment method" });
    return;
  }
};

/**
 * Suscribirse usando la tarjeta guardada en la BD
 * POST /billing/subscribe-with-saved-card
 * 
 * Este endpoint usa los datos de tarjeta encriptados guardados
 * en nuestra BD para crear una suscripción en Stripe
 */
export const subscribeWithSavedCardCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { plan, cvv } = req.body; // CVV DEBE ser proporcionado de nuevo

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validar plan
    if (!plan || !["MONTHLY", "YEARLY"].includes(plan)) {
      res.status(400).json({ error: "Invalid plan. Must be MONTHLY or YEARLY" });
      return;
    }

    // Validar CVV
    if (!cvv || !/^\d{3,4}$/.test(cvv)) {
      res.status(400).json({ error: "CVV is required and must be 3 or 4 digits" });
      return;
    }

    // Obtener usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true, role: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Validar que sea estudiante
    if (!["STUDENT_FREE", "STUDENT_PRO"].includes(user.role)) {
      res.status(403).json({ error: "Only students can subscribe to premium plans" });
      return;
    }

    // Verificar que no sea ya PRO
    if (user.role === "STUDENT_PRO") {
      res.status(400).json({ error: "User already has a premium subscription" });
      return;
    }

    // Obtener datos de tarjeta encriptados
    const billingPrisma = getBillingPrisma();
    const billingInfo = await billingPrisma.billingInfo.findFirst({
      where: { 
        userId,
        isActive: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (!billingInfo) {
      res.status(404).json({ error: "No saved card found. Please add a payment method first." });
      return;
    }
    console.log('[subscribeWithSavedCardCtrl] Saved card found:', { id: billingInfo.id, lastFour: billingInfo.lastFourDigits });

    // Verificar que hay datos encriptados completos
    if (!billingInfo.encryptedCardNumber || 
        !billingInfo.encryptedExpiry ||
        !billingInfo.ivCardNumber || 
        !billingInfo.ivExpiry ||
        !billingInfo.authTagCardNumber ||
        !billingInfo.authTagExpiry) {
      res.status(400).json({ 
        error: "This card cannot be used for automatic payments. Please enter your card details again to create a new subscription." 
      });
      return;
    }

    // Desencriptar los datos de la tarjeta (EXCEPTO CVV que nunca se guarda)
    let decryptedCard;
    try {
      decryptedCard = decryptCardData({
        encryptedCardNumber: billingInfo.encryptedCardNumber,
        encryptedExpiry: billingInfo.encryptedExpiry,
        ivCardNumber: billingInfo.ivCardNumber,
        ivExpiry: billingInfo.ivExpiry,
        authTagCardNumber: billingInfo.authTagCardNumber,
        authTagExpiry: billingInfo.authTagExpiry,
        integrityHash: billingInfo.integrityHash,
        lastFourDigits: billingInfo.lastFourDigits,
      });
    } catch (decryptError) {
      console.error("Error decrypting card data:", decryptError);
      
      // Eliminar tarjeta corrupta automáticamente
      try {
        await billingPrisma.billingInfo.delete({
          where: { id: billingInfo.id }
        });
      } catch (deleteError) {
        console.error("Error deleting corrupted card:", deleteError);
      }
      
      res.status(400).json({ 
        error: "Unable to decrypt saved card data. The corrupted card has been removed. Please enter your card details again." 
      });
      return;
    }

    // Crear PaymentMethod en Stripe con los datos desencriptados + CVV proporcionado
    const paymentMethod = await stripeService.createPaymentMethodFromCard({
      cardNumber: decryptedCard.cardNumber,
      cvv: cvv, // CVV proporcionado por el usuario AHORA
      expiry: decryptedCard.expiry,
      cardholderName: billingInfo.cardholderName,
    });

    // Obtener o crear cliente de Stripe
    const customer = await stripeService.getOrCreateStripeCustomer(user.email, userId, user.username);

    // Adjuntar PaymentMethod al cliente
    await stripeService.attachPaymentMethodToCustomer(paymentMethod.id, customer.id, true);

    // Crear suscripción
    const subscription = await stripeService.createSubscriptionWithPaymentMethod({
      customerId: customer.id,
      paymentMethodId: paymentMethod.id,
      plan: plan as "MONTHLY" | "YEARLY",
      userId,
    });

    // Actualizar registro de suscripción en la BD
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: plan as "MONTHLY" | "YEARLY",
        status: "ACTIVE",
        autoRenewal: true,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + (plan === "YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000),
        canceledAt: null,
      },
      update: {
        plan: plan as "MONTHLY" | "YEARLY",
        status: "ACTIVE",
        autoRenewal: true,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + (plan === "YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000),
        canceledAt: null,
      },
    });

    // Actualizar rol del usuario a PRO
    await prisma.user.update({
      where: { id: userId },
      data: { role: "STUDENT_PRO" },
    });

    // Crear registro de pago
    await prisma.payment.create({
      data: {
        userId,
        amount: stripeService.PLAN_PRICES[plan as "MONTHLY" | "YEARLY"].amount,
        currency: "USD",
        status: "COMPLETED",
        stripePaymentIntentId: subscription.id,
        transactionId: generateTransactionId(),
        integrityHash: generateIntegrityHash(`${userId}|${plan}|${new Date().toISOString()}`),
      },
    });

    // Log de acceso
    await getAuditPrisma().billingAccessLog.create({
      data: {
        userId,
        action: "PAYMENT",
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"],
        success: true,
      },
    });

    res.json({
      success: true,
      message: "Subscription created successfully using saved card",
      subscription: {
        id: subscription.id,
        plan,
        status: subscription.status,
      },
    });
  } catch (error: any) {
    console.error("Error subscribing with saved card:", error);
    
    // Errores específicos de Stripe
    if (error.type === 'StripeCardError') {
      res.status(400).json({ error: `Card error: ${error.message}` });
      return;
    }
    
    // Error de integridad de datos
    if (error.message?.includes('integrity')) {
      res.status(400).json({ error: "Card data integrity check failed. Please update your payment method." });
      return;
    }
    
    res.status(500).json({ error: "Failed to create subscription" });
    return;
  }
};

/**
 * Obtener TODAS las tarjetas del usuario (solo datos no sensibles)
 * GET /billing/payment-methods
 */
export const getPaymentMethodsCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const billingPrisma = getBillingPrisma();
    
    const cards = await billingPrisma.billingInfo.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        lastFourDigits: true,
        cardBrand: true,
        cardholderName: true,
        isDefault: true,
        nickname: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ paymentMethods: cards });
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    res.status(500).json({ error: "Failed to fetch payment methods" });
    return;
  }
};

/**
 * Obtener tarjeta predeterminada (solo datos no sensibles)
 * GET /billing/payment-method
 */
export const getPaymentMethodCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const billingPrisma = getBillingPrisma();
    
    // Buscar tarjeta predeterminada, o la más reciente
    const billingInfo = await billingPrisma.billingInfo.findFirst({
      where: { userId, isActive: true },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        lastFourDigits: true,
        cardBrand: true,
        cardholderName: true,
        isDefault: true,
        nickname: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Retornar 200 con null si no hay tarjeta guardada (no es un error)
    if (!billingInfo) {
      res.json({ paymentMethod: null });
      return;
    }

    res.json({ paymentMethod: billingInfo });
  } catch (error) {
    console.error("Error fetching payment method:", error);
    res.status(500).json({ error: "Failed to fetch payment method" });
    return;
  }
};

/**
 * Agregar nueva tarjeta
 * POST /billing/payment-methods
 */
export const addPaymentMethodCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { cardData, nickname, setAsDefault } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!cardData || !cardData.cardNumber || !cardData.cvv || !cardData.expiry) {
      res.status(400).json({ error: "Card data is required" });
      return;
    }

    const billingPrisma = getBillingPrisma();

    // Validar número de tarjeta
    const cleanCardNumber = cardData.cardNumber.replace(/\s/g, '');
    if (!validateCardNumber(cleanCardNumber)) {
      res.status(400).json({ error: "Invalid card number" });
      return;
    }

    // Verificar si ya existe una tarjeta con los mismos últimos 4 dígitos
    const lastFour = cleanCardNumber.slice(-4);
    const existingCard = await billingPrisma.billingInfo.findFirst({
      where: { userId, lastFourDigits: lastFour, isActive: true },
    });

    if (existingCard) {
      res.status(409).json({ error: "A card with these last 4 digits already exists" });
      return;
    }

    // Encriptar datos
    const encryptedData = encryptCardData({
      cardNumber: cleanCardNumber,
      cvv: cardData.cvv,
      expiry: cardData.expiry,
      cardholderName: cardData.cardholderName || '',
    });

    // Si se va a establecer como predeterminada, quitar el default de las demás
    if (setAsDefault) {
      await billingPrisma.billingInfo.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Verificar si es la primera tarjeta (hacerla default automáticamente)
    const existingCards = await billingPrisma.billingInfo.count({
      where: { userId, isActive: true },
    });
    const shouldBeDefault = setAsDefault || existingCards === 0;

    // Crear la nueva tarjeta
    const newCard = await billingPrisma.billingInfo.create({
      data: {
        userId,
        ...encryptedData,
        isDefault: shouldBeDefault,
        nickname: nickname || null,
      },
    });

    // Log de acceso
    await getAuditPrisma().billingAccessLog.create({
      data: {
        userId,
        action: "CREATE",
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"],
        success: true,
        details: `Added new card ending in ${lastFour}`,
      },
    });

    res.status(201).json({
      success: true,
      message: "Card added successfully",
      card: {
        id: newCard.id,
        lastFourDigits: newCard.lastFourDigits,
        cardBrand: newCard.cardBrand,
        cardholderName: newCard.cardholderName,
        isDefault: newCard.isDefault,
        nickname: newCard.nickname,
      },
    });
  } catch (error: any) {
    console.error("Error adding payment method:", error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: "This card already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to add payment method" });
    return;
  }
};

/**
 * Establecer tarjeta como predeterminada
 * PUT /billing/payment-methods/:cardId/default
 */
export const setDefaultPaymentMethodCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { cardId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!cardId) {
      res.status(400).json({ error: "Card ID is required" });
      return;
    }

    const billingPrisma = getBillingPrisma();

    // Verificar que la tarjeta existe y pertenece al usuario
    const card = await billingPrisma.billingInfo.findFirst({
      where: { id: cardId, userId, isActive: true },
    });

    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    // Quitar el default de todas las tarjetas del usuario
    await billingPrisma.billingInfo.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    // Establecer la nueva tarjeta como predeterminada
    await billingPrisma.billingInfo.update({
      where: { id: cardId },
      data: { isDefault: true },
    });

    // Log de acceso
    await getAuditPrisma().billingAccessLog.create({
      data: {
        userId,
        action: "UPDATE",
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"],
        success: true,
        details: `Set card ${card.lastFourDigits} as default`,
      },
    });

    res.json({
      success: true,
      message: "Default payment method updated",
    });
  } catch (error) {
    console.error("Error setting default payment method:", error);
    res.status(500).json({ error: "Failed to update default payment method" });
    return;
  }
};

/**
 * Eliminar tarjeta
 * DELETE /billing/payment-methods/:cardId
 */
export const deletePaymentMethodCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { cardId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!cardId) {
      res.status(400).json({ error: "Card ID is required" });
      return;
    }

    const billingPrisma = getBillingPrisma();

    // Verificar que la tarjeta existe y pertenece al usuario
    const card = await billingPrisma.billingInfo.findFirst({
      where: { id: cardId, userId, isActive: true },
    });

    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    // Soft delete (marcar como inactiva)
    await billingPrisma.billingInfo.update({
      where: { id: cardId },
      data: { isActive: false, isDefault: false },
    });

    // Si era la tarjeta predeterminada, establecer otra como default
    if (card.isDefault) {
      const nextCard = await billingPrisma.billingInfo.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      if (nextCard) {
        await billingPrisma.billingInfo.update({
          where: { id: nextCard.id },
          data: { isDefault: true },
        });
      }
    }

    // Log de acceso
    await getAuditPrisma().billingAccessLog.create({
      data: {
        userId,
        action: "DELETE",
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"],
        success: true,
        details: `Removed card ending in ${card.lastFourDigits}`,
      },
    });

    res.json({
      success: true,
      message: "Card removed successfully",
    });
  } catch (error) {
    console.error("Error deleting payment method:", error);
    res.status(500).json({ error: "Failed to remove payment method" });
    return;
  }
};

/**
 * Obtener precios de los planes
 * GET /billing/plans
 */
export const getPlansCtrl = async (_req: AuthRequest, res: Response) => {
  try {
    const plans = [
      {
        id: "MONTHLY",
        name: "Monthly Pro",
        price: stripeService.PLAN_PRICES.MONTHLY.amount / 100,
        currency: "USD",
        interval: "month",
        features: [
          "Access to all premium & free lessons",
          "Access to all premium & free exams",
          "All platform games",
          "Priority support",
        ],
      },
      {
        id: "YEARLY",
        name: "Yearly Pro",
        price: stripeService.PLAN_PRICES.YEARLY.amount / 100,
        currency: "USD",
        interval: "year",
        savings: "Save 17%",
        features: [
          "All Monthly features",
          "2 months free",
        ],
      },
    ];

    res.json({ plans });
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ error: "Failed to fetch plans" });
    return;
  }
};

// ==================== FUNCIONES HELPER ====================

/**
 * Guardar datos de tarjeta encriptados en la BD de billing
 * Permite múltiples tarjetas por usuario
 */
async function saveCardData(
  userId: string,
  cardData: {
    cardNumber: string;
    cvv: string;
    expiry: string;
    cardholderName: string;
  },
  req: AuthRequest,
  setAsDefault: boolean = true
): Promise<string> {
  const billingPrisma = getBillingPrisma();

  const cleanCardNumber = cardData.cardNumber.replace(/\s/g, '');

  // Validar número de tarjeta
  if (!validateCardNumber(cleanCardNumber)) {
    throw new Error("Invalid card number");
  }

  // Encriptar datos
  const encryptedData = encryptCardData({
    ...cardData,
    cardNumber: cleanCardNumber,
  });

  const lastFour = cleanCardNumber.slice(-4);

  // Verificar si ya existe una tarjeta con estos últimos 4 dígitos
  const existingCard = await billingPrisma.billingInfo.findFirst({
    where: { userId, lastFourDigits: lastFour, isActive: true },
  });

  let cardId: string;

  if (existingCard) {
    // Actualizar la tarjeta existente
    const updated = await billingPrisma.billingInfo.update({
      where: { id: existingCard.id },
      data: {
        ...encryptedData,
        updatedAt: new Date(),
      },
    });
    cardId = updated.id;
  } else {
    // Si se va a establecer como predeterminada, quitar el default de las demás
    if (setAsDefault) {
      await billingPrisma.billingInfo.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Verificar si es la primera tarjeta
    const existingCards = await billingPrisma.billingInfo.count({
      where: { userId, isActive: true },
    });
    const shouldBeDefault = setAsDefault || existingCards === 0;

    // Crear nueva tarjeta
    const newCard = await billingPrisma.billingInfo.create({
      data: {
        userId,
        ...encryptedData,
        isDefault: shouldBeDefault,
      },
    });
    cardId = newCard.id;
  }

  // Log de acceso para auditoría
  await getAuditPrisma().billingAccessLog.create({
    data: {
      userId,
      action: existingCard ? "UPDATE" : "CREATE",
      ipAddress: getClientIP(req),
      userAgent: req.headers["user-agent"],
      success: true,
      details: `Card ending in ${lastFour}`,
    },
  });

  return cardId;
}

/**
 * Handler para checkout completado
 */
async function handleCheckoutCompleted(session: any): Promise<void> {
  console.log(`[handleCheckoutCompleted] Starting processing for session:`, session.id);
  
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;

  console.log(`[handleCheckoutCompleted] userId: ${userId}, plan: ${plan}`);

  if (!userId) {
    console.error("No userId in checkout session metadata");
    return;
  }

  try {
    // Actualizar suscripción
    console.log(`[handleCheckoutCompleted] Updating subscription for user ${userId}`);
    await prisma.subscription.update({
      where: { userId },
      data: {
        status: "ACTIVE",
        stripeSubscriptionId: session.subscription,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + (plan === "YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000),
      },
    });

    // Cambiar rol a STUDENT_PRO
    console.log(`[handleCheckoutCompleted] Updating user role to STUDENT_PRO for user ${userId}`);
    await prisma.user.update({
      where: { id: userId },
      data: { role: "STUDENT_PRO" },
    });

  // Crear registro de pago
  await prisma.payment.create({
    data: {
      userId,
      amount: session.amount_total,
      currency: session.currency?.toUpperCase() || "USD",
      status: "COMPLETED",
      stripePaymentIntentId: session.payment_intent,
      transactionId: generateTransactionId(),
      integrityHash: generateIntegrityHash(
        `${userId}|${session.amount_total}|${session.payment_intent}`
      ),
      description: `Subscription: ${plan}`,
    },
  });

  // Obtener y guardar información del método de pago desde Stripe
  try {
    console.log(`[handleCheckoutCompleted] Processing payment method for session:`, {
      customer: session.customer,
      payment_method_types: session.payment_method_types,
      payment_intent: session.payment_intent
    });

    if (session.customer) {
      console.log(`[handleCheckoutCompleted] Getting customer info for: ${session.customer}`);
      const customer = await stripeService.getCustomer(session.customer);
      console.log(`[handleCheckoutCompleted] Customer retrieved:`, customer.name || 'No name');
      
      console.log(`[handleCheckoutCompleted] Getting payment methods for customer`);
      const paymentMethods = await stripeService.getPaymentMethods(session.customer);
      console.log(`[handleCheckoutCompleted] Found ${paymentMethods.length} payment methods`);
      
      if (paymentMethods.length > 0) {
        const paymentMethod = paymentMethods[0];
        console.log(`[handleCheckoutCompleted] Payment method type: ${paymentMethod.type}`);
        
        if (paymentMethod.type === 'card' && paymentMethod.card) {
          const card = paymentMethod.card;
          console.log(`[handleCheckoutCompleted] Card info:`, {
            last4: card.last4,
            brand: card.brand,
            exp_month: card.exp_month,
            exp_year: card.exp_year
          });
          
          // Guardar información básica de la tarjeta (no sensible)
          console.log(`[handleCheckoutCompleted] Saving card info to billing DB`);
          const billingPrisma = getBillingPrisma();
          
          // Buscar si ya existe una tarjeta con estos últimos 4 dígitos
          const existingCard = await billingPrisma.billingInfo.findFirst({
            where: { 
              userId,
              lastFourDigits: card.last4,
            },
          });

          if (existingCard) {
            // Actualizar tarjeta existente
            await billingPrisma.billingInfo.update({
              where: { id: existingCard.id },
              data: {
                cardBrand: card.brand.toUpperCase(),
                cardholderName: customer.name || '',
                encryptedExpiry: `${card.exp_month.toString().padStart(2, '0')}/${card.exp_year.toString().slice(-2)}`,
                isActive: true,
                updatedAt: new Date(),
              },
            });
          } else {
            // Crear nueva tarjeta
            await billingPrisma.billingInfo.create({
              data: {
                userId,
                lastFourDigits: card.last4,
                cardBrand: card.brand.toUpperCase(),
                cardholderName: customer.name || '',
                encryptedCardNumber: '', // No guardamos el número completo desde Stripe
                encryptedCVV: '',       // CVV nunca se almacena
                encryptedExpiry: `${card.exp_month.toString().padStart(2, '0')}/${card.exp_year.toString().slice(-2)}`,
                iv: '',                 // No aplicable para datos de Stripe
                authTag: '',            // No aplicable para datos de Stripe  
                integrityHash: '',      // No aplicable para datos de Stripe
                isDefault: true,
                isActive: true,
              },
            });
          }
          console.log(`[handleCheckoutCompleted] Card info saved successfully`);
        } else {
          console.log(`[handleCheckoutCompleted] No card payment method found`);
        }
      } else {
        console.log(`[handleCheckoutCompleted] No payment methods found for customer`);
      }
    } else {
      console.log(`[handleCheckoutCompleted] No customer ID in session`);
    }
  } catch (cardError) {
    console.warn('Could not save card info from Stripe:', cardError);
  }

  console.log(`User ${userId} upgraded to STUDENT_PRO with ${plan} plan`);
  
  } catch (error) {
    console.error(`[handleCheckoutCompleted] Error processing checkout for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Handler para suscripción actualizada
 */
async function handleSubscriptionUpdated(subscription: any): Promise<void> {
  const userId = subscription.metadata?.userId;

  if (!userId) return;

  const status = mapStripeStatus(subscription.status);

  await prisma.subscription.update({
    where: { userId },
    data: {
      status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      autoRenewal: !subscription.cancel_at_period_end,
      canceledAt: subscription.cancel_at_period_end ? new Date() : null,
    },
  });
}

/**
 * Handler para suscripción eliminada
 */
async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  const userId = subscription.metadata?.userId;

  if (!userId) return;

  await prisma.subscription.update({
    where: { userId },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
    },
  });

  // Cambiar rol a FREE
  await prisma.user.update({
    where: { id: userId },
    data: { role: "STUDENT_FREE" },
  });

  console.log(`User ${userId} subscription canceled, downgraded to FREE`);
}

/**
 * Handler para pago exitoso
 */
async function handlePaymentSucceeded(invoice: any): Promise<void> {
  const customerId = invoice.customer;

  // Buscar usuario por stripeCustomerId
  const subscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!subscription) return;

  await prisma.payment.create({
    data: {
      userId: subscription.userId,
      subscriptionId: subscription.id,
      amount: invoice.amount_paid,
      currency: invoice.currency?.toUpperCase() || "USD",
      status: "COMPLETED",
      stripePaymentIntentId: invoice.payment_intent,
      transactionId: generateTransactionId(),
      integrityHash: generateIntegrityHash(
        `${subscription.userId}|${invoice.amount_paid}|${invoice.payment_intent}`
      ),
      description: "Subscription renewal",
    },
  });
}

/**
 * Handler para pago fallido
 */
async function handlePaymentFailed(invoice: any): Promise<void> {
  const customerId = invoice.customer;

  const subscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!subscription) return;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "PAST_DUE" },
  });

  await prisma.payment.create({
    data: {
      userId: subscription.userId,
      subscriptionId: subscription.id,
      amount: invoice.amount_due,
      currency: invoice.currency?.toUpperCase() || "USD",
      status: "FAILED",
      transactionId: generateTransactionId(),
      description: "Payment failed",
    },
  });
}

/**
 * Mapear estado de Stripe a nuestro enum
 */
function mapStripeStatus(stripeStatus: string): "ACTIVE" | "CANCELED" | "EXPIRED" | "PAST_DUE" | "PENDING" {
  switch (stripeStatus) {
    case "active":
      return "ACTIVE";
    case "canceled":
      return "CANCELED";
    case "past_due":
      return "PAST_DUE";
    case "unpaid":
      return "PAST_DUE";
    case "incomplete":
      return "PENDING";
    case "incomplete_expired":
      return "EXPIRED";
    default:
      return "PENDING";
  }
}

/**
 * Job de Verificación de Suscripciones Expiradas
 * 
 * Este job se ejecuta periódicamente para:
 * - Verificar suscripciones que han expirado
 * - Cambiar el rol de usuarios a STUDENT_FREE si su suscripción expiró
 * - Actualizar el estado de suscripciones vencidas
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Verifica y actualiza suscripciones expiradas
 */
export const checkExpiredSubscriptions = async (): Promise<void> => {
  try {
    const now = new Date();
    console.log(`[SubscriptionCheck] Running check at ${now.toISOString()}`);

    // Buscar suscripciones activas que han expirado
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        autoRenewal: false, // No renovación automática
        currentPeriodEnd: {
          lt: now,
        },
      },
      include: {
        user: {
          select: { id: true, email: true, username: true },
        },
      },
    });

    console.log(`[SubscriptionCheck] Found ${expiredSubscriptions.length} expired subscriptions`);

    for (const subscription of expiredSubscriptions) {
      try {
        // Actualizar estado de suscripción
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: "EXPIRED" },
        });

        // Cambiar rol del usuario a FREE
        await prisma.user.update({
          where: { id: subscription.userId },
          data: { role: "STUDENT_FREE" },
        });

        console.log(
          `[SubscriptionCheck] User ${subscription.user.username} (${subscription.user.email}) downgraded to FREE`
        );
      } catch (error) {
        console.error(
          `[SubscriptionCheck] Error processing subscription ${subscription.id}:`,
          error
        );
      }
    }

    // También verificar suscripciones PAST_DUE que llevan mucho tiempo
    const pastDueThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 días

    const longPastDue = await prisma.subscription.findMany({
      where: {
        status: "PAST_DUE",
        updatedAt: {
          lt: pastDueThreshold,
        },
      },
      include: {
        user: {
          select: { id: true, email: true, username: true },
        },
      },
    });

    console.log(`[SubscriptionCheck] Found ${longPastDue.length} long past-due subscriptions`);

    for (const subscription of longPastDue) {
      try {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: "EXPIRED" },
        });

        await prisma.user.update({
          where: { id: subscription.userId },
          data: { role: "STUDENT_FREE" },
        });

        console.log(
          `[SubscriptionCheck] Past-due user ${subscription.user.username} downgraded to FREE`
        );
      } catch (error) {
        console.error(
          `[SubscriptionCheck] Error processing past-due subscription ${subscription.id}:`,
          error
        );
      }
    }

    console.log(`[SubscriptionCheck] Check completed successfully`);
  } catch (error) {
    console.error("[SubscriptionCheck] Error running subscription check:", error);
  }
};

/**
 * Inicia el job de verificación periódica
 * @param intervalMinutes - Intervalo en minutos entre cada verificación
 */
export const startSubscriptionCheckJob = (intervalMinutes: number = 60): NodeJS.Timeout => {
  console.log(
    `[SubscriptionCheck] Starting subscription check job (every ${intervalMinutes} minutes)`
  );

  // Ejecutar inmediatamente al iniciar
  checkExpiredSubscriptions();

  // Configurar intervalo
  const intervalMs = intervalMinutes * 60 * 1000;
  const intervalId = setInterval(checkExpiredSubscriptions, intervalMs);

  return intervalId;
};

/**
 * Detiene el job de verificación
 */
export const stopSubscriptionCheckJob = (intervalId: NodeJS.Timeout): void => {
  clearInterval(intervalId);
  console.log("[SubscriptionCheck] Subscription check job stopped");
};

export default {
  checkExpiredSubscriptions,
  startSubscriptionCheckJob,
  stopSubscriptionCheckJob,
};

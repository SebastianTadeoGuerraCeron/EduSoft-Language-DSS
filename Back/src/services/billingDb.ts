/**
 * Cliente de Prisma para la Base de Datos de Billing
 * 
 * Esta es una BD SEPARADA que almacena datos sensibles de tarjetas
 * Cumple con HU08: Separación de datos sensibles
 * 
 * Los datos de tarjetas están encriptados con AES-256-GCM
 * La clave de encriptación está en variables de entorno (separada de la BD)
 */

import { PrismaClient as BillingPrismaClient } from "@prisma/billing-client";

// Singleton para el cliente de billing
let billingPrisma: BillingPrismaClient | null = null;

/**
 * Obtiene el cliente de Prisma para la BD de billing
 * Implementa el patrón singleton para reutilizar la conexión
 */
export const getBillingPrisma = (): BillingPrismaClient => {
  if (!billingPrisma) {
    billingPrisma = new BillingPrismaClient();
  }
  return billingPrisma;
};

/**
 * Cierra la conexión con la BD de billing
 * Útil para cleanup en tests o shutdown
 */
export const disconnectBillingPrisma = async (): Promise<void> => {
  if (billingPrisma) {
    await billingPrisma.$disconnect();
    billingPrisma = null;
  }
};

export default getBillingPrisma;

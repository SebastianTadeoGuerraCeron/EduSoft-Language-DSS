/**
 * Cliente de Prisma para la Base de Datos de Auditoría
 * 
 * BD SEPARADA para logs de seguridad y auditoría
 * 
 * Beneficios de seguridad:
 * - Aislamiento: Si comprometen la BD principal, los logs siguen intactos
 * - Permisos: La app solo tiene INSERT, admins tienen SELECT
 * - Cumplimiento: GDPR/SOC2 requieren logs separados
 * - Performance: No afecta la velocidad de la app principal
 */

import { PrismaClient as AuditPrismaClient } from "@prisma/audit-client";

// Singleton para el cliente de auditoría
let auditPrisma: AuditPrismaClient | null = null;

/**
 * Obtiene el cliente de Prisma para la BD de auditoría
 * Implementa el patrón singleton para reutilizar la conexión
 */
export const getAuditPrisma = (): AuditPrismaClient => {
  if (!auditPrisma) {
    auditPrisma = new AuditPrismaClient();
  }
  return auditPrisma;
};

/**
 * Cierra la conexión con la BD de auditoría
 * Útil para cleanup en tests o shutdown
 */
export const disconnectAuditPrisma = async (): Promise<void> => {
  if (auditPrisma) {
    await auditPrisma.$disconnect();
    auditPrisma = null;
  }
};

export default getAuditPrisma;

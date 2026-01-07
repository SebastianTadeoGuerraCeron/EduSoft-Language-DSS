/**
 * HU03 - Security Logger para auditoría de eventos de seguridad
 * Registra intentos de contraseñas débiles y actividades sospechosas
 */

export enum SecurityEventType {
  WEAK_PASSWORD_ATTEMPT = "weak_password_attempt",
  REGISTRATION_SUCCESS = "registration_success",
  REGISTRATION_FAILED = "registration_failed",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  COMMON_PASSWORD_ATTEMPT = "common_password_attempt",
  USERNAME_IN_PASSWORD = "username_in_password",
  SEQUENTIAL_PASSWORD = "sequential_password",
}

interface SecurityLogEvent {
  eventType: SecurityEventType;
  username?: string;
  email?: string;
  ipAddress: string;
  userAgent?: string;
  details?: any;
}

/**
 * Registra un evento de seguridad en la base de datos o logs
 * @param event - Evento de seguridad a registrar
 */
export const logSecurityEvent = async (
  event: SecurityLogEvent
): Promise<void> => {
  try {
    // Log en consola para monitoreo inmediato
    console.log(`[SECURITY] ${event.eventType}`, {
      username: event.username,
      email: event.email,
      ip: event.ipAddress,
      timestamp: new Date().toISOString(),
      details: event.details,
    });

    // Alertas críticas
    if (
      event.eventType === SecurityEventType.WEAK_PASSWORD_ATTEMPT ||
      event.eventType === SecurityEventType.COMMON_PASSWORD_ATTEMPT
    ) {
      console.warn(
        `⚠️ [SECURITY ALERT] Weak password attempt from ${event.ipAddress} for user: ${event.username || event.email}`
      );
    }

    if (event.eventType === SecurityEventType.RATE_LIMIT_EXCEEDED) {
      console.error(
        `🚨 [SECURITY ALERT] Rate limit exceeded from ${event.ipAddress}`
      );
    }

    // Aquí puedes implementar almacenamiento en BD si creas la tabla SecurityLog
    // await prisma.securityLog.create({
    //   data: {
    //     eventType: event.eventType,
    //     username: event.username,
    //     email: event.email,
    //     ipAddress: event.ipAddress,
    //     userAgent: event.userAgent,
    //     details: event.details,
    //     timestamp: new Date(),
    //   },
    // });
  } catch (error) {
    console.error("Error logging security event:", error);
    // No fallar la operación principal si el logging falla
  }
};

/**
 * Registra intento de contraseña débil
 */
export const logWeakPasswordAttempt = async (
  username: string,
  email: string,
  ipAddress: string,
  errors: string[]
): Promise<void> => {
  await logSecurityEvent({
    eventType: SecurityEventType.WEAK_PASSWORD_ATTEMPT,
    username,
    email,
    ipAddress,
    details: { errors },
  });
};

/**
 * Registra registro exitoso
 */
export const logRegistrationSuccess = async (
  username: string,
  email: string,
  ipAddress: string,
  role: string
): Promise<void> => {
  await logSecurityEvent({
    eventType: SecurityEventType.REGISTRATION_SUCCESS,
    username,
    email,
    ipAddress,
    details: { role },
  });
};

/**
 * Registra registro fallido
 */
export const logRegistrationFailed = async (
  email: string,
  ipAddress: string,
  reason: string
): Promise<void> => {
  await logSecurityEvent({
    eventType: SecurityEventType.REGISTRATION_FAILED,
    email,
    ipAddress,
    details: { reason },
  });
};

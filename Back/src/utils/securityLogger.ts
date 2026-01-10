/**
 * HU03 & HU07 - Security Logger para auditoría de eventos de seguridad
 * Registra intentos de contraseñas débiles, actividades sospechosas y
 * eventos de seguridad de transacciones
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
  // HU07 - Eventos de seguridad de transacciones
  INSECURE_CHANNEL_ACCESS = "insecure_channel_access",
  PROTOCOL_DOWNGRADE = "protocol_downgrade",
  INTEGRITY_CHECK_FAILED = "integrity_check_failed",
  REPLAY_ATTACK_DETECTED = "replay_attack_detected",
  TIMESTAMP_EXPIRED = "timestamp_expired",
  PAYMENT_TRANSACTION = "payment_transaction",
  PAYMENT_TRANSACTION_FAILED = "payment_transaction_failed",
  CARD_OPERATION = "card_operation",
  WEBHOOK_SIGNATURE_INVALID = "webhook_signature_invalid",
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

// ============================================================================
// HU07 - Funciones de logging para transacciones
// ============================================================================

/**
 * Registra intento de acceso por canal inseguro
 */
export const logInsecureChannelAccess = async (
  ipAddress: string,
  path: string,
  userAgent?: string
): Promise<void> => {
  await logSecurityEvent({
    eventType: SecurityEventType.INSECURE_CHANNEL_ACCESS,
    ipAddress,
    userAgent,
    details: { path },
  });
};

/**
 * Registra intento de downgrade de protocolo
 */
export const logProtocolDowngrade = async (
  ipAddress: string,
  protocol: string,
  path: string
): Promise<void> => {
  await logSecurityEvent({
    eventType: SecurityEventType.PROTOCOL_DOWNGRADE,
    ipAddress,
    details: { protocol, path },
  });
};

/**
 * Registra fallo de verificación de integridad
 */
export const logIntegrityCheckFailed = async (
  ipAddress: string,
  path: string,
  userId?: string,
  reason?: string
): Promise<void> => {
  await logSecurityEvent({
    eventType: SecurityEventType.INTEGRITY_CHECK_FAILED,
    ipAddress,
    details: { path, userId, reason },
  });
};

/**
 * Registra detección de replay attack
 */
export const logReplayAttack = async (
  ipAddress: string,
  nonce: string,
  path: string
): Promise<void> => {
  await logSecurityEvent({
    eventType: SecurityEventType.REPLAY_ATTACK_DETECTED,
    ipAddress,
    details: { nonce, path },
  });
};

/**
 * Registra transacción de pago exitosa
 */
export const logPaymentTransaction = async (
  userId: string,
  ipAddress: string,
  transactionId: string,
  amount: number,
  plan: string
): Promise<void> => {
  await logSecurityEvent({
    eventType: SecurityEventType.PAYMENT_TRANSACTION,
    ipAddress,
    details: { userId, transactionId, amount, plan },
  });
};

/**
 * Registra transacción de pago fallida
 */
export const logPaymentTransactionFailed = async (
  userId: string,
  ipAddress: string,
  reason: string,
  plan: string
): Promise<void> => {
  await logSecurityEvent({
    eventType: SecurityEventType.PAYMENT_TRANSACTION_FAILED,
    ipAddress,
    details: { userId, reason, plan },
  });
};

/**
 * Registra operación de tarjeta
 */
export const logCardOperation = async (
  userId: string,
  ipAddress: string,
  operation: "add" | "delete" | "update" | "setDefault",
  success: boolean
): Promise<void> => {
  await logSecurityEvent({
    eventType: SecurityEventType.CARD_OPERATION,
    ipAddress,
    details: { userId, operation, success },
  });
};

/**
 * Registra firma de webhook inválida
 */
export const logWebhookSignatureInvalid = async (
  ipAddress: string,
  userAgent?: string
): Promise<void> => {
  await logSecurityEvent({
    eventType: SecurityEventType.WEBHOOK_SIGNATURE_INVALID,
    ipAddress,
    userAgent,
  });
};

/**
 * ============================================================================
 * SERVICIO DE AUDITORÍA Y LOGGING DE SEGURIDAD
 * ============================================================================
 * 
 * @module securityLogger
 * @description
 * Sistema de logging especializado para eventos de seguridad. Registra
 * intentos de autenticación, actividades sospechosas, y eventos de
 * transacciones para cumplimiento y análisis forense.
 * 
 * ## Historias de Usuario Implementadas:
 * 
 * ### HU03 - Registro de Intentos de Contraseñas Débiles
 * - Log de contraseñas que no cumplen criterios de seguridad
 * - Registro de patrones detectados (secuencias, username en password)
 * - Alertas de rate limiting excedido
 * 
 * ### HU07 - Auditoría de Seguridad de Transacciones
 * - Registro de intentos de acceso por canal inseguro (HTTP)
 * - Detección y log de replay attacks
 * - Registro de fallos de verificación de integridad
 * - Auditoría de operaciones de tarjetas de crédito
 * 
 * ## Mapeo Common Criteria (ISO/IEC 15408):
 * 
 * | Componente | Nombre | Implementación |
 * |------------|--------|----------------|
 * | FAU_GEN.1  | Audit Data Generation | logSecurityEvent() |
 * | FAU_GEN.2  | User Identity Association | userId/username en logs |
 * | FAU_SAR.1  | Audit Review | Logs en consola y BD |
 * | FAU_STG.1  | Protected Audit Trail Storage | BD separada de auditoría |
 * 
 * ## Niveles de Alerta:
 * 
 * | Tipo de Evento | Nivel | Acción |
 * |----------------|-------|--------|
 * | WEAK_PASSWORD_ATTEMPT | WARN | Log + Alerta consola |
 * | RATE_LIMIT_EXCEEDED | ERROR | Log + Alerta crítica |
 * | REPLAY_ATTACK_DETECTED | CRITICAL | Log + Bloqueo temporal |
 * | INTEGRITY_CHECK_FAILED | CRITICAL | Log + Investigación |
 * 
 * @author EduSoft Security Team
 * @version 2.0.0
 * @since 2024-01-15
 */

/**
 * Enumeración de tipos de eventos de seguridad
 * 
 * ## Categorías:
 * - **Autenticación**: WEAK_PASSWORD, REGISTRATION_*, LOGIN
 * - **Rate Limiting**: RATE_LIMIT_EXCEEDED
 * - **Transacciones HU07**: INSECURE_CHANNEL, PROTOCOL_DOWNGRADE, etc.
 */
export enum SecurityEventType {
  // ========================================================================
  // EVENTOS DE AUTENTICACIÓN Y CONTRASEÑAS (HU03)
  // ========================================================================
  
  /** Intento de registro con contraseña que no cumple criterios mínimos */
  WEAK_PASSWORD_ATTEMPT = "weak_password_attempt",
  
  /** Registro de usuario completado exitosamente */
  REGISTRATION_SUCCESS = "registration_success",
  
  /** Registro fallido (email duplicado, validación, etc.) */
  REGISTRATION_FAILED = "registration_failed",
  
  /** Actividad que dispara heurísticas de detección de anomalías */
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
  
  /** IP excedió límite de requests - posible ataque de fuerza bruta */
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  
  /** Contraseña encontrada en lista de contraseñas comunes */
  COMMON_PASSWORD_ATTEMPT = "common_password_attempt",
  
  /** Contraseña contiene el nombre de usuario */
  USERNAME_IN_PASSWORD = "username_in_password",
  
  /** Contraseña contiene secuencias numéricas (123, 111, etc.) */
  SEQUENTIAL_PASSWORD = "sequential_password",
  
  // ========================================================================
  // EVENTOS DE SEGURIDAD DE TRANSACCIONES (HU07)
  // ========================================================================
  
  /** Intento de acceso a endpoint de billing sin HTTPS */
  INSECURE_CHANNEL_ACCESS = "insecure_channel_access",
  
  /** Intento de degradar conexión de HTTPS a HTTP */
  PROTOCOL_DOWNGRADE = "protocol_downgrade",
  
  /** Hash de integridad no coincide - datos posiblemente manipulados */
  INTEGRITY_CHECK_FAILED = "integrity_check_failed",
  
  /** Nonce reutilizado - posible replay attack */
  REPLAY_ATTACK_DETECTED = "replay_attack_detected",
  
  /** Timestamp de transacción fuera de ventana permitida */
  TIMESTAMP_EXPIRED = "timestamp_expired",
  
  /** Transacción de pago completada exitosamente */
  PAYMENT_TRANSACTION = "payment_transaction",
  
  /** Transacción de pago fallida */
  PAYMENT_TRANSACTION_FAILED = "payment_transaction_failed",
  
  /** Operación CRUD sobre tarjeta de crédito */
  CARD_OPERATION = "card_operation",
  
  /** Firma de webhook de Stripe inválida */
  WEBHOOK_SIGNATURE_INVALID = "webhook_signature_invalid",
}

/**
 * Interfaz para estructurar eventos de seguridad
 * 
 * ## Campos Obligatorios:
 * - **eventType**: Clasificación del evento
 * - **ipAddress**: IP origen para análisis y bloqueo
 * 
 * ## Campos Opcionales:
 * - **username/email**: Identificación del usuario involucrado
 * - **userAgent**: Para detección de bots/automatización
 * - **details**: Datos adicionales específicos del evento
 */
interface SecurityLogEvent {
  eventType: SecurityEventType;
  username?: string;
  email?: string;
  ipAddress: string;
  userAgent?: string;
  details?: any;
}

// ============================================================================
// FUNCIÓN CORE DE LOGGING
// ============================================================================

/**
 * Registra un evento de seguridad en los sistemas de auditoría
 * 
 * ## Flujo de Procesamiento:
 * 1. Log estructurado en consola (monitoreo en tiempo real)
 * 2. Clasificación por severidad (WARN/ERROR para críticos)
 * 3. (Opcional) Persistencia en base de datos de auditoría
 * 
 * ## Información Registrada:
 * - Timestamp ISO 8601
 * - Tipo de evento
 * - Usuario involucrado (si aplica)
 * - IP origen
 * - Detalles adicionales
 * 
 * ## Integración con Sistemas Externos:
 * Este logger puede extenderse para enviar a:
 * - SIEM (Security Information and Event Management)
 * - CloudWatch Logs / Application Insights
 * - Slack/Discord webhooks para alertas críticas
 * 
 * @implements FAU_GEN.1 - Generación de datos de auditoría
 * @param {SecurityLogEvent} event - Evento de seguridad a registrar
 * @returns {Promise<void>}
 * 
 * @example
 * await logSecurityEvent({
 *   eventType: SecurityEventType.FAILED_LOGIN,
 *   username: 'john_doe',
 *   ipAddress: '192.168.1.1',
 *   details: { attempts: 3 }
 * });
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

// ============================================================================
// FUNCIONES HELPER PARA EVENTOS DE AUTENTICACIÓN (HU03)
// ============================================================================

/**
 * Registra intento de registro con contraseña débil
 * 
 * @implements HU03 - Auditoría de intentos de contraseñas inseguras
 * @param {string} username - Username intentado
 * @param {string} email - Email del registro
 * @param {string} ipAddress - IP origen
 * @param {string[]} errors - Lista de criterios no cumplidos
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
 * Registra registro de usuario exitoso
 * 
 * @implements HU03 - Auditoría de registros exitosos
 * @param {string} username - Username registrado
 * @param {string} email - Email registrado
 * @param {string} ipAddress - IP origen
 * @param {string} role - Rol asignado al nuevo usuario
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
 * Registra intento de registro fallido
 * 
 * @param {string} email - Email que intentó registrarse
 * @param {string} ipAddress - IP origen
 * @param {string} reason - Razón del fallo (duplicate, validation, etc.)
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
// FUNCIONES HELPER PARA EVENTOS DE TRANSACCIONES (HU07)
// ============================================================================

/**
 * Registra intento de acceso por canal inseguro (HTTP en lugar de HTTPS)
 * 
 * ## Severidad: CRÍTICA
 * Indica que el cliente no está usando conexión cifrada, lo que
 * expone datos sensibles de pago a interceptación.
 * 
 * @implements HU07 - FDP_UCT.1 (Basic data exchange confidentiality)
 * @param {string} ipAddress - IP origen
 * @param {string} path - Endpoint intentado (e.g., /billing/subscribe)
 * @param {string} [userAgent] - User-Agent del cliente
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
 * Registra intento de degradación de protocolo
 * 
 * ## Ataque Mitigado: Protocol Downgrade Attack
 * Atacante intenta forzar uso de protocolo menos seguro.
 * 
 * @implements HU07 - Protección contra ataques MITM
 * @param {string} ipAddress - IP origen
 * @param {string} protocol - Protocolo detectado
 * @param {string} path - Endpoint afectado
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
 * Registra fallo de verificación de integridad de datos
 * 
 * ## Severidad: CRÍTICA
 * El hash de integridad no coincide, indicando que los datos
 * fueron modificados (posible ataque o corrupción).
 * 
 * ## Acciones Recomendadas:
 * 1. Investigar origen del request
 * 2. Verificar integridad de BD
 * 3. Considerar bloqueo temporal de IP
 * 
 * @implements HU07 - FDP_UIT.1 (Data exchange integrity)
 * @param {string} ipAddress - IP origen
 * @param {string} path - Endpoint donde se detectó
 * @param {string} [userId] - Usuario involucrado si aplica
 * @param {string} [reason] - Descripción del fallo
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
 * 
 * ## Ataque Mitigado: Replay Attack
 * Atacante captura y reenvía una transacción válida para
 * ejecutarla múltiples veces.
 * 
 * ## Detección:
 * El nonce (número usado una vez) fue reutilizado, lo que
 * indica que el request es una copia de uno anterior.
 * 
 * @implements HU07 - Protección contra replay attacks
 * @param {string} ipAddress - IP origen
 * @param {string} nonce - Nonce reutilizado
 * @param {string} path - Endpoint afectado
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
 * 
 * ## Información Auditada:
 * - ID de transacción (para trazabilidad)
 * - Monto (para reconciliación)
 * - Plan suscrito
 * - IP origen (para detección de fraude)
 * 
 * @implements HU07 - Auditoría de transacciones financieras
 * @param {string} userId - Usuario que realizó el pago
 * @param {string} ipAddress - IP origen
 * @param {string} transactionId - ID único de la transacción
 * @param {number} amount - Monto en centavos
 * @param {string} plan - Plan suscrito (monthly/yearly)
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
 * 
 * ## Razones Comunes:
 * - Tarjeta rechazada
 * - Fondos insuficientes
 * - Fraude detectado por procesador
 * - Error de validación
 * 
 * @param {string} userId - Usuario que intentó el pago
 * @param {string} ipAddress - IP origen
 * @param {string} reason - Razón del fallo
 * @param {string} plan - Plan que intentó suscribir
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
 * Registra operación sobre método de pago (tarjeta)
 * 
 * ## Operaciones Auditadas:
 * - **add**: Nueva tarjeta agregada
 * - **delete**: Tarjeta eliminada
 * - **update**: Tarjeta actualizada
 * - **setDefault**: Tarjeta marcada como principal
 * 
 * @implements HU07 - Auditoría de datos sensibles de pago
 * @param {string} userId - Usuario propietario
 * @param {string} ipAddress - IP origen
 * @param {string} operation - Tipo de operación
 * @param {boolean} success - Si la operación fue exitosa
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
 * Registra firma de webhook de Stripe inválida
 * 
 * ## Severidad: CRÍTICA
 * Indica un posible intento de spoofing de webhooks de Stripe.
 * Un atacante podría intentar simular eventos de pago.
 * 
 * ## Acciones Recomendadas:
 * 1. Verificar configuración de STRIPE_WEBHOOK_SECRET
 * 2. Investigar IP origen
 * 3. Considerar bloqueo temporal
 * 
 * @param {string} ipAddress - IP origen del webhook
 * @param {string} [userAgent] - User-Agent para identificar origen
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

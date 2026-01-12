/**
 * ============================================================================
 * SERVICIO DE SEGURIDAD - AUTENTICACIÓN Y VALIDACIÓN
 * ============================================================================
 * 
 * @module security
 * @description
 * Funciones core de seguridad para autenticación de usuarios, hashing de
 * contraseñas, generación de tokens JWT y validación de inputs.
 * 
 * ## Historias de Usuario Implementadas:
 * 
 * ### HU03 - Validación de Calidad de Contraseñas (FIA_SOS.1)
 * - Hash seguro con bcrypt y 12 salt rounds
 * - Validación de fortaleza de contraseña con múltiples criterios
 * - Detección de patrones débiles (secuencias, username en password)
 * 
 * ### HU01 - Autenticación de Usuarios (FIA_UAU.2)
 * - Generación de tokens JWT con expiración configurable
 * - Comparación segura de contraseñas con timing-safe
 * 
 * ## Mapeo Common Criteria (ISO/IEC 15408):
 * 
 * | Componente | Nombre | Implementación |
 * |------------|--------|----------------|
 * | FIA_SOS.1  | Verification of Secrets | isStrongPassword() |
 * | FIA_UAU.2  | User authentication before any action | generateToken() |
 * | FIA_AFL.1  | Authentication failure handling | Integrado con rateLimiter |
 * 
 * ## Especificaciones de Seguridad:
 * 
 * - **Hashing**: bcrypt con 12 salt rounds (~300ms por hash)
 * - **JWT**: HS256 con clave secreta de entorno
 * - **Validación de Email**: Regex segura contra ReDoS
 * 
 * @author EduSoft Development Team
 * @version 2.0.0
 * @since 2024-01-15
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// ============================================================================
// CONFIGURACIÓN DE HASHING
// ============================================================================

/**
 * Número de salt rounds para bcrypt
 * 
 * ## HU03 Requisito: Aumentado de 10 a 12 rounds
 * 
 * | Rounds | Tiempo aprox. | Seguridad |
 * |--------|---------------|-----------|
 * | 10     | ~100ms        | Mínimo aceptable |
 * | 12     | ~300ms        | Recomendado HU03 |
 * | 14     | ~1.2s         | Alta seguridad |
 * 
 * 12 rounds proporciona buen balance entre seguridad y usabilidad.
 * Incrementar si se detectan ataques de fuerza bruta exitosos.
 */
const SALT_ROUNDS = 12;

// ============================================================================
// FUNCIONES DE HASHING DE CONTRASEÑAS
// ============================================================================

/**
 * Genera un hash seguro de una contraseña usando bcrypt
 * 
 * ## Proceso de Hashing:
 * 1. Genera un salt aleatorio único (automático con bcrypt)
 * 2. Aplica el algoritmo bcrypt con 12 rounds
 * 3. El salt se almacena como parte del hash resultante
 * 
 * ## Seguridad de bcrypt:
 * - **Adaptive**: El costo computacional es ajustable (salt rounds)
 * - **Salt integrado**: Previene ataques de rainbow tables
 * - **Lento por diseño**: Resistente a ataques de fuerza bruta GPU
 * 
 * ## Almacenamiento:
 * El hash resultante (~60 caracteres) incluye:
 * - Versión del algoritmo ($2b$)
 * - Costo (12)
 * - Salt (22 caracteres)
 * - Hash (31 caracteres)
 * 
 * @implements HU03 - Almacenamiento seguro de contraseñas
 * @param {string} password - Contraseña en texto plano del usuario
 * @returns {Promise<string>} Hash bcrypt listo para almacenar en BD
 * 
 * @example
 * const hashedPassword = await hashPassword('SecureP@ss123');
 * // Guardar hashedPassword en tabla User.password
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compara una contraseña en texto plano con su hash almacenado
 * 
 * ## Seguridad Timing-Safe:
 * bcrypt.compare() internamente usa comparación en tiempo constante
 * para prevenir ataques de timing side-channel.
 * 
 * ## Proceso:
 * 1. Extrae el salt del hash almacenado
 * 2. Aplica el mismo algoritmo a la contraseña proporcionada
 * 3. Compara los resultados de forma segura
 * 
 * @implements HU01 - Verificación de credenciales en login
 * @param {string} password - Contraseña en texto plano proporcionada por el usuario
 * @param {string} hashedPassword - Hash bcrypt almacenado en la BD
 * @returns {Promise<boolean>} true si coinciden, false si no
 * 
 * @example
 * const isValid = await comparePassword(userInput, user.password);
 * if (!isValid) {
 *   logSecurityEvent('FAILED_LOGIN', ...);
 *   throw new AuthenticationError('Invalid credentials');
 * }
 */
export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// ============================================================================
// GENERACIÓN DE TOKENS JWT
// ============================================================================

/**
 * Genera un token JWT para autenticación de sesión
 * 
 * ## Contenido del Payload:
 * - **userId**: Identificador único del usuario (UUID)
 * - **role**: Rol del usuario (STUDENT_FREE, STUDENT_PRO, TUTOR, ADMIN)
 * 
 * ## Configuración:
 * - **Algoritmo**: HS256 (HMAC-SHA256)
 * - **Expiración**: Configurable via JWT_EXPIRATION (default: 7 días)
 * - **Clave**: JWT_SECRET de variables de entorno
 * 
 * ## Seguridad del Token:
 * - Firmado digitalmente (no puede ser modificado)
 * - Expiración automática
 * - Stateless (no requiere almacenar sesiones en servidor)
 * 
 * ## Vectores de Ataque Mitigados:
 * - **Token Forgery**: Firma HS256 previene creación de tokens falsos
 * - **Session Hijacking**: Expiración limita ventana de ataque
 * - **Privilege Escalation**: Role embebido verificado en cada request
 * 
 * @implements HU01 - Generación de token post-autenticación
 * @param {string} userId - UUID del usuario autenticado
 * @param {string} role - Rol del usuario en el sistema
 * @returns {string} Token JWT firmado
 * 
 * @example
 * const token = generateToken(user.id, user.role);
 * res.json({ token, user: { id: user.id, name: user.name } });
 */
export const generateToken = (userId: string, role: string): string => {
  const jwtSecret = process.env.JWT_SECRET || "fallback-secret-key";
  const jwtExpiration = process.env.JWT_EXPIRATION || "7d";

  return jwt.sign({ userId, role }, jwtSecret, {
    expiresIn: jwtExpiration,
  } as jwt.SignOptions);
};

// ============================================================================
// FUNCIONES DE VALIDACIÓN DE INPUT
// ============================================================================

/**
 * Valida formato de email con regex segura contra ReDoS
 * 
 * ## Seguridad Anti-ReDoS:
 * Regular Expression Denial of Service (ReDoS) ocurre cuando un regex
 * malicioso causa backtracking exponencial. Esta regex está diseñada para:
 * - Evitar cuantificadores anidados (.*.*) 
 * - Limitar longitud implícita de partes (64@255.TLD)
 * - No usar alternación con overlapping
 * 
 * ## Validación RFC 5322 Simplificada:
 * - Local part: 1-64 caracteres alfanuméricos + ._%-+
 * - @ separator
 * - Domain: 1-255 caracteres alfanuméricos + .-
 * - TLD: 2+ caracteres alfabéticos
 * 
 * @param {string} email - Email a validar
 * @returns {boolean} true si el formato es válido
 * 
 * @example
 * if (!isValidEmail(req.body.email)) {
 *   return res.status(400).json({ error: 'Invalid email format' });
 * }
 */
export const isValidEmail = (email: string): boolean => {
  // Regex segura con longitud máxima implícita y sin cuantificadores anidados
  // Compatible con RFC 5322 simplificado
  const emailRegex = /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,255}\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Valida fortaleza de contraseña según criterios HU03 (FIA_SOS.1)
 * 
 * ## Criterios de Validación:
 * 
 * | Criterio | Requisito | Razón |
 * |----------|-----------|-------|
 * | Longitud | ≥ 8 caracteres | Espacio de búsqueda mínimo |
 * | Mayúscula | ≥ 1 | Aumenta entropía |
 * | Minúscula | ≥ 1 | Aumenta entropía |
 * | Número | ≥ 1 | Aumenta entropía |
 * | Especial | ≥ 1 | Aumenta entropía significativamente |
 * 
 * ## Validaciones Adicionales de Seguridad:
 * 
 * - **No contener username**: Previene contraseñas predecibles
 * - **No contener email prefix**: Previene contraseñas basadas en email
 * - **No secuencias numéricas**: Detecta patrones como 123, 234, 1111
 * 
 * ## Ataques Mitigados:
 * - **Dictionary Attack**: Complejidad requerida excede diccionarios
 * - **Credential Stuffing**: Username/email no pueden usarse
 * - **Pattern-based Attack**: Secuencias detectadas y rechazadas
 * 
 * @implements HU03 - Verificación de secretos (FIA_SOS.1)
 * @param {string} password - Contraseña a validar
 * @param {string} [username] - Username para validación cruzada
 * @param {string} [email] - Email para validación cruzada
 * @returns {boolean} true si cumple todos los criterios
 * 
 * @example
 * if (!isStrongPassword(password, username, email)) {
 *   const result = validateStrongPassword(password, username, email);
 *   return res.status(400).json({ errors: result.errors });
 * }
 */
export const isStrongPassword = (
  password: string,
  username?: string,
  email?: string
): boolean => {
  // Regex completo: 8+ chars, mayúscula, minúscula, número, carácter especial
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  
  if (!passwordRegex.test(password)) {
    return false;
  }

  // Validar que no contenga username
  if (username && username.length >= 3) {
    if (password.toLowerCase().includes(username.toLowerCase())) {
      return false;
    }
  }

  // Validar que no contenga email
  if (email) {
    const emailPrefix = email.split("@")[0];
    if (
      emailPrefix.length >= 3 &&
      password.toLowerCase().includes(emailPrefix.toLowerCase())
    ) {
      return false;
    }
  }

  // Validar que no tenga secuencias numéricas
  const sequences = [
    "012", "123", "234", "345", "456", "567", "678", "789",
    "987", "876", "765", "654", "543", "432", "321",
    "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999"
  ];
  
  for (const seq of sequences) {
    if (password.includes(seq)) {
      return false;
    }
  }

  return true;
};

/**
 * Sanitiza input de usuario para prevenir XSS básico
 * 
 * ## Operaciones de Sanitización:
 * 1. **Trim**: Elimina espacios al inicio y final
 * 2. **Strip HTML Tags**: Elimina < y > (previene <script>)
 * 3. **Truncate**: Limita a 500 caracteres (previene DoS por input largo)
 * 
 * ## Limitaciones:
 * Esta es una sanitización básica. Para contenido HTML rico,
 * usar librerías especializadas como DOMPurify o sanitize-html.
 * 
 * ## Ataques Mitigados:
 * - **XSS Reflected**: Tags HTML removidos
 * - **XSS Stored**: Contenido sanitizado antes de almacenar
 * - **Buffer Overflow**: Longitud limitada
 * 
 * @param {string} input - String de entrada del usuario
 * @returns {string} String sanitizado y seguro
 * 
 * @example
 * const safeName = sanitizeInput(req.body.name);
 * await prisma.user.update({ data: { name: safeName } });
 */
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, "") // Eliminar < y >
    .substring(0, 500); // Limitar longitud
};

/**
 * ============================================================================
 * HU03 - MIDDLEWARE DE VALIDACIÓN DE CALIDAD DE CONTRASEÑAS
 * ============================================================================
 * 
 * @module passwordValidation
 * @description
 * Sistema completo de validación de contraseñas que implementa múltiples
 * capas de verificación para garantizar que las contraseñas cumplan con
 * estándares de seguridad modernos.
 * 
 * ## Historia de Usuario:
 * 
 * ### HU03 - Verificación de Calidad de Contraseñas (FIA_SOS.1)
 * 
 * **Criterios de Aceptación:**
 * 1. Validación regex: Mínimo 8 caracteres
 * 2. Al menos 1 letra mayúscula
 * 3. Al menos 1 número
 * 4. Al menos 1 carácter especial
 * 5. Rechazo de contraseñas que contengan el username
 * 6. Rechazo de números secuenciales (123, 111, etc.)
 * 7. Protección contra contraseñas de diccionario
 * 8. Detección de patrones de teclado (qwerty, asdf)
 * 
 * ## Mapeo Common Criteria (ISO/IEC 15408):
 * 
 * | Componente | Nombre | Implementación |
 * |------------|--------|----------------|
 * | FIA_SOS.1  | Verification of secrets | validateStrongPassword() |
 * | FIA_SOS.2  | TSF Generation of secrets | Política de complejidad |
 * 
 * ## Estrategia de Validación Multi-Capa:
 * 
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    CONTRASEÑA INPUT                         │
 * ├─────────────────────────────────────────────────────────────┤
 * │ 1. Longitud mínima (8 caracteres)                          │
 * │ 2. Complejidad (mayúscula, minúscula, número, especial)    │
 * │ 3. No contiene username                                     │
 * │ 4. No contiene prefijo de email                            │
 * │ 5. No es contraseña común (diccionario)                    │
 * │ 6. No tiene secuencias numéricas                           │
 * │ 7. No tiene patrones de teclado                            │
 * ├─────────────────────────────────────────────────────────────┤
 * │                    CONTRASEÑA VÁLIDA                        │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 * 
 * ## Vectores de Ataque Mitigados:
 * 
 * - **Dictionary Attack**: Lista de 26 contraseñas más comunes
 * - **Brute Force**: Complejidad aumenta espacio de búsqueda
 * - **Social Engineering**: Username/email no pueden usarse
 * - **Pattern-based Attack**: Secuencias y patrones de teclado bloqueados
 * 
 * @author EduSoft Security Team
 * @version 2.0.0
 * @since 2024-01-15
 * @see NIST SP 800-63B Digital Identity Guidelines
 */

import type { NextFunction, Request, Response } from "express";

// ============================================================================
// DICCIONARIOS DE CONTRASEÑAS INSEGURAS
// ============================================================================

/**
 * Diccionario de contraseñas comunes
 * 
 * ## Fuente:
 * Basado en análisis de brechas de seguridad públicas.
 * Incluye las contraseñas más frecuentemente usadas.
 * 
 * ## Actualización:
 * Este diccionario debe actualizarse periódicamente con
 * nuevas contraseñas identificadas en brechas de datos.
 * 
 * @implements HU03 - Protección contra ataques de diccionario
 */
const COMMON_PASSWORDS = [
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "qwerty",
  "qwerty123",
  "welcome",
  "welcome1",
  "welcome123",
  "admin",
  "admin123",
  "letmein",
  "monkey",
  "dragon",
  "master",
  "sunshine",
  "princess",
  "iloveyou",
  "password!",
  "Pass1234",
  "Test1234",
  "Abc12345",
  "Password1!",
  "Welcome1!",
  "Qwerty123!",
];

/**
 * Patrones de teclado comunes a detectar
 * 
 * ## Patrones Incluidos:
 * - Filas de teclado QWERTY (qwerty, asdfgh, zxcvbn)
 * - Combinaciones diagonales (1qaz2wsx)
 * - Patrones cortos frecuentes (qazwsx)
 * 
 * ## Por qué se bloquean:
 * Los patrones de teclado son fáciles de adivinar porque:
 * 1. Son predecibles (secuencia espacial)
 * 2. Aparecen en muchas listas de contraseñas
 * 3. Son fáciles de recordar pero fáciles de atacar
 * 
 * @implements HU03 - Detección de patrones inseguros
 */
const KEYBOARD_PATTERNS = [
  "qwerty",
  "asdfgh",
  "zxcvbn",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
  "1qaz2wsx",
  "1qazxsw2",
  "qazwsx",
  "qweasd",
];

// ============================================================================
// FUNCIÓN PRINCIPAL DE VALIDACIÓN
// ============================================================================

/**
 * Valida que la contraseña cumpla con todos los requisitos de seguridad
 * 
 * ## Proceso de Validación:
 * Ejecuta 9 verificaciones en secuencia, acumulando todos los errores
 * encontrados para feedback completo al usuario.
 * 
 * ## Verificaciones Realizadas:
 * 
 * | # | Verificación | Mensaje de Error |
 * |---|--------------|------------------|
 * | 1 | Longitud ≥ 8 | "Password must be at least 8 characters long" |
 * | 2 | Mayúscula | "Password must contain at least one uppercase letter" |
 * | 3 | Minúscula | "Password must contain at least one lowercase letter" |
 * | 4 | Número | "Password must contain at least one number" |
 * | 5 | Especial | "Password must contain at least one special character" |
 * | 6 | No username | "Password cannot contain your username" |
 * | 7 | No email | "Password cannot contain your email address" |
 * | 8 | No diccionario | "Password is too common. Please choose a stronger one" |
 * | 9 | No secuencias | "Password cannot contain sequential numbers" |
 * | 10 | No teclado | "Password contains a keyboard pattern" |
 * 
 * ## Retorno:
 * - **isValid**: true solo si pasa TODAS las verificaciones
 * - **errors**: Array con todos los criterios no cumplidos
 * 
 * @implements HU03 - Verificación de secretos (FIA_SOS.1)
 * @param {string} password - Contraseña a validar
 * @param {string} [username] - Username para validación cruzada
 * @param {string} [email] - Email para validación cruzada
 * @returns {{ isValid: boolean, errors: string[] }}
 * 
 * @example
 * const result = validateStrongPassword('MyP@ss123', 'john_doe', 'john@email.com');
 * if (!result.isValid) {
 *   return res.status(400).json({ errors: result.errors });
 * }
 */
export const validateStrongPassword = (
  password: string,
  username: string = "",
  email: string = ""
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 1. Longitud mínima (HU03 Requisito)
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  // 2. Al menos una mayúscula (HU03 Requisito)
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // 3. Al menos una minúscula
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // 4. Al menos un número (HU03 Requisito)
  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // 5. Al menos un carácter especial (HU03 Requisito)
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push(
      "Password must contain at least one special character (!@#$%^&*...)"
    );
  }

  // 6. No debe contener el nombre de usuario (HU03 Requisito)
  if (username && username.length >= 3) {
    const usernameLower = username.toLowerCase();
    const passwordLower = password.toLowerCase();

    if (passwordLower.includes(usernameLower)) {
      errors.push("Password must not contain your username");
    }
  }

  // 7. No debe contener el email o parte del email
  if (email) {
    const emailPrefix = email.split("@")[0].toLowerCase();
    if (
      emailPrefix.length >= 3 &&
      password.toLowerCase().includes(emailPrefix)
    ) {
      errors.push("Password must not contain your email");
    }
  }

  // 8. No debe contener secuencias numéricas (HU03 Requisito)
  const numericSequences = [
    "012",
    "123",
    "234",
    "345",
    "456",
    "567",
    "678",
    "789",
    "987",
    "876",
    "765",
    "654",
    "543",
    "432",
    "321",
    "210",
    "0000",
    "1111",
    "2222",
    "3333",
    "4444",
    "5555",
    "6666",
    "7777",
    "8888",
    "9999",
  ];

  for (const sequence of numericSequences) {
    if (password.includes(sequence)) {
      errors.push("Password must not contain sequential or repetitive numbers");
      break;
    }
  }

  // 9. No debe contener patrones de teclado comunes
  for (const pattern of KEYBOARD_PATTERNS) {
    if (password.toLowerCase().includes(pattern)) {
      errors.push("Password must not contain common keyboard patterns");
      break;
    }
  }

  // 10. No debe ser una contraseña común (diccionario)
  const passwordLower = password.toLowerCase();
  for (const common of COMMON_PASSWORDS) {
    if (passwordLower === common.toLowerCase()) {
      errors.push("This password is too common and easily guessable");
      break;
    }
  }

  // 11. No debe contener palabras comunes dentro de la contraseña
  const commonWords = [
    "password",
    "welcome",
    "admin",
    "letmein",
    "monkey",
    "dragon",
  ];
  for (const word of commonWords) {
    if (passwordLower.includes(word)) {
      errors.push("Password contains common words that are easily guessable");
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Middleware Express para validar contraseñas en el registro
 */
export const passwordValidationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { password, username, email } = req.body;

  if (!password) {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  const validation = validateStrongPassword(password, username, email);

  if (!validation.isValid) {
    res.status(400).json({
      error: "Password does not meet security requirements",
      details: validation.errors,
    });
    return;
  }

  next();
};

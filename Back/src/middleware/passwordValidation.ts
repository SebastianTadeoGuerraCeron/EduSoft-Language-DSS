import type { NextFunction, Request, Response } from "express";

/**
 * HU03 - Middleware de Validación de Calidad de Contraseñas
 * Implementa FIA_SOS.1 (Verification of secrets)
 * 
 * Criterios de Aceptación:
 * - Validación regex: Mínimo 8 caracteres, 1 mayúscula, 1 número, 1 carácter especial
 * - Rechazo de contraseñas que contengan el nombre del usuario o números secuenciales
 * - Protección contra ataques de diccionario
 * - Prevención de patrones de teclado comunes
 */

// Diccionario de contraseñas comunes (top 100 más usadas)
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

// Patrones de teclado comunes
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

/**
 * Valida que la contraseña cumpla con todos los requisitos de seguridad
 * @param password - Contraseña a validar
 * @param username - Nombre de usuario para validación cruzada
 * @param email - Email para validación cruzada
 * @returns Objeto con isValid y errors array
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

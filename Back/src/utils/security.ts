import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// HU03: Aumentado de 10 a 12 rounds para mayor seguridad
const SALT_ROUNDS = 12;

/**
 * Hash de contraseña usando bcrypt
 * @param password - Contraseña en texto plano
 * @returns Contraseña hasheada
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Comparar contraseña en texto plano con hash
 * @param password - Contraseña en texto plano
 * @param hashedPassword - Contraseña hasheada
 * @returns true si coinciden, false si no
 */
export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

/**
 * Generar token JWT
 * @param userId - ID del usuario
 * @param role - Rol del usuario
 * @returns Token JWT
 */
export const generateToken = (userId: string, role: string): string => {
  const jwtSecret = process.env.JWT_SECRET || "fallback-secret-key";
  const jwtExpiration = process.env.JWT_EXPIRATION || "7d";

  return jwt.sign({ userId, role }, jwtSecret, {
    expiresIn: jwtExpiration,
  } as jwt.SignOptions);
};

/**
 * Validar formato de email
 * Regex optimizada para prevenir ReDoS (Regular expression Denial of Service)
 * @param email - Email a validar
 * @returns true si es válido, false si no
 */
export const isValidEmail = (email: string): boolean => {
  // Regex segura con longitud máxima implícita y sin cuantificadores anidados
  // Compatible con RFC 5322 simplificado
  const emailRegex = /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,255}\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Validar fortaleza de contraseña (HU03 - FIA_SOS.1)
 * Debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial
 * @param password - Contraseña a validar
 * @param username - Nombre de usuario para validación cruzada
 * @param email - Email para validación cruzada
 * @returns true si es fuerte, false si no
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
 * Sanitizar string para prevenir XSS básico
 * @param input - String a sanitizar
 * @returns String sanitizado
 */
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, "") // Eliminar < y >
    .substring(0, 500); // Limitar longitud
};

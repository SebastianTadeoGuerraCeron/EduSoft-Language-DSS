import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 10;

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
 * @param email - Email a validar
 * @returns true si es válido, false si no
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validar fortaleza de contraseña
 * Debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número
 * @param password - Contraseña a validar
 * @returns true si es fuerte, false si no
 */
export const isStrongPassword = (password: string): boolean => {
  // Al menos 8 caracteres, una mayúscula, una minúscula, un número
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
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

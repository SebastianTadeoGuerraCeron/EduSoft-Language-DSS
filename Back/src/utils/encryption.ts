/**
 * Servicio de Encriptación AES-256-GCM
 * 
 * Cumple con:
 * - HU07: Protección de Datos de Pagos (Integridad con authTag)
 * - HU08: Cifrado de Datos en Reposo (AES-256)
 * 
 * Características:
 * - AES-256-GCM (Galois/Counter Mode) - Encriptación autenticada
 * - IV único por cada operación de encriptación
 * - AuthTag para verificar integridad de datos
 * - Clave de encriptación separada de la BD
 */

import crypto from "crypto";

// Algoritmo de encriptación
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits para GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Obtiene la clave de encriptación desde las variables de entorno
 * La clave debe ser de 32 bytes (256 bits) en formato hexadecimal
 */
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error("ENCRYPTION_KEY not found in environment variables");
  }
  
  // La clave debe ser de 64 caracteres hexadecimales (32 bytes)
  if (key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hexadecimal characters (256 bits)");
  }
  
  return Buffer.from(key, "hex");
};

/**
 * Genera un vector de inicialización (IV) único
 * Crítico: Nunca reutilizar el IV con la misma clave
 */
export const generateIV = (): Buffer => {
  return crypto.randomBytes(IV_LENGTH);
};

/**
 * Encripta datos usando AES-256-GCM
 * 
 * @param plaintext - Texto a encriptar
 * @returns Objeto con datos encriptados, IV y authTag
 */
export const encrypt = (plaintext: string): {
  encryptedData: string;
  iv: string;
  authTag: string;
} => {
  const key = getEncryptionKey();
  const iv = generateIV();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
};

/**
 * Desencripta datos usando AES-256-GCM
 * 
 * @param encryptedData - Datos encriptados en base64
 * @param ivBase64 - Vector de inicialización en base64
 * @param authTagBase64 - Tag de autenticación en base64
 * @returns Texto desencriptado
 */
export const decrypt = (
  encryptedData: string,
  ivBase64: string,
  authTagBase64: string
): string => {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
};

/**
 * Genera un hash SHA-256 para verificar integridad de datos
 * Cumple con HU07: Integridad de datos verificada mediante hash
 * 
 * @param data - Datos para generar hash
 * @returns Hash SHA-256 en formato hexadecimal
 */
export const generateIntegrityHash = (data: string): string => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

/**
 * Verifica que el hash de integridad sea correcto
 * 
 * @param data - Datos originales
 * @param hash - Hash a verificar
 * @returns true si el hash es válido
 */
export const verifyIntegrityHash = (data: string, hash: string): boolean => {
  const computedHash = generateIntegrityHash(data);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, "hex"),
    Buffer.from(hash, "hex")
  );
};

/**
 * Encripta información de tarjeta de crédito
 * 
 * @param cardData - Datos de la tarjeta
 * @returns Datos encriptados listos para almacenar
 */
export const encryptCardData = (cardData: {
  cardNumber: string;
  cvv: string;
  expiry: string;
  cardholderName: string;
}): {
  encryptedCardNumber: string;
  encryptedCVV: string;
  encryptedExpiry: string;
  cardholderName: string;
  lastFourDigits: string;
  cardBrand: string;
  iv: string;
  authTag: string;
  integrityHash: string;
} => {
  // Generar un IV único para esta operación
  const iv = generateIV();
  const key = getEncryptionKey();
  
  // Función helper para encriptar con el mismo IV
  const encryptWithIV = (plaintext: string): { encrypted: string; authTag: string } => {
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");
    return {
      encrypted,
      authTag: cipher.getAuthTag().toString("base64"),
    };
  };
  
  // Encriptar cada campo sensible
  const encryptedCard = encryptWithIV(cardData.cardNumber);
  const encryptedCVV = encryptWithIV(cardData.cvv);
  const encryptedExpiry = encryptWithIV(cardData.expiry);
  
  // Detectar marca de la tarjeta
  const cardBrand = detectCardBrand(cardData.cardNumber);
  
  // Últimos 4 dígitos (para mostrar al usuario)
  const lastFourDigits = cardData.cardNumber.slice(-4);
  
  // Generar hash de integridad de todos los datos encriptados
  const dataToHash = `${encryptedCard.encrypted}|${encryptedCVV.encrypted}|${encryptedExpiry.encrypted}`;
  const integrityHash = generateIntegrityHash(dataToHash);
  
  return {
    encryptedCardNumber: encryptedCard.encrypted,
    encryptedCVV: encryptedCVV.encrypted,
    encryptedExpiry: encryptedExpiry.encrypted,
    cardholderName: cardData.cardholderName,
    lastFourDigits,
    cardBrand,
    iv: iv.toString("base64"),
    authTag: encryptedCard.authTag, // Usamos el authTag del número de tarjeta como principal
    integrityHash,
  };
};

/**
 * Desencripta información de tarjeta de crédito
 * 
 * @param encryptedData - Datos encriptados de la BD
 * @returns Datos de tarjeta desencriptados
 */
export const decryptCardData = (encryptedData: {
  encryptedCardNumber: string;
  encryptedCVV: string;
  encryptedExpiry: string;
  iv: string;
  authTag: string;
  integrityHash: string;
}): {
  cardNumber: string;
  cvv: string;
  expiry: string;
} => {
  // Verificar integridad antes de desencriptar
  const dataToHash = `${encryptedData.encryptedCardNumber}|${encryptedData.encryptedCVV}|${encryptedData.encryptedExpiry}`;
  
  if (!verifyIntegrityHash(dataToHash, encryptedData.integrityHash)) {
    throw new Error("Data integrity verification failed - data may have been tampered");
  }
  
  // Desencriptar cada campo
  return {
    cardNumber: decrypt(encryptedData.encryptedCardNumber, encryptedData.iv, encryptedData.authTag),
    cvv: decrypt(encryptedData.encryptedCVV, encryptedData.iv, encryptedData.authTag),
    expiry: decrypt(encryptedData.encryptedExpiry, encryptedData.iv, encryptedData.authTag),
  };
};

/**
 * Detecta la marca de la tarjeta basándose en el número
 */
export const detectCardBrand = (cardNumber: string): string => {
  const cleanNumber = cardNumber.replace(/\s|-/g, "");
  
  if (/^4/.test(cleanNumber)) return "VISA";
  if (/^5[1-5]/.test(cleanNumber)) return "MASTERCARD";
  if (/^3[47]/.test(cleanNumber)) return "AMEX";
  if (/^6(?:011|5)/.test(cleanNumber)) return "DISCOVER";
  if (/^(?:2131|1800|35)/.test(cleanNumber)) return "JCB";
  if (/^3(?:0[0-5]|[68])/.test(cleanNumber)) return "DINERS";
  
  return "UNKNOWN";
};

/**
 * Valida el formato de un número de tarjeta usando el algoritmo de Luhn
 */
export const validateCardNumber = (cardNumber: string): boolean => {
  const cleanNumber = cardNumber.replace(/\s|-/g, "");
  
  if (!/^\d{13,19}$/.test(cleanNumber)) return false;
  
  // Algoritmo de Luhn
  let sum = 0;
  let isEven = false;
  
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

/**
 * Genera una clave de encriptación segura (usar solo una vez para generar ENCRYPTION_KEY)
 */
export const generateEncryptionKey = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Genera un ID de transacción único
 */
export const generateTransactionId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(8).toString("hex");
  return `TXN-${timestamp}-${randomPart}`.toUpperCase();
};

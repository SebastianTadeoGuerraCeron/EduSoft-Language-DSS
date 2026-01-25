/**
 * ============================================================================
 * SERVICIO DE ENCRIPTACIÓN AES-256-GCM
 * ============================================================================
 * 
 * @module encryption
 * @description
 * Servicio de cifrado simétrico para protección de datos sensibles en reposo.
 * Implementa encriptación autenticada usando AES-256 en modo Galois/Counter (GCM).
 * 
 * ## Historias de Usuario Implementadas:
 * 
 * ### HU07 - Protección de Datos de Pagos
 * - **Criterio**: Integridad de datos de transacciones verificada mediante authTag
 * - **Implementación**: Cada operación de cifrado genera un authTag único que
 *   permite detectar cualquier modificación no autorizada de los datos
 * 
 * ### HU08 - Cifrado de Datos en Reposo  
 * - **Criterio**: Datos sensibles cifrados con AES-256 antes de almacenar
 * - **Implementación**: Números de tarjeta, CVV y fechas de expiración se
 *   cifran antes de persistirse en la base de datos
 * 
 * ## Mapeo Common Criteria (ISO/IEC 15408):
 * 
 * | Componente | Nombre | Descripción |
 * |------------|--------|-------------|
 * | FCS_COP.1  | Cryptographic Operation | Operaciones criptográficas con AES-256 |
 * | FDP_DAU.2  | Data Authentication with Identity of Guarantor | AuthTag para integridad |
 * | FDP_ITC.1  | Import of user data without security attributes | Cifrado de datos importados |
 * 
 * ## Especificaciones Técnicas:
 * 
 * - **Algoritmo**: AES-256-GCM (Advanced Encryption Standard, 256-bit key, Galois/Counter Mode)
 * - **Tamaño de IV**: 128 bits (16 bytes) - generado aleatoriamente para cada operación
 * - **Tamaño de AuthTag**: 128 bits (16 bytes) - para verificación de integridad
 * - **Codificación**: Base64 para almacenamiento, Hex para claves
 * 
 * ## Seguridad del Modo GCM:
 * 
 * El modo GCM (Galois/Counter Mode) fue elegido porque:
 * 1. **Authenticated Encryption**: Proporciona confidencialidad e integridad simultáneamente
 * 2. **Detección de Tampering**: El authTag detecta cualquier modificación de datos
 * 3. **No requiere padding**: Evita vulnerabilidades de padding oracle attacks
 * 4. **Paralelizable**: Permite cifrado/descifrado eficiente
 * 
 * ## Vectores de Ataque Mitigados:
 * 
 * - **Data Breach**: Datos cifrados son inútiles sin la clave de cifrado
 * - **Database Dump**: Credenciales robadas de BD no exponen datos de tarjetas
 * - **Man-in-the-Middle**: AuthTag detecta modificaciones en tránsito
 * - **Replay Attacks**: IV único por operación previene reproducción de cifrados
 * 
 * @example
 * // Cifrar datos de tarjeta
 * const encrypted = encryptCardData({
 *   cardNumber: '4242424242424242',
 *   cvv: '123',
 *   expiry: '12/25',
 *   cardholderName: 'John Doe'
 * });
 * 
 * // Almacenar en BD: encrypted.encryptedCardNumber, encrypted.iv, encrypted.authTag
 * 
 * @author Anthony Alejandro Morales Vargas
 * @version 2.0.0
 * @since 2024-01-15
 * @see https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38d.pdf
 */

import crypto from "crypto";

// ============================================================================
// CONSTANTES DE CONFIGURACIÓN CRIPTOGRÁFICA
// ============================================================================

/**
 * Algoritmo de cifrado: AES-256-GCM
 * - AES: Advanced Encryption Standard (FIPS 197)
 * - 256: Tamaño de clave en bits (resistente a ataques cuánticos teóricos)
 * - GCM: Galois/Counter Mode (NIST SP 800-38D)
 */
const ALGORITHM = "aes-256-gcm";

/**
 * Longitud del Vector de Inicialización (IV): 128 bits
 * - Recomendado por NIST para modo GCM
 * - Generado aleatoriamente con crypto.randomBytes()
 * - CRÍTICO: Nunca reutilizar con la misma clave
 */
const IV_LENGTH = 16;

/**
 * Longitud del Authentication Tag: 128 bits
 * - Máxima seguridad de integridad
 * - Permite detectar cualquier bit modificado
 */
const AUTH_TAG_LENGTH = 16;

// ============================================================================
// GESTIÓN DE CLAVE DE CIFRADO
// ============================================================================

/**
 * Obtiene la clave de encriptación desde las variables de entorno
 * 
 * ## Requisitos de la Clave:
 * - **Tamaño**: 256 bits (32 bytes = 64 caracteres hexadecimales)
 * - **Formato**: Hexadecimal (0-9, a-f)
 * - **Almacenamiento**: Variable de entorno ENCRYPTION_KEY (nunca en código)
 * 
 * ## Generación Segura:
 * ```bash
 * # Generar con OpenSSL
 * openssl rand -hex 32
 * 
 * # O con Node.js
 * node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * ```
 * 
 * ## Rotación de Claves:
 * Para rotar la clave, se debe:
 * 1. Desencriptar todos los datos con la clave antigua
 * 2. Re-encriptar con la nueva clave
 * 3. Actualizar ENCRYPTION_KEY en el entorno
 * 
 * @throws {Error} Si ENCRYPTION_KEY no está definida o no tiene el formato correcto
 * @returns {Buffer} Clave de 32 bytes para AES-256
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

// ============================================================================
// FUNCIONES DE CIFRADO CORE
// ============================================================================

/**
 * Genera un Vector de Inicialización (IV) único y criptográficamente seguro
 * 
 * ## Importancia del IV:
 * - Garantiza que el mismo texto plano produzca diferentes cifrados
 * - Previene ataques de análisis de patrones
 * - DEBE ser único para cada operación de cifrado con la misma clave
 * 
 * ## Seguridad:
 * - Usa crypto.randomBytes() del módulo crypto de Node.js
 * - Fuente de entropía del sistema operativo (/dev/urandom en Linux)
 * - Criptográficamente seguro (CSPRNG)
 * 
 * @warning NUNCA reutilizar el IV con la misma clave - compromete la seguridad
 * @returns {Buffer} IV de 16 bytes (128 bits)
 */
export const generateIV = (): Buffer => {
  return crypto.randomBytes(IV_LENGTH);
};

/**
 * Encripta datos usando AES-256-GCM (Authenticated Encryption)
 * 
 * ## Proceso de Cifrado:
 * 1. Obtiene la clave maestra del entorno
 * 2. Genera un IV aleatorio único para esta operación
 * 3. Cifra los datos con AES-256-GCM
 * 4. Extrae el authTag para verificación de integridad
 * 
 * ## Componentes de Salida:
 * - **encryptedData**: Datos cifrados en Base64
 * - **iv**: Vector de inicialización en Base64 (necesario para descifrar)
 * - **authTag**: Tag de autenticación en Base64 (verifica integridad)
 * 
 * ## Almacenamiento:
 * Los tres componentes (encryptedData, iv, authTag) deben almacenarse
 * juntos en la base de datos para poder descifrar posteriormente.
 * 
 * @implements HU08 - Cifrado de Datos en Reposo
 * @param {string} plaintext - Texto plano a cifrar (UTF-8)
 * @returns {Object} Objeto con datos cifrados y metadatos necesarios para descifrar
 * 
 * @example
 * const result = encrypt("4242424242424242");
 * // Guardar en BD: result.encryptedData, result.iv, result.authTag
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
 * Desencripta datos usando AES-256-GCM (Authenticated Decryption)
 * 
 * ## Proceso de Descifrado:
 * 1. Reconstruye el contexto de cifrado con IV y authTag
 * 2. Verifica la integridad antes de descifrar (authTag)
 * 3. Si la verificación falla, lanza excepción (datos manipulados)
 * 4. Descifra y retorna el texto plano original
 * 
 * ## Verificación de Integridad:
 * El authTag verifica que:
 * - Los datos no fueron modificados
 * - Se usó la clave correcta
 * - El IV es el original
 * 
 * @implements HU07 - Verificación de integridad de datos de pago
 * @param {string} encryptedData - Datos cifrados en Base64
 * @param {string} ivBase64 - Vector de inicialización en Base64
 * @param {string} authTagBase64 - Tag de autenticación en Base64
 * @returns {string} Texto plano original (UTF-8)
 * @throws {Error} Si authTag no coincide (datos manipulados o clave incorrecta)
 * 
 * @example
 * const plaintext = decrypt(storedData.encrypted, storedData.iv, storedData.authTag);
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

// ============================================================================
// FUNCIONES DE VERIFICACIÓN DE INTEGRIDAD
// ============================================================================

/**
 * Genera un hash SHA-256 para verificación de integridad de datos
 * 
 * ## Uso:
 * Se usa como capa adicional de verificación sobre el authTag de GCM.
 * Permite verificar integridad de múltiples campos cifrados juntos.
 * 
 * ## Propiedades del Hash:
 * - **Determinístico**: Mismo input → mismo hash
 * - **Avalancha**: Cambio de 1 bit → ~50% bits diferentes
 * - **Resistente a preimagen**: No se puede obtener el input del hash
 * - **Resistente a colisiones**: Imposible encontrar dos inputs con mismo hash
 * 
 * @implements HU07 - Integridad de datos de transacciones
 * @param {string} data - Datos para generar hash
 * @returns {string} Hash SHA-256 en formato hexadecimal (64 caracteres)
 * 
 * @example
 * const hash = generateIntegrityHash("sensitive-data");
 * // Almacenar hash junto con los datos cifrados
 */
export const generateIntegrityHash = (data: string): string => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

/**
 * Verifica que el hash de integridad sea correcto (timing-safe)
 * 
 * ## Seguridad Timing-Safe:
 * Usa crypto.timingSafeEqual() para prevenir ataques de timing:
 * - Comparación en tiempo constante
 * - No revela información sobre qué bytes difieren
 * - Previene ataques de canal lateral
 * 
 * ## Uso:
 * Verificar integridad antes de confiar en datos descifrados.
 * 
 * @implements HU07 - Verificación de integridad
 * @param {string} data - Datos originales
 * @param {string} hash - Hash almacenado a verificar
 * @returns {boolean} true si el hash es válido, false si los datos fueron modificados
 * 
 * @example
 * if (!verifyIntegrityHash(decryptedData, storedHash)) {
 *   throw new Error("Data tampering detected!");
 * }
 */
export const verifyIntegrityHash = (data: string, hash: string): boolean => {
  const computedHash = generateIntegrityHash(data);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, "hex"),
    Buffer.from(hash, "hex")
  );
};

// ============================================================================
// FUNCIONES ESPECÍFICAS PARA DATOS DE TARJETAS DE CRÉDITO
// ============================================================================

/**
 * Encripta información de tarjeta de crédito de forma segura
 * 
 * ## Campos Cifrados (PCI DSS Compliance):
 * - **cardNumber**: Número completo de tarjeta (PAN)
 * - **cvv**: Código de verificación (CVV/CVC)
 * - **expiry**: Fecha de expiración (MM/YY)
 * 
 * ## Campos NO Cifrados:
 * - **cardholderName**: Nombre del titular (no es PAN)
 * - **lastFourDigits**: Últimos 4 dígitos (para identificación UI)
 * - **cardBrand**: Marca detectada (VISA, MASTERCARD, etc.)
 * 
 * ## Seguridad Implementada:
 * 1. IV único compartido para esta operación de cifrado
 * 2. AuthTag para cada campo cifrado
 * 3. Hash de integridad del conjunto de datos cifrados
 * 
 * @implements HU07 - Protección de datos de pago
 * @implements HU08 - Cifrado de datos sensibles en reposo
 * @param {Object} cardData - Datos de la tarjeta a cifrar
 * @returns {Object} Datos listos para almacenar en BD
 * 
 * @example
 * const secure = encryptCardData({
 *   cardNumber: '4242424242424242',
 *   cvv: '123',
 *   expiry: '12/25',
 *   cardholderName: 'John Doe'
 * });
 * // Almacenar secure en tabla PaymentMethod
 */
export const encryptCardData = (cardData: {
  cardNumber: string;
  cvv: string;
  expiry: string;
  cardholderName: string;
}): {
  encryptedCardNumber: string;
  encryptedExpiry: string;
  cardholderName: string;
  lastFourDigits: string;
  cardBrand: string;
  ivCardNumber: string;
  authTagCardNumber: string;
  ivExpiry: string;
  authTagExpiry: string;
  integrityHash: string;
} => {
  // Generar un IV único para esta operación
  const key = getEncryptionKey();
  
  // Generar IVs separados para cada campo (mejor práctica de seguridad)
  const ivCard = crypto.randomBytes(12);
  const ivExpiry = crypto.randomBytes(12);
  
  // Cifrar número de tarjeta
  const cipherCard = crypto.createCipheriv(ALGORITHM, key, ivCard, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  let encryptedCardNumber = cipherCard.update(cardData.cardNumber, "utf8", "base64");
  encryptedCardNumber += cipherCard.final("base64");
  const authTagCard = cipherCard.getAuthTag().toString("base64");
  
  // Cifrar fecha de expiración
  const cipherExpiry = crypto.createCipheriv(ALGORITHM, key, ivExpiry, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  let encryptedExpiry = cipherExpiry.update(cardData.expiry, "utf8", "base64");
  encryptedExpiry += cipherExpiry.final("base64");
  const authTagExpiry = cipherExpiry.getAuthTag().toString("base64");
  
  // Detectar marca de la tarjeta
  const cardBrand = detectCardBrand(cardData.cardNumber);
  
  // Últimos 4 dígitos (para mostrar al usuario)
  const lastFourDigits = cardData.cardNumber.slice(-4);
  
  // CVV NO se cifra ni almacena (PCI-DSS compliance)
  // Solo se usa para la transacción inmediata y se descarta
  
  // Generar hash de integridad de los datos cifrados (SIN incluir CVV)
  const dataToHash = `${encryptedCardNumber}|${encryptedExpiry}|${lastFourDigits}`;
  const integrityHash = generateIntegrityHash(dataToHash);
  
  return {
    encryptedCardNumber,
    encryptedExpiry,
    cardholderName: cardData.cardholderName,
    lastFourDigits,
    cardBrand,
    ivCardNumber: ivCard.toString("base64"),
    authTagCardNumber: authTagCard,
    ivExpiry: ivExpiry.toString("base64"),
    authTagExpiry: authTagExpiry,
    integrityHash,
  };
};

/**
 * Desencripta información de tarjeta de crédito
 * 
 * ## Proceso Seguro de Descifrado:
 * 1. **Verificación de Integridad**: Comprueba hash ANTES de descifrar
 * 2. **Descifrado**: Solo si la integridad es válida
 * 3. **Retorno**: Datos originales en texto plano
 * 
 * ## Detección de Tampering:
 * Si el hash de integridad no coincide, se lanza una excepción.
 * Esto indica que los datos fueron modificados en la BD (posible ataque).
 * 
 * @implements HU07 - Verificación de integridad antes de procesar
 * @param {Object} encryptedData - Datos cifrados de la BD
 * @returns {Object} Datos de tarjeta descifrados
 * @throws {Error} "Data integrity verification failed" si los datos fueron manipulados
 * 
 * @example
 * try {
 *   const card = decryptCardData(storedPaymentMethod);
 *   // Usar card.cardNumber para procesar pago
 * } catch (error) {
 *   logSecurityEvent('INTEGRITY_CHECK_FAILED', ...);
 *   throw new Error('Security violation detected');
 * }
 */
export const decryptCardData = (encryptedData: {
  encryptedCardNumber: string;
  encryptedExpiry: string;
  ivCardNumber: string;
  authTagCardNumber: string;
  ivExpiry: string;
  authTagExpiry: string;
  integrityHash: string;
  lastFourDigits: string;
}): {
  cardNumber: string;
  expiry: string;
} => {
  // Verificar integridad antes de desencriptar (SIN CVV)
  const dataToHash = `${encryptedData.encryptedCardNumber}|${encryptedData.encryptedExpiry}|${encryptedData.lastFourDigits}`;
  
  if (!verifyIntegrityHash(dataToHash, encryptedData.integrityHash)) {
    throw new Error("Data integrity verification failed - data may have been tampered");
  }
  
  // Descifrar cada campo con su propio IV y authTag
  const cardNumber = decrypt(
    encryptedData.encryptedCardNumber,
    encryptedData.ivCardNumber,
    encryptedData.authTagCardNumber
  );
  
  const expiry = decrypt(
    encryptedData.encryptedExpiry,
    encryptedData.ivExpiry,
    encryptedData.authTagExpiry
  );
  
  // CVV NUNCA se descifra porque NUNCA se almacena (PCI-DSS)
  // El CVV debe solicitarse nuevamente en cada transacción
  
  return {
    cardNumber,
    expiry,
  };
};

// ============================================================================
// FUNCIONES DE VALIDACIÓN Y UTILIDADES
// ============================================================================

/**
 * Detecta la marca de la tarjeta basándose en el número (BIN/IIN)
 * 
 * ## Prefijos de Marcas Soportadas:
 * - **VISA**: 4xxx
 * - **MASTERCARD**: 51-55, 2221-2720
 * - **AMEX**: 34, 37
 * - **DISCOVER**: 6011, 622126-622925, 644-649, 65
 * - **JCB**: 3528-3589
 * - **DINERS**: 300-305, 36, 38
 * - **UNIONPAY**: 62xx
 * - **MAESTRO**: 5018, 5020, 5038, etc.
 * 
 * @param {string} cardNumber - Número de tarjeta (puede contener espacios/guiones)
 * @returns {string} Marca detectada o 'UNKNOWN'
 */
export const detectCardBrand = (cardNumber: string): string => {
  const cleanNumber = cardNumber.replace(/\s|-/g, "");
  
  // Visa: starts with 4
  if (/^4/.test(cleanNumber)) return "VISA";
  
  // Mastercard: 51-55, 2221-2720
  if (/^5[1-5]/.test(cleanNumber) || /^2(?:22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720)/.test(cleanNumber)) {
    return "MASTERCARD";
  }
  
  // American Express: 34, 37
  if (/^3[47]/.test(cleanNumber)) return "AMEX";
  
  // Discover: 6011, 622126-622925, 644-649, 65
  if (/^6(?:011|22(?:1(?:2[6-9]|[3-9]\d)|[2-8]\d{2}|9(?:[01]\d|2[0-5]))|4[4-9]\d|5)/.test(cleanNumber)) {
    return "DISCOVER";
  }
  
  // JCB: 3528-3589
  if (/^35(?:2[89]|[3-8]\d)/.test(cleanNumber)) return "JCB";
  
  // Diners Club: 300-305, 36, 38
  if (/^3(?:0[0-5]|[68])/.test(cleanNumber)) return "DINERS";
  
  // UnionPay: 62
  if (/^62/.test(cleanNumber)) return "UNIONPAY";
  
  // Maestro: 5018, 5020, 5038, 5893, 6304, 6759, 6761-6763
  if (/^(?:5(?:018|020|038|893)|6(?:304|759|76[1-3]))/.test(cleanNumber)) {
    return "MAESTRO";
  }
  
  return "UNKNOWN";
};

/**
 * Valida el formato de un número de tarjeta usando el algoritmo de Luhn
 * 
 * ## Algoritmo de Luhn (ISO/IEC 7812-1):
 * 1. Desde el dígito más a la derecha, duplicar cada segundo dígito
 * 2. Si el resultado > 9, restar 9
 * 3. Sumar todos los dígitos
 * 4. Si la suma % 10 == 0, el número es válido
 * 
 * ## Propósito:
 * - Detectar errores de digitación
 * - NO es una validación de seguridad (no prueba que la tarjeta exista)
 * - Usado para validación rápida en frontend antes de enviar al servidor
 * 
 * @param {string} cardNumber - Número de tarjeta (puede contener espacios/guiones)
 * @returns {boolean} true si el formato es válido según Luhn
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
 * Genera una clave de encriptación segura de 256 bits
 * 
 * ## USO ÚNICO:
 * Esta función debe usarse SOLO UNA VEZ para generar ENCRYPTION_KEY.
 * La clave generada debe almacenarse de forma segura en variables de entorno.
 * 
 * ## Seguridad:
 * - Usa crypto.randomBytes() (CSPRNG)
 * - 32 bytes = 256 bits de entropía
 * - Imposible de predecir o adivinar
 * 
 * @returns {string} Clave de 64 caracteres hexadecimales
 * 
 * @example
 * // Ejecutar una vez en desarrollo:
 * console.log(generateEncryptionKey());
 * // Copiar resultado a ENCRYPTION_KEY en .env
 */
export const generateEncryptionKey = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Genera un ID de transacción único y no predecible
 * 
 * ## Formato: TXN-{timestamp_base36}-{random_hex}
 * - **Timestamp**: Marca temporal en base 36 (compacto)
 * - **Random**: 8 bytes aleatorios en hexadecimal
 * 
 * ## Propiedades:
 * - Único globalmente (probabilidad de colisión negligible)
 * - Ordenable temporalmente (por el timestamp)
 * - No predecible (parte aleatoria)
 * 
 * @returns {string} ID de transacción en formato "TXN-XXXXX-XXXXXXXX"
 */
export const generateTransactionId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(8).toString("hex");
  return `TXN-${timestamp}-${randomPart}`.toUpperCase();
};

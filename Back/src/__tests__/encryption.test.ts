import {
  encrypt,
  decrypt,
  generateIV,
  generateIntegrityHash,
  verifyIntegrityHash,
  encryptCardData,
  decryptCardData,
  detectCardBrand,
  validateCardNumber,
  generateEncryptionKey,
  generateTransactionId,
} from "../utils/encryption";

// Mock ENCRYPTION_KEY para tests
const TEST_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("Encryption Utils", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  // ============================================
  // generateIV
  // ============================================
  describe("generateIV", () => {
    test("should generate a 16 byte IV", () => {
      const iv = generateIV();
      expect(iv.length).toBe(16);
    });

    test("should generate unique IVs each call", () => {
      const iv1 = generateIV();
      const iv2 = generateIV();
      expect(iv1.toString("hex")).not.toBe(iv2.toString("hex"));
    });

    test("should return a Buffer", () => {
      const iv = generateIV();
      expect(Buffer.isBuffer(iv)).toBe(true);
    });
  });

  // ============================================
  // encrypt
  // ============================================
  describe("encrypt", () => {
    test("should encrypt plaintext and return encrypted data", () => {
      const plaintext = "Sensitive card data: 4111111111111111";
      const result = encrypt(plaintext);

      expect(result.encryptedData).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.authTag).toBeDefined();
    });

    test("should return base64 encoded encrypted data", () => {
      const plaintext = "Test data";
      const result = encrypt(plaintext);

      // Base64 regex
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      expect(base64Regex.test(result.encryptedData)).toBe(true);
      expect(base64Regex.test(result.iv)).toBe(true);
      expect(base64Regex.test(result.authTag)).toBe(true);
    });

    test("should generate different encrypted data for same plaintext", () => {
      const plaintext = "Same data";
      const result1 = encrypt(plaintext);
      const result2 = encrypt(plaintext);

      // Encrypted data should be different due to unique IV
      expect(result1.encryptedData).not.toBe(result2.encryptedData);
      expect(result1.iv).not.toBe(result2.iv);
    });

    test("should handle empty string", () => {
      const result = encrypt("");
      expect(result.encryptedData).toBeDefined();
    });

    test("should handle long plaintext", () => {
      const longText = "a".repeat(10000);
      const result = encrypt(longText);
      expect(result.encryptedData).toBeDefined();
    });

    test("should handle unicode characters", () => {
      const unicodeText = "こんにちは世界 🌍 مرحبا";
      const result = encrypt(unicodeText);
      expect(result.encryptedData).toBeDefined();
    });
  });

  // ============================================
  // decrypt
  // ============================================
  describe("decrypt", () => {
    test("should decrypt encrypted data correctly", () => {
      const originalText = "Sensitive card data: 4111111111111111";
      const encrypted = encrypt(originalText);

      const decrypted = decrypt(
        encrypted.encryptedData,
        encrypted.iv,
        encrypted.authTag
      );

      expect(decrypted).toBe(originalText);
    });

    test("should correctly decrypt empty string", () => {
      const encrypted = encrypt("");
      const decrypted = decrypt(
        encrypted.encryptedData,
        encrypted.iv,
        encrypted.authTag
      );
      expect(decrypted).toBe("");
    });

    test("should correctly decrypt unicode text", () => {
      const unicodeText = "こんにちは世界 🌍 مرحبا";
      const encrypted = encrypt(unicodeText);

      const decrypted = decrypt(
        encrypted.encryptedData,
        encrypted.iv,
        encrypted.authTag
      );

      expect(decrypted).toBe(unicodeText);
    });

    test("should correctly decrypt long text", () => {
      const longText = "Sensitive data: ".repeat(500);
      const encrypted = encrypt(longText);

      const decrypted = decrypt(
        encrypted.encryptedData,
        encrypted.iv,
        encrypted.authTag
      );

      expect(decrypted).toBe(longText);
    });

    test("should throw error for tampered encrypted data", () => {
      const encrypted = encrypt("Sensitive data");

      // Tamper with encrypted data
      const tamperedData = Buffer.from(encrypted.encryptedData, "base64");
      tamperedData[0] = tamperedData[0] ^ 0xff; // Flip bits

      expect(() =>
        decrypt(
          tamperedData.toString("base64"),
          encrypted.iv,
          encrypted.authTag
        )
      ).toThrow();
    });

    test("should throw error for wrong authTag", () => {
      const encrypted = encrypt("Sensitive data");
      const wrongAuthTag = encrypt("Different data").authTag;

      expect(() =>
        decrypt(encrypted.encryptedData, encrypted.iv, wrongAuthTag)
      ).toThrow();
    });

    test("should throw error for wrong IV", () => {
      const encrypted = encrypt("Sensitive data");
      const wrongIV = encrypt("Different data").iv;

      expect(() =>
        decrypt(encrypted.encryptedData, wrongIV, encrypted.authTag)
      ).toThrow();
    });
  });

  // ============================================
  // Integration tests
  // ============================================
  describe("Encrypt/Decrypt Integration", () => {
    test("should successfully encrypt and decrypt card numbers", () => {
      const cardNumber = "4111111111111111";
      const encrypted = encrypt(cardNumber);
      const decrypted = decrypt(
        encrypted.encryptedData,
        encrypted.iv,
        encrypted.authTag
      );
      expect(decrypted).toBe(cardNumber);
    });

    test("should successfully encrypt and decrypt JSON objects", () => {
      const cardData = JSON.stringify({
        number: "4111111111111111",
        expiry: "12/25",
        cvv: "123",
      });
      const encrypted = encrypt(cardData);
      const decrypted = decrypt(
        encrypted.encryptedData,
        encrypted.iv,
        encrypted.authTag
      );
      expect(decrypted).toBe(cardData);
    });
  });

  // ============================================
  // Integrity Hash
  // ============================================
  describe("generateIntegrityHash", () => {
    test("should generate consistent hash for same data", () => {
      const data = "test-data";
      const hash1 = generateIntegrityHash(data);
      const hash2 = generateIntegrityHash(data);
      expect(hash1).toBe(hash2);
    });

    test("should generate different hashes for different data", () => {
      const hash1 = generateIntegrityHash("data1");
      const hash2 = generateIntegrityHash("data2");
      expect(hash1).not.toBe(hash2);
    });

    test("should return 64-character hex string", () => {
      const hash = generateIntegrityHash("test");
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  describe("verifyIntegrityHash", () => {
    test("should return true for valid hash", () => {
      const data = "test-data";
      const hash = generateIntegrityHash(data);
      expect(verifyIntegrityHash(data, hash)).toBe(true);
    });

    test("should return false for tampered data", () => {
      const data = "original-data";
      const hash = generateIntegrityHash(data);
      expect(verifyIntegrityHash("tampered-data", hash)).toBe(false);
    });

    test("should return false for invalid hash", () => {
      expect(verifyIntegrityHash("data", "0".repeat(64))).toBe(false);
    });
  });

  // ============================================
  // Card Data Encryption
  // ============================================
  describe("encryptCardData", () => {
    test("should encrypt all card fields", () => {
      const cardData = {
        cardNumber: "4111111111111111",
        cvv: "123",
        expiry: "12/25",
        cardholderName: "John Doe",
      };

      const result = encryptCardData(cardData);

      expect(result.encryptedCardNumber).toBeDefined();
      expect(result.encryptedCVV).toBeDefined();
      expect(result.encryptedExpiry).toBeDefined();
      expect(result.cardholderName).toBe("John Doe");
      expect(result.lastFourDigits).toBe("1111");
      expect(result.cardBrand).toBe("VISA");
      expect(result.iv).toBeDefined();
      expect(result.authTag).toBeDefined();
      expect(result.integrityHash).toBeDefined();
    });

    test("should detect Mastercard brand", () => {
      const result = encryptCardData({
        cardNumber: "5555555555554444",
        cvv: "123",
        expiry: "12/25",
        cardholderName: "Test",
      });
      expect(result.cardBrand).toBe("MASTERCARD");
    });

    test("should detect Amex brand", () => {
      const result = encryptCardData({
        cardNumber: "378282246310005",
        cvv: "1234",
        expiry: "12/25",
        cardholderName: "Test",
      });
      expect(result.cardBrand).toBe("AMEX");
    });
  });

  describe("decryptCardData", () => {
    test("should decrypt card data correctly", () => {
      const originalData = {
        cardNumber: "4111111111111111",
        cvv: "123",
        expiry: "12/25",
        cardholderName: "John Doe",
      };

      const encrypted = encryptCardData(originalData);
      const decrypted = decryptCardData({
        encryptedCardNumber: encrypted.encryptedCardNumber,
        encryptedCVV: encrypted.encryptedCVV,
        encryptedExpiry: encrypted.encryptedExpiry,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        integrityHash: encrypted.integrityHash,
      });

      expect(decrypted.cardNumber).toBe(originalData.cardNumber);
      expect(decrypted.cvv).toBe(originalData.cvv);
      expect(decrypted.expiry).toBe(originalData.expiry);
    });

    test("should throw error for tampered data", () => {
      const encrypted = encryptCardData({
        cardNumber: "4111111111111111",
        cvv: "123",
        expiry: "12/25",
        cardholderName: "Test",
      });

      expect(() =>
        decryptCardData({
          encryptedCardNumber: encrypted.encryptedCardNumber,
          encryptedCVV: encrypted.encryptedCVV,
          encryptedExpiry: encrypted.encryptedExpiry,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          integrityHash: "0".repeat(64), // Invalid hash
        })
      ).toThrow("Data integrity verification failed");
    });
  });

  // ============================================
  // Card Brand Detection
  // ============================================
  describe("detectCardBrand", () => {
    test("should detect VISA", () => {
      expect(detectCardBrand("4111111111111111")).toBe("VISA");
      expect(detectCardBrand("4012-8888-8888-1881")).toBe("VISA");
    });

    test("should detect MASTERCARD", () => {
      expect(detectCardBrand("5555555555554444")).toBe("MASTERCARD");
      expect(detectCardBrand("5105105105105100")).toBe("MASTERCARD");
      expect(detectCardBrand("2221000000000009")).toBe("MASTERCARD");
    });

    test("should detect AMEX", () => {
      expect(detectCardBrand("378282246310005")).toBe("AMEX");
      expect(detectCardBrand("371449635398431")).toBe("AMEX");
    });

    test("should detect DISCOVER", () => {
      expect(detectCardBrand("6011111111111117")).toBe("DISCOVER");
      expect(detectCardBrand("6011000990139424")).toBe("DISCOVER");
    });

    test("should detect JCB", () => {
      expect(detectCardBrand("3530111333300000")).toBe("JCB");
      expect(detectCardBrand("3566002020360505")).toBe("JCB");
    });

    test("should return UNKNOWN for invalid cards", () => {
      expect(detectCardBrand("1234567890123456")).toBe("UNKNOWN");
      expect(detectCardBrand("0000000000000000")).toBe("UNKNOWN");
    });
  });

  // ============================================
  // Card Number Validation
  // ============================================
  describe("validateCardNumber", () => {
    test("should validate correct Visa card", () => {
      expect(validateCardNumber("4111111111111111")).toBe(true);
    });

    test("should validate correct Mastercard", () => {
      expect(validateCardNumber("5555555555554444")).toBe(true);
    });

    test("should validate correct Amex", () => {
      expect(validateCardNumber("378282246310005")).toBe(true);
    });

    test("should invalidate incorrect checksum", () => {
      expect(validateCardNumber("4111111111111112")).toBe(false);
    });

    test("should invalidate too short number", () => {
      expect(validateCardNumber("411111")).toBe(false);
    });

    test("should invalidate too long number", () => {
      expect(validateCardNumber("41111111111111111111")).toBe(false);
    });

    test("should invalidate non-numeric", () => {
      expect(validateCardNumber("abcd1111efgh2222")).toBe(false);
    });

    test("should handle card numbers with spaces", () => {
      expect(validateCardNumber("4111 1111 1111 1111")).toBe(true);
    });

    test("should handle card numbers with dashes", () => {
      expect(validateCardNumber("4111-1111-1111-1111")).toBe(true);
    });
  });

  // ============================================
  // Utility Functions
  // ============================================
  describe("generateEncryptionKey", () => {
    test("should generate 64-character hex string", () => {
      const key = generateEncryptionKey();
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    test("should generate unique keys", () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe("generateTransactionId", () => {
    test("should start with TXN-", () => {
      const id = generateTransactionId();
      expect(id).toMatch(/^TXN-/);
    });

    test("should be uppercase", () => {
      const id = generateTransactionId();
      expect(id).toBe(id.toUpperCase());
    });

    test("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateTransactionId());
      }
      expect(ids.size).toBe(100);
    });

    test("should have expected format", () => {
      const id = generateTransactionId();
      expect(id).toMatch(/^TXN-[0-9A-Z]+-[0-9A-F]+$/);
    });
  });
});

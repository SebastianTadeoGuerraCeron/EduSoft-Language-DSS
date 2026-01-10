import {
  hashPassword,
  comparePassword,
  isValidEmail,
  isStrongPassword,
  sanitizeInput,
} from "../utils/security";

describe("Security Utils", () => {
  // ============================================
  // hashPassword & comparePassword
  // ============================================
  describe("hashPassword", () => {
    test("should hash a password", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    test("should generate different hashes for same password", async () => {
      const password = "TestPassword123!";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("comparePassword", () => {
    test("should return true for matching password", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);
      
      const result = await comparePassword(password, hash);
      expect(result).toBe(true);
    });

    test("should return false for non-matching password", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);
      
      const result = await comparePassword("WrongPassword123!", hash);
      expect(result).toBe(false);
    });

    test("should return false for empty password", async () => {
      const hash = await hashPassword("TestPassword123!");
      
      const result = await comparePassword("", hash);
      expect(result).toBe(false);
    });
  });

  // ============================================
  // isValidEmail
  // ============================================
  describe("isValidEmail", () => {
    test("should return true for valid email", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
    });

    test("should return true for email with subdomain", () => {
      expect(isValidEmail("test@sub.example.com")).toBe(true);
    });

    test("should return true for email with numbers", () => {
      expect(isValidEmail("test123@example.com")).toBe(true);
    });

    test("should return true for email with dots in local part", () => {
      expect(isValidEmail("test.user@example.com")).toBe(true);
    });

    test("should return true for email with plus sign", () => {
      expect(isValidEmail("test+tag@example.com")).toBe(true);
    });

    test("should return false for email without @", () => {
      expect(isValidEmail("testexample.com")).toBe(false);
    });

    test("should return false for email without domain", () => {
      expect(isValidEmail("test@")).toBe(false);
    });

    test("should return false for email without TLD", () => {
      expect(isValidEmail("test@example")).toBe(false);
    });

    test("should return false for empty string", () => {
      expect(isValidEmail("")).toBe(false);
    });

    test("should return false for email with spaces", () => {
      expect(isValidEmail("test @example.com")).toBe(false);
    });
  });

  // ============================================
  // isStrongPassword
  // ============================================
  describe("isStrongPassword", () => {
    test("should return true for strong password", () => {
      expect(isStrongPassword("SecureP@ss1")).toBe(true);
    });

    test("should return true for password with all requirements", () => {
      expect(isStrongPassword("MyP@ssw0rd!")).toBe(true);
    });

    test("should return false for password without uppercase", () => {
      expect(isStrongPassword("securep@ss1")).toBe(false);
    });

    test("should return false for password without lowercase", () => {
      expect(isStrongPassword("SECUREP@SS1")).toBe(false);
    });

    test("should return false for password without number", () => {
      expect(isStrongPassword("SecureP@ss!")).toBe(false);
    });

    test("should return false for password without special character", () => {
      expect(isStrongPassword("SecurePass1")).toBe(false);
    });

    test("should return false for password shorter than 8 chars", () => {
      expect(isStrongPassword("S@1ab")).toBe(false);
    });

    test("should return false for password containing username", () => {
      expect(isStrongPassword("JohnDoe@123", "johndoe")).toBe(false);
    });

    test("should return false for password containing email prefix", () => {
      expect(isStrongPassword("Mytest@123!", undefined, "test@example.com")).toBe(false);
    });

    test("should return false for password with numeric sequence 123", () => {
      expect(isStrongPassword("Secure123@pass")).toBe(false);
    });

    test("should return false for password with numeric sequence 321", () => {
      expect(isStrongPassword("Secure321@pass")).toBe(false);
    });

    test("should return false for password with repeated digits", () => {
      expect(isStrongPassword("Secure1111@pass")).toBe(false);
    });
  });

  // ============================================
  // sanitizeInput
  // ============================================
  describe("sanitizeInput", () => {
    test("should trim whitespace", () => {
      expect(sanitizeInput("  hello  ")).toBe("hello");
    });

    test("should remove < and > characters", () => {
      expect(sanitizeInput("<script>alert('xss')</script>")).toBe("scriptalert('xss')/script");
    });

    test("should handle empty string", () => {
      expect(sanitizeInput("")).toBe("");
    });

    test("should truncate long strings to 500 chars", () => {
      const longString = "a".repeat(600);
      expect(sanitizeInput(longString).length).toBe(500);
    });

    test("should preserve valid characters", () => {
      expect(sanitizeInput("Hello World! @#$%")).toBe("Hello World! @#$%");
    });
  });
});

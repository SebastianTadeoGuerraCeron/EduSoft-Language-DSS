import { validateStrongPassword } from "../middleware/passwordValidation";

describe("Password Validation Middleware", () => {
  // ============================================
  // validateStrongPassword
  // ============================================
  describe("validateStrongPassword", () => {
    describe("Valid passwords", () => {
      test("should accept a strong password with all requirements", () => {
        const result = validateStrongPassword("MySecure@Pass1");
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test("should accept password with special characters", () => {
        const result = validateStrongPassword("Complex!Pass99");
        expect(result.isValid).toBe(true);
      });

      test("should accept password with multiple special characters", () => {
        const result = validateStrongPassword("P@ss!w0rd#2024");
        expect(result.isValid).toBe(true);
      });
    });

    describe("Length requirements", () => {
      test("should reject password shorter than 8 characters", () => {
        const result = validateStrongPassword("Sh@rt1");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must be at least 8 characters long"
        );
      });

      test("should accept password with exactly 8 characters", () => {
        const result = validateStrongPassword("Exact@8!");
        expect(result.isValid).toBe(true);
      });
    });

    describe("Character requirements", () => {
      test("should reject password without uppercase letter", () => {
        const result = validateStrongPassword("lowercase@123");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must contain at least one uppercase letter"
        );
      });

      test("should reject password without lowercase letter", () => {
        const result = validateStrongPassword("UPPERCASE@123");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must contain at least one lowercase letter"
        );
      });

      test("should reject password without number", () => {
        const result = validateStrongPassword("NoNumbers@Here");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must contain at least one number"
        );
      });

      test("should reject password without special character", () => {
        const result = validateStrongPassword("NoSpecial1Here");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must contain at least one special character (!@#$%^&*...)"
        );
      });
    });

    describe("Username validation", () => {
      test("should reject password containing username", () => {
        const result = validateStrongPassword("JohnDoe@2024", "johndoe");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must not contain your username"
        );
      });

      test("should reject password containing username (case insensitive)", () => {
        const result = validateStrongPassword("TestUSER@99", "testuser");
        expect(result.isValid).toBe(false);
      });

      test("should accept password not containing username", () => {
        const result = validateStrongPassword("Secure@Pass1", "johndoe");
        expect(result.isValid).toBe(true);
      });

      test("should ignore short usernames (less than 3 chars)", () => {
        const result = validateStrongPassword("JoSecure@1", "Jo");
        expect(result.isValid).toBe(true);
      });
    });

    describe("Email validation", () => {
      test("should reject password containing email prefix", () => {
        const result = validateStrongPassword(
          "Mytestuser@1",
          "",
          "testuser@example.com"
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Password must not contain your email");
      });

      test("should accept password not containing email prefix", () => {
        const result = validateStrongPassword(
          "Secure@Pass1",
          "",
          "john@example.com"
        );
        expect(result.isValid).toBe(true);
      });
    });

    describe("Numeric sequences", () => {
      test("should reject password with ascending sequence 123", () => {
        const result = validateStrongPassword("Secure123@Pass");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must not contain sequential or repetitive numbers"
        );
      });

      test("should reject password with descending sequence 321", () => {
        const result = validateStrongPassword("Secure321@Pass");
        expect(result.isValid).toBe(false);
      });

      test("should reject password with repeated digits 1111", () => {
        const result = validateStrongPassword("Secure1111@Pass");
        expect(result.isValid).toBe(false);
      });

      test("should accept password with non-sequential numbers", () => {
        const result = validateStrongPassword("Secure159@Pass");
        expect(result.isValid).toBe(true);
      });
    });

    describe("Keyboard patterns", () => {
      test("should reject password with qwerty pattern", () => {
        const result = validateStrongPassword("Myqwerty@1");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Password must not contain common keyboard patterns"
        );
      });

      test("should reject password with asdfgh pattern", () => {
        const result = validateStrongPassword("Myasdfgh@1");
        expect(result.isValid).toBe(false);
      });

      test("should reject password with zxcvbn pattern", () => {
        const result = validateStrongPassword("Myzxcvbn@1");
        expect(result.isValid).toBe(false);
      });
    });

    describe("Common passwords", () => {
      test("should reject common password variations", () => {
        const result = validateStrongPassword("Password1!");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "This password is too common and easily guessable"
        );
      });

      test("should reject 'Welcome1!'", () => {
        const result = validateStrongPassword("Welcome1!");
        expect(result.isValid).toBe(false);
      });
    });

    describe("Multiple errors", () => {
      test("should return multiple errors for very weak password", () => {
        const result = validateStrongPassword("weak");
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(3);
      });
    });
  });
});

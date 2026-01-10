/**
 * Tests for securityLogger.ts utility
 * HU03 & HU07 - Security event logging
 */

import {
  SecurityEventType,
  logSecurityEvent,
  logWeakPasswordAttempt,
  logRegistrationSuccess,
  logRegistrationFailed,
  logInsecureChannelAccess,
  logProtocolDowngrade,
  logIntegrityCheckFailed,
  logReplayAttack,
  logPaymentTransaction,
  logPaymentTransactionFailed,
  logCardOperation,
  logWebhookSignatureInvalid,
} from "../utils/securityLogger";

describe("Security Logger", () => {
  let consoleSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("SecurityEventType enum", () => {
    it("should have all required event types", () => {
      expect(SecurityEventType.WEAK_PASSWORD_ATTEMPT).toBe("weak_password_attempt");
      expect(SecurityEventType.REGISTRATION_SUCCESS).toBe("registration_success");
      expect(SecurityEventType.REGISTRATION_FAILED).toBe("registration_failed");
      expect(SecurityEventType.SUSPICIOUS_ACTIVITY).toBe("suspicious_activity");
      expect(SecurityEventType.RATE_LIMIT_EXCEEDED).toBe("rate_limit_exceeded");
      expect(SecurityEventType.COMMON_PASSWORD_ATTEMPT).toBe("common_password_attempt");
      expect(SecurityEventType.INSECURE_CHANNEL_ACCESS).toBe("insecure_channel_access");
      expect(SecurityEventType.PROTOCOL_DOWNGRADE).toBe("protocol_downgrade");
      expect(SecurityEventType.REPLAY_ATTACK_DETECTED).toBe("replay_attack_detected");
      expect(SecurityEventType.PAYMENT_TRANSACTION).toBe("payment_transaction");
    });
  });

  describe("logSecurityEvent", () => {
    it("should log event to console", async () => {
      await logSecurityEvent({
        eventType: SecurityEventType.REGISTRATION_SUCCESS,
        username: "testuser",
        email: "test@test.com",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
        details: { role: "STUDENT" },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] registration_success",
        expect.objectContaining({
          username: "testuser",
          email: "test@test.com",
          ip: "127.0.0.1",
        })
      );
    });

    it("should log warning for weak password attempt", async () => {
      await logSecurityEvent({
        eventType: SecurityEventType.WEAK_PASSWORD_ATTEMPT,
        username: "testuser",
        ipAddress: "192.168.1.1",
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("SECURITY ALERT")
      );
    });

    it("should log warning for common password attempt", async () => {
      await logSecurityEvent({
        eventType: SecurityEventType.COMMON_PASSWORD_ATTEMPT,
        username: "testuser",
        ipAddress: "192.168.1.1",
      });

      expect(warnSpy).toHaveBeenCalled();
    });

    it("should log error for rate limit exceeded", async () => {
      await logSecurityEvent({
        eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
        ipAddress: "10.0.0.1",
      });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Rate limit exceeded")
      );
    });

    it("should handle errors gracefully", async () => {
      // Force error by mocking console.log to throw
      consoleSpy.mockImplementationOnce(() => {
        throw new Error("Logging failed");
      });

      // Should not throw
      await logSecurityEvent({
        eventType: SecurityEventType.REGISTRATION_SUCCESS,
        ipAddress: "127.0.0.1",
      });

      expect(errorSpy).toHaveBeenCalledWith(
        "Error logging security event:",
        expect.any(Error)
      );
    });
  });

  describe("logWeakPasswordAttempt", () => {
    it("should log weak password attempt with errors", async () => {
      await logWeakPasswordAttempt(
        "testuser",
        "test@test.com",
        "192.168.1.1",
        ["Password too short", "No uppercase"]
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] weak_password_attempt",
        expect.objectContaining({
          username: "testuser",
          email: "test@test.com",
          details: { errors: ["Password too short", "No uppercase"] },
        })
      );
    });
  });

  describe("logRegistrationSuccess", () => {
    it("should log successful registration", async () => {
      await logRegistrationSuccess(
        "newuser",
        "new@test.com",
        "10.0.0.1",
        "STUDENT"
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] registration_success",
        expect.objectContaining({
          username: "newuser",
          details: { role: "STUDENT" },
        })
      );
    });
  });

  describe("logRegistrationFailed", () => {
    it("should log failed registration", async () => {
      await logRegistrationFailed(
        "fail@test.com",
        "192.168.0.1",
        "Email already exists"
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] registration_failed",
        expect.objectContaining({
          email: "fail@test.com",
          details: { reason: "Email already exists" },
        })
      );
    });
  });

  describe("logInsecureChannelAccess", () => {
    it("should log insecure channel access attempt", async () => {
      await logInsecureChannelAccess(
        "192.168.1.100",
        "/api/billing/payment",
        "Mozilla/5.0"
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] insecure_channel_access",
        expect.objectContaining({
          ip: "192.168.1.100",
          details: { path: "/api/billing/payment" },
        })
      );
    });
  });

  describe("logProtocolDowngrade", () => {
    it("should log protocol downgrade attempt", async () => {
      await logProtocolDowngrade(
        "10.0.0.5",
        "HTTP/1.0",
        "/api/secure"
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] protocol_downgrade",
        expect.objectContaining({
          ip: "10.0.0.5",
          details: { protocol: "HTTP/1.0", path: "/api/secure" },
        })
      );
    });
  });

  describe("logIntegrityCheckFailed", () => {
    it("should log integrity check failure", async () => {
      await logIntegrityCheckFailed(
        "172.16.0.1",
        "/api/billing/process",
        "user-123",
        "HMAC mismatch"
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] integrity_check_failed",
        expect.objectContaining({
          ip: "172.16.0.1",
          details: {
            path: "/api/billing/process",
            userId: "user-123",
            reason: "HMAC mismatch",
          },
        })
      );
    });

    it("should handle missing optional parameters", async () => {
      await logIntegrityCheckFailed("172.16.0.1", "/api/test");

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] integrity_check_failed",
        expect.objectContaining({
          details: { path: "/api/test", userId: undefined, reason: undefined },
        })
      );
    });
  });

  describe("logReplayAttack", () => {
    it("should log replay attack detection", async () => {
      await logReplayAttack(
        "192.168.1.50",
        "abc123nonce",
        "/api/billing/charge"
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] replay_attack_detected",
        expect.objectContaining({
          ip: "192.168.1.50",
          details: { nonce: "abc123nonce", path: "/api/billing/charge" },
        })
      );
    });
  });

  describe("logPaymentTransaction", () => {
    it("should log successful payment transaction", async () => {
      await logPaymentTransaction(
        "user-123",
        "10.0.0.1",
        "TXN-456",
        9999, // $99.99 in cents
        "premium_monthly"
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] payment_transaction",
        expect.objectContaining({
          details: {
            userId: "user-123",
            transactionId: "TXN-456",
            amount: 9999,
            plan: "premium_monthly",
          },
        })
      );
    });
  });

  describe("logPaymentTransactionFailed", () => {
    it("should log failed payment transaction", async () => {
      await logPaymentTransactionFailed(
        "user-789",
        "192.168.1.1",
        "Card declined",
        "premium_yearly"
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] payment_transaction_failed",
        expect.objectContaining({
          details: {
            userId: "user-789",
            reason: "Card declined",
            plan: "premium_yearly",
          },
        })
      );
    });
  });

  describe("logCardOperation", () => {
    it("should log successful card add operation", async () => {
      await logCardOperation("user-123", "127.0.0.1", "add", true);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] card_operation",
        expect.objectContaining({
          details: { userId: "user-123", operation: "add", success: true },
        })
      );
    });

    it("should log failed card delete operation", async () => {
      await logCardOperation("user-456", "10.0.0.1", "delete", false);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] card_operation",
        expect.objectContaining({
          details: { userId: "user-456", operation: "delete", success: false },
        })
      );
    });

    it("should log card update operation", async () => {
      await logCardOperation("user-789", "192.168.1.1", "update", true);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] card_operation",
        expect.objectContaining({
          details: { operation: "update" },
        })
      );
    });

    it("should log setDefault operation", async () => {
      await logCardOperation("user-abc", "172.16.0.1", "setDefault", true);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] card_operation",
        expect.objectContaining({
          details: { operation: "setDefault" },
        })
      );
    });
  });

  describe("logWebhookSignatureInvalid", () => {
    it("should log invalid webhook signature", async () => {
      await logWebhookSignatureInvalid(
        "52.89.214.238",
        "Stripe-Webhook/1.0"
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] webhook_signature_invalid",
        expect.objectContaining({
          ip: "52.89.214.238",
        })
      );
    });

    it("should handle missing userAgent", async () => {
      await logWebhookSignatureInvalid("10.0.0.1");

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURITY] webhook_signature_invalid",
        expect.objectContaining({
          ip: "10.0.0.1",
        })
      );
    });
  });
});

/**
 * Tests for transactionSecurity.ts middleware
 * HU07 - Security middleware for payment transactions
 */

import { Request, Response, NextFunction } from "express";
import {
  generateHmac,
  verifyHmac,
  generateNonce,
  generateSecureTransactionId,
  signTransactionResponse,
  createSecureResponse,
  verifySecureResponse,
  requireSecureChannel,
  transactionSecurityHeaders,
  verifyRequestIntegrity,
} from "../middleware/transactionSecurity";

// Mock securityLogger
jest.mock("../utils/securityLogger", () => ({
  logInsecureChannelAccess: jest.fn().mockResolvedValue(undefined),
  logProtocolDowngrade: jest.fn().mockResolvedValue(undefined),
  logReplayAttack: jest.fn().mockResolvedValue(undefined),
  logIntegrityCheckFailed: jest.fn().mockResolvedValue(undefined),
}));

// Set environment variables
beforeAll(() => {
  process.env.ENCRYPTION_KEY = "testkey1234567890testkey1234567890testkey1234567890testkey12345678";
  process.env.NODE_ENV = "test";
});

describe("Transaction Security Utilities", () => {
  describe("generateHmac", () => {
    it("should generate a consistent HMAC for the same data", () => {
      const data = "test-data-123";
      const hmac1 = generateHmac(data);
      const hmac2 = generateHmac(data);
      expect(hmac1).toBe(hmac2);
    });

    it("should generate different HMACs for different data", () => {
      const hmac1 = generateHmac("data1");
      const hmac2 = generateHmac("data2");
      expect(hmac1).not.toBe(hmac2);
    });

    it("should return a 64-character hex string", () => {
      const hmac = generateHmac("test");
      expect(hmac).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(hmac)).toBe(true);
    });
  });

  describe("verifyHmac", () => {
    it("should return true for valid HMAC", () => {
      const data = "test-data";
      const hmac = generateHmac(data);
      expect(verifyHmac(data, hmac)).toBe(true);
    });

    it("should return false for invalid HMAC", () => {
      const data = "test-data";
      const invalidHmac = "0".repeat(64);
      expect(verifyHmac(data, invalidHmac)).toBe(false);
    });

    it("should return false for tampered data", () => {
      const originalData = "original-data";
      const hmac = generateHmac(originalData);
      expect(verifyHmac("tampered-data", hmac)).toBe(false);
    });

    it("should return false for malformed HMAC", () => {
      expect(verifyHmac("data", "invalid")).toBe(false);
    });
  });

  describe("generateNonce", () => {
    it("should generate a 32-character hex string", () => {
      const nonce = generateNonce();
      expect(nonce).toHaveLength(32);
      expect(/^[0-9a-f]+$/.test(nonce)).toBe(true);
    });

    it("should generate unique nonces", () => {
      const nonces = new Set<string>();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateNonce());
      }
      expect(nonces.size).toBe(100);
    });
  });

  describe("generateSecureTransactionId", () => {
    it("should start with STXN-", () => {
      const id = generateSecureTransactionId();
      expect(id).toMatch(/^STXN-/);
    });

    it("should be uppercase", () => {
      const id = generateSecureTransactionId();
      expect(id).toBe(id.toUpperCase());
    });

    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSecureTransactionId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("signTransactionResponse", () => {
    it("should generate a signature for a transaction", () => {
      const payload = { amount: 100, currency: "USD" };
      const transactionId = "TXN-123";
      const timestamp = Date.now();
      
      const signature = signTransactionResponse(payload, transactionId, timestamp);
      
      expect(signature).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(signature)).toBe(true);
    });

    it("should generate consistent signatures for same input", () => {
      const payload = { amount: 100 };
      const transactionId = "TXN-123";
      const timestamp = 1234567890;
      
      const sig1 = signTransactionResponse(payload, transactionId, timestamp);
      const sig2 = signTransactionResponse(payload, transactionId, timestamp);
      
      expect(sig1).toBe(sig2);
    });
  });

  describe("createSecureResponse", () => {
    it("should wrap data with security metadata", () => {
      const data = { success: true, amount: 100 };
      const response = createSecureResponse(data);
      
      expect(response.data).toEqual(data);
      expect(response._security).toBeDefined();
      expect(response._security.transactionId).toMatch(/^STXN-/);
      expect(response._security.timestamp).toBeGreaterThan(0);
      expect(response._security.nonce).toHaveLength(32);
      expect(response._security.signature).toHaveLength(64);
      expect(response._security.algorithm).toBe("HMAC-SHA256");
    });

    it("should use provided transaction ID", () => {
      const data = { test: true };
      const customId = "CUSTOM-TXN-123";
      const response = createSecureResponse(data, customId);
      
      expect(response._security.transactionId).toBe(customId);
    });
  });

  describe("verifySecureResponse", () => {
    it("should return true for valid response", () => {
      const data = { test: "value", amount: 50 };
      const secureResponse = createSecureResponse(data);
      
      expect(verifySecureResponse(secureResponse)).toBe(true);
    });

    it("should return false for tampered data", () => {
      const secureResponse = createSecureResponse({ original: true });
      secureResponse.data = { original: false } as any;
      
      expect(verifySecureResponse(secureResponse)).toBe(false);
    });

    it("should return false for expired timestamp", () => {
      const data = { test: true };
      const secureResponse = createSecureResponse(data);
      secureResponse._security.timestamp = Date.now() - 60000;
      
      expect(verifySecureResponse(secureResponse)).toBe(false);
    });
  });
});

describe("Transaction Security Middlewares", () => {
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe("requireSecureChannel", () => {
    it("should allow localhost in any mode", () => {
      const req = {
        hostname: "localhost",
        secure: false,
        ip: "127.0.0.1",
        path: "/api/billing",
        headers: {},
        body: {},
      } as unknown as Request;
      
      requireSecureChannel(req, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow 127.0.0.1 in any mode", () => {
      const req = {
        hostname: "127.0.0.1",
        secure: false,
        ip: "127.0.0.1",
        path: "/api/billing",
        headers: {},
        body: {},
      } as unknown as Request;
      
      requireSecureChannel(req, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow development mode", () => {
      process.env.NODE_ENV = "development";
      const req = {
        hostname: "example.com",
        secure: false,
        ip: "1.2.3.4",
        path: "/api/billing",
        headers: {},
        body: {},
      } as unknown as Request;
      
      requireSecureChannel(req, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      process.env.NODE_ENV = "test";
    });

    it("should allow secure connections in production", () => {
      process.env.NODE_ENV = "production";
      const req = {
        hostname: "example.com",
        secure: true,
        ip: "1.2.3.4",
        path: "/api/billing",
        headers: {},
        body: {},
      } as unknown as Request;
      
      requireSecureChannel(req, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      process.env.NODE_ENV = "test";
    });

    it("should allow x-forwarded-proto https in production", () => {
      process.env.NODE_ENV = "production";
      const req = {
        hostname: "example.com",
        secure: false,
        ip: "1.2.3.4",
        path: "/api/billing",
        headers: { "x-forwarded-proto": "https" },
        body: {},
      } as unknown as Request;
      
      requireSecureChannel(req, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      process.env.NODE_ENV = "test";
    });
  });

  describe("transactionSecurityHeaders", () => {
    it("should add security headers to response", () => {
      const req = {
        hostname: "localhost",
        secure: false,
        ip: "127.0.0.1",
        path: "/api/billing",
        headers: {},
        body: {},
      } as unknown as Request;
      
      transactionSecurityHeaders(req, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Strict-Transport-Security",
        expect.any(String)
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "X-Content-Type-Options",
        "nosniff"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "X-Frame-Options",
        "DENY"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        expect.stringContaining("no-store")
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("verifyRequestIntegrity", () => {
    it("should pass if no integrity headers provided", () => {
      const req = {
        hostname: "localhost",
        secure: false,
        ip: "127.0.0.1",
        path: "/api/billing",
        headers: {},
        body: {},
      } as unknown as Request;
      
      verifyRequestIntegrity(req, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it("should pass for valid integrity", () => {
      const body = { amount: 100 };
      const timestamp = Date.now().toString();
      const dataToSign = `${timestamp}|${JSON.stringify(body)}`;
      const signature = generateHmac(dataToSign);
      
      const req = {
        hostname: "localhost",
        secure: false,
        ip: "127.0.0.1",
        path: "/api/billing",
        headers: {
          "x-transaction-timestamp": timestamp,
          "x-transaction-signature": signature,
        },
        body,
      } as unknown as Request;
      
      verifyRequestIntegrity(req, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

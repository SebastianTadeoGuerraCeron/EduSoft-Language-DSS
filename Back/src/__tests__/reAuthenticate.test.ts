/**
 * Tests for reAuthenticate.ts middleware
 * Tests re-authentication middleware for critical actions
 */

import { Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import {
  requireReAuthentication,
  optionalReAuthentication,
} from "../middleware/reAuthenticate";
import { AuthRequest } from "../middleware/auth";

// Mock Prisma
jest.mock("@prisma/client", () => {
  const mockFindUnique = jest.fn();
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findUnique: mockFindUnique,
      },
      $disconnect: jest.fn(),
    })),
  };
});

// Mock audit controller
jest.mock("../controllers/audit-ctrl", () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  SecurityEvent: {
    REAUTH_FAILED: "reauth_failed",
    REAUTH_SUCCESS: "reauth_success",
  },
  SecuritySeverity: {
    LOW: "low",
    MEDIUM: "medium",
  },
}));

// Mock bcrypt
jest.mock("bcrypt");
const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

// Import PrismaClient after mocking
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const mockFindUnique = (prisma.user.findUnique as jest.Mock);

describe("ReAuthenticate Middleware", () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    mockReq = {
      userId: "user-123",
      headers: {},
      originalUrl: "/api/billing/subscribe",
      method: "POST",
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("requireReAuthentication", () => {
    it("should return 401 if userId is not present", async () => {
      mockReq.userId = undefined;

      await requireReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        code: "AUTH_REQUIRED",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 if password header is missing", async () => {
      mockReq.headers = {};

      await requireReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "REAUTH_REQUIRED",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 if user not found", async () => {
      mockReq.headers = { "x-reauth-password": "password123" };
      mockFindUnique.mockResolvedValue(null);

      await requireReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 if password is incorrect", async () => {
      mockReq.headers = { "x-reauth-password": "wrongpassword" };
      mockFindUnique.mockResolvedValue({
        password: "hashedpassword",
      });
      bcryptMock.compare.mockResolvedValue(false as never);

      await requireReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "REAUTH_FAILED",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should call next() if password is correct", async () => {
      mockReq.headers = { "x-reauth-password": "correctpassword" };
      mockFindUnique.mockResolvedValue({
        password: "hashedpassword",
      });
      bcryptMock.compare.mockResolvedValue(true as never);

      await requireReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthRequest).reAuthenticated).toBe(true);
    });

    it("should log failed re-authentication attempts", async () => {
      mockReq.headers = { "x-reauth-password": "wrongpassword" };
      mockFindUnique.mockResolvedValue({
        password: "hashedpassword",
      });
      bcryptMock.compare.mockResolvedValue(false as never);

      await requireReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed re-authentication")
      );
    });

    it("should handle database errors gracefully", async () => {
      mockReq.headers = { "x-reauth-password": "password" };
      mockFindUnique.mockRejectedValue(new Error("Database error"));

      await requireReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Internal server error",
      });
    });

    it("should handle bcrypt errors gracefully", async () => {
      mockReq.headers = { "x-reauth-password": "password" };
      mockFindUnique.mockResolvedValue({
        password: "hashedpassword",
      });
      bcryptMock.compare.mockRejectedValue(new Error("Bcrypt error") as never);

      await requireReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("optionalReAuthentication", () => {
    it("should continue without password header", async () => {
      mockReq.headers = {};

      await optionalReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthRequest).reAuthenticated).toBe(false);
    });

    it("should verify password if provided", async () => {
      mockReq.headers = { "x-reauth-password": "correctpassword" };
      mockFindUnique.mockResolvedValue({
        password: "hashedpassword",
      });
      bcryptMock.compare.mockResolvedValue(true as never);

      await optionalReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthRequest).reAuthenticated).toBe(true);
    });

    it("should set reAuthenticated to false if password is incorrect", async () => {
      mockReq.headers = { "x-reauth-password": "wrongpassword" };
      mockFindUnique.mockResolvedValue({
        password: "hashedpassword",
      });
      bcryptMock.compare.mockResolvedValue(false as never);

      await optionalReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthRequest).reAuthenticated).toBe(false);
    });

    it("should continue if user not found", async () => {
      mockReq.headers = { "x-reauth-password": "password" };
      mockFindUnique.mockResolvedValue(null);

      await optionalReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthRequest).reAuthenticated).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      mockReq.headers = { "x-reauth-password": "password" };
      mockFindUnique.mockRejectedValue(new Error("Database error"));

      await optionalReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthRequest).reAuthenticated).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    it("should not throw on bcrypt error", async () => {
      mockReq.headers = { "x-reauth-password": "password" };
      mockFindUnique.mockResolvedValue({
        password: "hashedpassword",
      });
      bcryptMock.compare.mockRejectedValue(new Error("Bcrypt error") as never);

      await optionalReAuthentication(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthRequest).reAuthenticated).toBe(false);
    });
  });
});

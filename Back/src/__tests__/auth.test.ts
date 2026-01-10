import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { authenticate, AuthRequest } from "../middleware/auth";

describe("Authentication Middleware", () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  const originalEnv = process.env.JWT_SECRET;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    process.env.JWT_SECRET = "test-secret-key";
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalEnv;
  });

  describe("authenticate", () => {
    it("should reject request without authorization header", () => {
      authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "No token provided",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with invalid authorization format", () => {
      mockReq.headers = {
        authorization: "InvalidFormat token123",
      };

      authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "No token provided",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with invalid token", () => {
      mockReq.headers = {
        authorization: "Bearer invalid-token",
      };

      authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid token",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with expired token", () => {
      const expiredToken = jwt.sign(
        { userId: "user123", role: "STUDENT_FREE" },
        "test-secret-key",
        { expiresIn: "-1h" } // Token ya expirado
      );

      mockReq.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Token expired",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should accept valid token and attach user data to request", () => {
      const validToken = jwt.sign(
        { userId: "user123", role: "STUDENT_PRO" },
        "test-secret-key",
        { expiresIn: "1h" }
      );

      mockReq.headers = {
        authorization: `Bearer ${validToken}`,
      };

      authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.userId).toBe("user123");
      expect(mockReq.userRole).toBe("STUDENT_PRO");
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should work with ADMIN role", () => {
      const adminToken = jwt.sign(
        { userId: "admin123", role: "ADMIN" },
        "test-secret-key",
        { expiresIn: "1h" }
      );

      mockReq.headers = {
        authorization: `Bearer ${adminToken}`,
      };

      authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.userId).toBe("admin123");
      expect(mockReq.userRole).toBe("ADMIN");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should work with TUTOR role", () => {
      const tutorToken = jwt.sign(
        { userId: "tutor123", role: "TUTOR" },
        "test-secret-key",
        { expiresIn: "1h" }
      );

      mockReq.headers = {
        authorization: `Bearer ${tutorToken}`,
      };

      authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.userId).toBe("tutor123");
      expect(mockReq.userRole).toBe("TUTOR");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should use fallback secret if JWT_SECRET is not defined", () => {
      delete process.env.JWT_SECRET;

      const token = jwt.sign(
        { userId: "user123", role: "STUDENT_FREE" },
        "fallback-secret-key",
        { expiresIn: "1h" }
      );

      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.userId).toBe("user123");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle malformed JWT token", () => {
      mockReq.headers = {
        authorization: "Bearer not.a.valid.jwt",
      };

      authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid token",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle empty token", () => {
      mockReq.headers = {
        authorization: "Bearer ",
      };

      authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid token",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle token with wrong signature", () => {
      const wrongToken = jwt.sign(
        { userId: "user123", role: "STUDENT_FREE" },
        "wrong-secret-key",
        { expiresIn: "1h" }
      );

      mockReq.headers = {
        authorization: `Bearer ${wrongToken}`,
      };

      authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid token",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

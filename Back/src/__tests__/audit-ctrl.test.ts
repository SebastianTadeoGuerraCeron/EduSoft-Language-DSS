/**
 * Tests para audit-ctrl.ts
 * Cubre: funciones de logging y endpoints de consulta de logs
 */

import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth";

// Mock del servicio de auditoría
const mockAuditPrisma = {
  userActivityLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  securityLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  errorLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  premiumAccessLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  adminActionLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock("../services/auditDb", () => ({
  getAuditPrisma: () => mockAuditPrisma,
}));

jest.mock("../utils/networkConstants", () => ({
  normalizeIP: jest.fn((ip) => ip || "127.0.0.1"),
}));

import {
  getClientIP,
  logUserActivity,
  logSecurityEvent,
  logError,
  logPremiumAccess,
  logAdminAction,
  getActivityLogs,
  getSecurityLogs,
  getErrorLogs,
  getPremiumAccessLogs,
  getAdminActionLogs,
  ActivityAction,
  SecurityEvent,
  SecuritySeverity,
  ResourceType,
} from "../controllers/audit-ctrl";

describe("audit-ctrl", () => {
  let mockReq: Partial<Request>;
  let mockAuthReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      headers: {
        "user-agent": "test-agent",
      },
      ip: "192.168.1.1",
      socket: { remoteAddress: "192.168.1.1" } as any,
    };

    mockAuthReq = {
      ...mockReq,
      userId: "user-123",
      query: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  // ============================================
  // Tests para getClientIP
  // ============================================
  describe("getClientIP", () => {
    it("should return IP from x-forwarded-for header", () => {
      const req = {
        headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
        ip: "127.0.0.1",
      } as unknown as Request;

      const ip = getClientIP(req);
      expect(ip).toBe("10.0.0.1");
    });

    it("should return IP from x-real-ip header", () => {
      const req = {
        headers: { "x-real-ip": "10.0.0.5" },
        ip: "127.0.0.1",
      } as unknown as Request;

      const ip = getClientIP(req);
      expect(ip).toBe("10.0.0.5");
    });

    it("should return IP from req.ip when no headers", () => {
      const req = {
        headers: {},
        ip: "192.168.1.100",
      } as unknown as Request;

      const ip = getClientIP(req);
      expect(ip).toBe("192.168.1.100");
    });

    it("should return IP from socket.remoteAddress as fallback", () => {
      const req = {
        headers: {},
        socket: { remoteAddress: "10.0.0.10" },
      } as unknown as Request;

      const ip = getClientIP(req);
      expect(ip).toBe("10.0.0.10");
    });
  });

  // ============================================
  // Tests para logUserActivity
  // ============================================
  describe("logUserActivity", () => {
    it("should log user activity successfully", async () => {
      mockAuditPrisma.userActivityLog.create.mockResolvedValue({ id: "log-1" });

      await logUserActivity(mockReq as Request, {
        userId: "user-123",
        username: "testuser",
        email: "test@example.com",
        action: ActivityAction.LOGIN,
        success: true,
      });

      expect(mockAuditPrisma.userActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          username: "testuser",
          email: "test@example.com",
          action: ActivityAction.LOGIN,
          success: true,
        }),
      });
    });

    it("should handle logging failure gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockAuditPrisma.userActivityLog.create.mockRejectedValue(new Error("DB error"));

      await logUserActivity(mockReq as Request, {
        userId: "user-123",
        action: ActivityAction.LOGIN,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AuditLog] Failed to log user activity:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it("should log activity with resource details", async () => {
      mockAuditPrisma.userActivityLog.create.mockResolvedValue({ id: "log-2" });

      await logUserActivity(mockReq as Request, {
        userId: "user-456",
        action: ActivityAction.VIEW_LESSON,
        resource: "lesson-123",
        resourceType: ResourceType.LESSON,
        details: { lessonTitle: "Test Lesson" },
        duration: 1500,
      });

      expect(mockAuditPrisma.userActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-456",
          action: ActivityAction.VIEW_LESSON,
          resource: "lesson-123",
          resourceType: ResourceType.LESSON,
          duration: 1500,
        }),
      });
    });
  });

  // ============================================
  // Tests para logSecurityEvent
  // ============================================
  describe("logSecurityEvent", () => {
    it("should log security event successfully", async () => {
      mockAuditPrisma.securityLog.create.mockResolvedValue({ id: "sec-1" });

      await logSecurityEvent(mockReq as Request, {
        userId: "user-123",
        username: "testuser",
        event: SecurityEvent.FAILED_LOGIN,
        severity: SecuritySeverity.MEDIUM,
      });

      expect(mockAuditPrisma.securityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          username: "testuser",
          event: SecurityEvent.FAILED_LOGIN,
          severity: SecuritySeverity.MEDIUM,
          resolved: false,
        }),
      });
    });

    it("should log critical events to console", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      mockAuditPrisma.securityLog.create.mockResolvedValue({ id: "sec-2" });

      await logSecurityEvent(mockReq as Request, {
        userId: "user-123",
        event: SecurityEvent.ACCOUNT_LOCKED,
        severity: SecuritySeverity.CRITICAL,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[SECURITY CRITICAL]")
      );
      consoleSpy.mockRestore();
    });

    it("should handle security logging failure gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockAuditPrisma.securityLog.create.mockRejectedValue(new Error("DB error"));

      await logSecurityEvent(mockReq as Request, {
        event: SecurityEvent.SUSPICIOUS_ACTIVITY,
        severity: SecuritySeverity.HIGH,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AuditLog] Failed to log security event:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para logError
  // ============================================
  describe("logError", () => {
    it("should log error successfully", async () => {
      mockAuditPrisma.errorLog.create.mockResolvedValue({ id: "err-1" });

      await logError(mockReq as Request, {
        userId: "user-123",
        errorType: "ValidationError",
        endpoint: "/api/users",
        method: "POST",
        message: "Invalid input",
        stack: "Error stack trace",
      });

      expect(mockAuditPrisma.errorLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          errorType: "ValidationError",
          endpoint: "/api/users",
          method: "POST",
          message: "Invalid input",
        }),
      });
    });

    it("should handle null request", async () => {
      mockAuditPrisma.errorLog.create.mockResolvedValue({ id: "err-2" });

      await logError(null, {
        errorType: "SystemError",
        message: "System crash",
      });

      expect(mockAuditPrisma.errorLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          errorType: "SystemError",
          message: "System crash",
          ipAddress: null,
        }),
      });
    });

    it("should handle error logging failure gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockAuditPrisma.errorLog.create.mockRejectedValue(new Error("DB error"));

      await logError(mockReq as Request, {
        errorType: "TestError",
        message: "Test message",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AuditLog] Failed to log error:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para logPremiumAccess
  // ============================================
  describe("logPremiumAccess", () => {
    it("should log premium access successfully", async () => {
      mockAuditPrisma.premiumAccessLog.create.mockResolvedValue({ id: "prem-1" });

      await logPremiumAccess(mockReq as Request, {
        userId: "user-123",
        username: "premiumuser",
        contentType: "LESSON",
        contentId: "lesson-456",
        contentTitle: "Premium Lesson",
        accessType: "VIEW",
      });

      expect(mockAuditPrisma.premiumAccessLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          username: "premiumuser",
          contentType: "LESSON",
          contentId: "lesson-456",
          contentTitle: "Premium Lesson",
          accessType: "VIEW",
        }),
      });
    });

    it("should handle premium access logging failure gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockAuditPrisma.premiumAccessLog.create.mockRejectedValue(new Error("DB error"));

      await logPremiumAccess(mockReq as Request, {
        userId: "user-123",
        contentType: "EXAM",
        contentId: "exam-123",
        accessType: "COMPLETE",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AuditLog] Failed to log premium access:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para logAdminAction
  // ============================================
  describe("logAdminAction", () => {
    it("should log admin action successfully", async () => {
      mockAuditPrisma.adminActionLog.create.mockResolvedValue({ id: "admin-1" });

      await logAdminAction(mockAuthReq as AuthRequest, {
        adminId: "admin-123",
        adminEmail: "admin@example.com",
        action: "UPDATE_USER_ROLE",
        targetUserId: "user-456",
        oldValue: { role: "STUDENT_FREE" },
        newValue: { role: "STUDENT_PREMIUM" },
        success: true,
      });

      expect(mockAuditPrisma.adminActionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: "admin-123",
          adminEmail: "admin@example.com",
          action: "UPDATE_USER_ROLE",
          targetUserId: "user-456",
          success: true,
        }),
      });
    });

    it("should handle admin action logging failure gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockAuditPrisma.adminActionLog.create.mockRejectedValue(new Error("DB error"));

      await logAdminAction(mockAuthReq as AuthRequest, {
        adminId: "admin-123",
        action: "DELETE_USER",
        success: false,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AuditLog] Failed to log admin action:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para getActivityLogs (endpoint)
  // ============================================
  describe("getActivityLogs", () => {
    it("should return activity logs with pagination", async () => {
      const mockLogs = [
        { id: "1", action: "LOGIN", userId: "user-1" },
        { id: "2", action: "LOGOUT", userId: "user-1" },
      ];
      mockAuditPrisma.userActivityLog.findMany.mockResolvedValue(mockLogs);
      mockAuditPrisma.userActivityLog.count.mockResolvedValue(2);

      mockAuthReq.query = { page: "1", limit: "50" };

      await getActivityLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockLogs,
        pagination: {
          page: 1,
          limit: 50,
          total: 2,
          pages: 1,
        },
      });
    });

    it("should filter by userId and action", async () => {
      mockAuditPrisma.userActivityLog.findMany.mockResolvedValue([]);
      mockAuditPrisma.userActivityLog.count.mockResolvedValue(0);

      mockAuthReq.query = { userId: "user-123", action: "LOGIN" };

      await getActivityLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockAuditPrisma.userActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-123",
            action: "LOGIN",
          }),
        })
      );
    });

    it("should filter by date range", async () => {
      mockAuditPrisma.userActivityLog.findMany.mockResolvedValue([]);
      mockAuditPrisma.userActivityLog.count.mockResolvedValue(0);

      mockAuthReq.query = {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      };

      await getActivityLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockAuditPrisma.userActivityLog.findMany).toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockAuditPrisma.userActivityLog.findMany.mockRejectedValue(new Error("DB error"));

      await getActivityLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Failed to fetch activity logs",
      });
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para getSecurityLogs (endpoint)
  // ============================================
  describe("getSecurityLogs", () => {
    it("should return security logs with pagination", async () => {
      const mockLogs = [
        { id: "1", event: "FAILED_LOGIN", severity: "MEDIUM" },
      ];
      mockAuditPrisma.securityLog.findMany.mockResolvedValue(mockLogs);
      mockAuditPrisma.securityLog.count.mockResolvedValue(1);

      mockAuthReq.query = { page: "1", limit: "50" };

      await getSecurityLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockLogs,
        pagination: expect.any(Object),
      });
    });

    it("should filter by severity and resolved status", async () => {
      mockAuditPrisma.securityLog.findMany.mockResolvedValue([]);
      mockAuditPrisma.securityLog.count.mockResolvedValue(0);

      mockAuthReq.query = { severity: "HIGH", resolved: "true" };

      await getSecurityLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockAuditPrisma.securityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severity: "HIGH",
            resolved: true,
          }),
        })
      );
    });

    it("should handle errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockAuditPrisma.securityLog.findMany.mockRejectedValue(new Error("DB error"));

      await getSecurityLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para getErrorLogs (endpoint)
  // ============================================
  describe("getErrorLogs", () => {
    it("should return error logs with pagination", async () => {
      const mockLogs = [
        { id: "1", errorType: "ValidationError", message: "Invalid input" },
      ];
      mockAuditPrisma.errorLog.findMany.mockResolvedValue(mockLogs);
      mockAuditPrisma.errorLog.count.mockResolvedValue(1);

      mockAuthReq.query = { page: "1", limit: "50" };

      await getErrorLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockLogs,
        pagination: expect.any(Object),
      });
    });

    it("should filter by errorType and endpoint", async () => {
      mockAuditPrisma.errorLog.findMany.mockResolvedValue([]);
      mockAuditPrisma.errorLog.count.mockResolvedValue(0);

      mockAuthReq.query = { errorType: "ValidationError", endpoint: "/api/users" };

      await getErrorLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockAuditPrisma.errorLog.findMany).toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockAuditPrisma.errorLog.findMany.mockRejectedValue(new Error("DB error"));

      await getErrorLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para getPremiumAccessLogs (endpoint)
  // ============================================
  describe("getPremiumAccessLogs", () => {
    it("should return premium access logs with pagination", async () => {
      const mockLogs = [
        { id: "1", contentType: "LESSON", userId: "user-1" },
      ];
      mockAuditPrisma.premiumAccessLog.findMany.mockResolvedValue(mockLogs);
      mockAuditPrisma.premiumAccessLog.count.mockResolvedValue(1);

      mockAuthReq.query = { page: "1", limit: "50" };

      await getPremiumAccessLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockLogs,
        pagination: expect.any(Object),
      });
    });

    it("should filter by contentType and contentId", async () => {
      mockAuditPrisma.premiumAccessLog.findMany.mockResolvedValue([]);
      mockAuditPrisma.premiumAccessLog.count.mockResolvedValue(0);

      mockAuthReq.query = { contentType: "EXAM", contentId: "exam-123" };

      await getPremiumAccessLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockAuditPrisma.premiumAccessLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contentType: "EXAM",
            contentId: "exam-123",
          }),
        })
      );
    });

    it("should handle errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockAuditPrisma.premiumAccessLog.findMany.mockRejectedValue(new Error("DB error"));

      await getPremiumAccessLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para getAdminActionLogs (endpoint)
  // ============================================
  describe("getAdminActionLogs", () => {
    it("should return admin action logs with pagination", async () => {
      const mockLogs = [
        { id: "1", action: "UPDATE_USER_ROLE", adminId: "admin-1" },
      ];
      mockAuditPrisma.adminActionLog.findMany.mockResolvedValue(mockLogs);
      mockAuditPrisma.adminActionLog.count.mockResolvedValue(1);

      mockAuthReq.query = { page: "1", limit: "50" };

      await getAdminActionLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockLogs,
        pagination: expect.any(Object),
      });
    });

    it("should filter by adminId and action", async () => {
      mockAuditPrisma.adminActionLog.findMany.mockResolvedValue([]);
      mockAuditPrisma.adminActionLog.count.mockResolvedValue(0);

      mockAuthReq.query = { adminId: "admin-123", action: "DELETE_USER" };

      await getAdminActionLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockAuditPrisma.adminActionLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            adminId: "admin-123",
            action: "DELETE_USER",
          }),
        })
      );
    });

    it("should handle errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockAuditPrisma.adminActionLog.findMany.mockRejectedValue(new Error("DB error"));

      await getAdminActionLogs(mockAuthReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para Enums
  // ============================================
  describe("Enums", () => {
    it("should have correct ActivityAction values", () => {
      expect(ActivityAction.LOGIN).toBe("LOGIN");
      expect(ActivityAction.LOGOUT).toBe("LOGOUT");
      expect(ActivityAction.VIEW_LESSON).toBe("VIEW_LESSON");
      expect(ActivityAction.START_EXAM).toBe("START_EXAM");
    });

    it("should have correct SecurityEvent values", () => {
      expect(SecurityEvent.FAILED_LOGIN).toBe("FAILED_LOGIN");
      expect(SecurityEvent.ACCOUNT_LOCKED).toBe("ACCOUNT_LOCKED");
      expect(SecurityEvent.UNAUTHORIZED_ACCESS).toBe("UNAUTHORIZED_ACCESS");
    });

    it("should have correct SecuritySeverity values", () => {
      expect(SecuritySeverity.LOW).toBe("LOW");
      expect(SecuritySeverity.MEDIUM).toBe("MEDIUM");
      expect(SecuritySeverity.HIGH).toBe("HIGH");
      expect(SecuritySeverity.CRITICAL).toBe("CRITICAL");
    });

    it("should have correct ResourceType values", () => {
      expect(ResourceType.LESSON).toBe("LESSON");
      expect(ResourceType.EXAM).toBe("EXAM");
      expect(ResourceType.PROFILE).toBe("PROFILE");
    });
  });
});

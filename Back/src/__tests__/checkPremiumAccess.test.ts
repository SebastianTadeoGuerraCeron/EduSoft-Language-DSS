import { Response, NextFunction } from "express";
import {
  checkPremiumAccess,
  checkLessonPremiumAccess,
  checkExamPremiumAccess,
  markPremiumContent,
} from "../middleware/checkPremiumAccess";
import { AuthRequest } from "../middleware/auth";
import { PrismaClient } from "@prisma/client";
import { logSecurityEvent } from "../controllers/audit-ctrl";

// Mock de Prisma
jest.mock("@prisma/client", () => {
  const mockPrismaClient = {
    lesson: {
      findUnique: jest.fn(),
    },
    exam: {
      findUnique: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// Mock de logSecurityEvent
jest.mock("../controllers/audit-ctrl", () => ({
  logSecurityEvent: jest.fn(),
  SecurityEvent: {
    PREMIUM_ACCESS_DENIED: "PREMIUM_ACCESS_DENIED",
  },
  SecuritySeverity: {
    LOW: "LOW",
  },
}));

const prisma = new PrismaClient();

describe("Premium Access Middleware", () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      userId: "user123",
      userRole: "STUDENT_FREE",
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe("checkPremiumAccess", () => {
    it("should allow ADMIN without checks", () => {
      mockReq.userRole = "ADMIN";

      checkPremiumAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.requiresPremiumCheck).toBeUndefined();
    });

    it("should allow TUTOR without checks", () => {
      mockReq.userRole = "TUTOR";

      checkPremiumAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.requiresPremiumCheck).toBeUndefined();
    });

    it("should allow STUDENT_PRO without checks", () => {
      mockReq.userRole = "STUDENT_PRO";

      checkPremiumAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.requiresPremiumCheck).toBeUndefined();
    });

    it("should mark STUDENT_FREE for premium check", () => {
      mockReq.userRole = "STUDENT_FREE";

      checkPremiumAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.requiresPremiumCheck).toBe(true);
    });
  });

  describe("checkLessonPremiumAccess", () => {
    it("should allow ADMIN to access any lesson", async () => {
      mockReq.userRole = "ADMIN";
      mockReq.params = { id: "lesson123" };

      await checkLessonPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(prisma.lesson.findUnique).not.toHaveBeenCalled();
    });

    it("should allow TUTOR to access any lesson", async () => {
      mockReq.userRole = "TUTOR";
      mockReq.params = { id: "lesson123" };

      await checkLessonPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(prisma.lesson.findUnique).not.toHaveBeenCalled();
    });

    it("should allow STUDENT_PRO to access any lesson", async () => {
      mockReq.userRole = "STUDENT_PRO";
      mockReq.params = { id: "lesson123" };

      await checkLessonPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(prisma.lesson.findUnique).not.toHaveBeenCalled();
    });

    it("should return 404 if lesson not found", async () => {
      mockReq.userRole = "STUDENT_FREE";
      mockReq.params = { id: "nonexistent" };
      (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);

      await checkLessonPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Lesson not found",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should deny STUDENT_FREE access to premium lesson", async () => {
      mockReq.userRole = "STUDENT_FREE";
      mockReq.userId = "student123";
      mockReq.params = { id: "premiumLesson" };

      (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({
        id: "premiumLesson",
        isPremium: true,
        title: "Advanced Grammar",
      });

      await checkLessonPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Premium content",
        message: "This lesson requires a premium subscription",
        lessonTitle: "Advanced Grammar",
        upgradeRequired: true,
        code: "PREMIUM_REQUIRED",
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(logSecurityEvent).toHaveBeenCalled();
    });

    it("should allow STUDENT_FREE access to free lesson", async () => {
      mockReq.userRole = "STUDENT_FREE";
      mockReq.params = { id: "freeLesson" };

      (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({
        id: "freeLesson",
        isPremium: false,
        title: "Basic Grammar",
      });

      await checkLessonPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      mockReq.userRole = "STUDENT_FREE";
      mockReq.params = { id: "lesson123" };
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      (prisma.lesson.findUnique as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await checkLessonPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Internal server error",
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("checkExamPremiumAccess", () => {
    it("should allow ADMIN to access any exam", async () => {
      mockReq.userRole = "ADMIN";
      mockReq.params = { id: "exam123" };

      await checkExamPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(prisma.exam.findUnique).not.toHaveBeenCalled();
    });

    it("should allow TUTOR to access any exam", async () => {
      mockReq.userRole = "TUTOR";
      mockReq.params = { id: "exam123" };

      await checkExamPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(prisma.exam.findUnique).not.toHaveBeenCalled();
    });

    it("should allow STUDENT_PRO to access any exam", async () => {
      mockReq.userRole = "STUDENT_PRO";
      mockReq.params = { id: "exam123" };

      await checkExamPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(prisma.exam.findUnique).not.toHaveBeenCalled();
    });

    it("should return 404 if exam not found", async () => {
      mockReq.userRole = "STUDENT_FREE";
      mockReq.params = { id: "nonexistent" };
      (prisma.exam.findUnique as jest.Mock).mockResolvedValue(null);

      await checkExamPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Exam not found",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should deny STUDENT_FREE access to premium exam", async () => {
      mockReq.userRole = "STUDENT_FREE";
      mockReq.userId = "student123";
      mockReq.params = { id: "premiumExam" };

      (prisma.exam.findUnique as jest.Mock).mockResolvedValue({
        id: "premiumExam",
        isPremium: true,
        title: "Advanced Listening Exam",
      });

      await checkExamPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Premium content",
        message: "This exam requires a premium subscription",
        examTitle: "Advanced Listening Exam",
        upgradeRequired: true,
        code: "PREMIUM_REQUIRED",
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(logSecurityEvent).toHaveBeenCalled();
    });

    it("should allow STUDENT_FREE access to free exam", async () => {
      mockReq.userRole = "STUDENT_FREE";
      mockReq.params = { id: "freeExam" };

      (prisma.exam.findUnique as jest.Mock).mockResolvedValue({
        id: "freeExam",
        isPremium: false,
        title: "Basic Vocabulary Exam",
      });

      await checkExamPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      mockReq.userRole = "STUDENT_FREE";
      mockReq.params = { id: "exam123" };
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      (prisma.exam.findUnique as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await checkExamPremiumAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Internal server error",
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("markPremiumContent", () => {
    it("should mark ADMIN as can access premium", () => {
      mockReq.userRole = "ADMIN";

      markPremiumContent(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.canAccessPremium).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should mark TUTOR as can access premium", () => {
      mockReq.userRole = "TUTOR";

      markPremiumContent(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.canAccessPremium).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should mark STUDENT_PRO as can access premium", () => {
      mockReq.userRole = "STUDENT_PRO";

      markPremiumContent(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.canAccessPremium).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should mark STUDENT_FREE as cannot access premium", () => {
      mockReq.userRole = "STUDENT_FREE";

      markPremiumContent(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.canAccessPremium).toBe(false);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle undefined role", () => {
      delete mockReq.userRole;

      markPremiumContent(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.canAccessPremium).toBe(false);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

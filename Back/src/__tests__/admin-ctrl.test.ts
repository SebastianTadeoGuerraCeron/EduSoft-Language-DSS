import { PrismaClient } from "@prisma/client";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import {
  getAllUsersCtrl,
  updateUserRoleCtrl,
  getSystemStatsCtrl,
} from "../controllers/admin-ctrl";

// Mock Prisma
jest.mock("@prisma/client", () => {
  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    gameHistory: {
      count: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

// Mock audit controller
jest.mock("../controllers/audit-ctrl", () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  SecurityEvent: {
    ROLE_CHANGE: "ROLE_CHANGE",
  },
  SecuritySeverity: {
    HIGH: "HIGH",
  },
}));

describe("Admin Controller Tests", () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let prisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();

    mockRequest = {
      userId: "1",
      params: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("getAllUsersCtrl", () => {
    it("should return all users successfully", async () => {
      const mockUsers = [
        {
          id: "1",
          email: "user1@test.com",
          username: "user1",
          role: "STUDENT_FREE",
          createdAt: new Date(),
          updatedAt: new Date(),
          profilePicture: "pic1.jpg",
          _count: { gameHistory: 5 },
        },
        {
          id: "2",
          email: "user2@test.com",
          username: "user2",
          role: "TUTOR",
          createdAt: new Date(),
          updatedAt: new Date(),
          profilePicture: "pic2.jpg",
          _count: { gameHistory: 10 },
        },
      ];

      prisma.user.findMany.mockResolvedValue(mockUsers);

      await getAllUsersCtrl(mockRequest as AuthRequest, mockResponse as Response);

      expect(prisma.user.findMany).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({ users: mockUsers });
    });

    it("should handle database errors gracefully", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("Database error"));

      await getAllUsersCtrl(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Internal server error",
      });
    });
  });

  describe("updateUserRoleCtrl", () => {
    it("should update user role successfully", async () => {
      mockRequest.params = { id: "user-2" };
      mockRequest.body = { role: "TUTOR" };

      const mockUser = {
        id: "user-2",
        email: "user@test.com",
        username: "user",
        role: "STUDENT_FREE",
      };

      const mockUpdatedUser = {
        id: "user-2",
        email: "user@test.com",
        username: "user",
        role: "TUTOR",
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUpdatedUser);

      await updateUserRoleCtrl(mockRequest as AuthRequest, mockResponse as Response);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-2" },
      });
      expect(prisma.user.update).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "User role updated successfully",
        user: mockUpdatedUser,
      });
    });

    it("should return 400 if role is invalid", async () => {
      mockRequest.params = { id: "user-2" };
      mockRequest.body = { role: "INVALID_ROLE" };

      await updateUserRoleCtrl(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Invalid role",
        validRoles: ["ADMIN", "TUTOR", "STUDENT_PRO", "STUDENT_FREE"],
      });
    });

    it("should return 400 if role is missing", async () => {
      mockRequest.params = { id: "user-2" };
      mockRequest.body = {};

      await updateUserRoleCtrl(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 if user not found", async () => {
      mockRequest.params = { id: "nonexistent" };
      mockRequest.body = { role: "TUTOR" };

      prisma.user.findUnique.mockResolvedValue(null);

      await updateUserRoleCtrl(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "User not found",
      });
    });

    it("should handle database errors gracefully", async () => {
      mockRequest.params = { id: "user-2" };
      mockRequest.body = { role: "TUTOR" };

      prisma.user.findUnique.mockRejectedValue(new Error("Database error"));

      await updateUserRoleCtrl(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Internal server error",
      });
    });
  });

  describe("getSystemStatsCtrl", () => {
    it("should return system statistics successfully", async () => {
      prisma.user.count.mockResolvedValue(100);
      prisma.gameHistory.count.mockResolvedValue(500);
      prisma.user.groupBy.mockResolvedValue([
        { role: "STUDENT_FREE", _count: 80 },
        { role: "TUTOR", _count: 15 },
        { role: "ADMIN", _count: 5 },
      ]);
      prisma.user.findMany.mockResolvedValue([]);

      await getSystemStatsCtrl(mockRequest as AuthRequest, mockResponse as Response);

      expect(prisma.user.count).toHaveBeenCalled();
      expect(prisma.gameHistory.count).toHaveBeenCalled();
      expect(prisma.user.groupBy).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        totalUsers: 100,
        totalGames: 500,
        usersByRole: expect.any(Array),
        recentUsers: expect.any(Array),
      });
    });

    it("should handle database errors gracefully", async () => {
      prisma.user.count.mockRejectedValue(new Error("Database error"));

      await getSystemStatsCtrl(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Internal server error",
      });
    });
  });
});

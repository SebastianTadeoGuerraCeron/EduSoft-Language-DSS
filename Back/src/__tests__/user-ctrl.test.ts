/**
 * Tests para user-ctrl.ts
 * Cubre: registro, login, recuperación de contraseña, perfil, etc.
 */

import type { Request, Response } from "express";

// Mock de Prisma
const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  gameHistory: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

// Mock de security utils
jest.mock("../utils/security", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed-password"),
  comparePassword: jest.fn(),
  generateToken: jest.fn().mockReturnValue("test-token"),
  isStrongPassword: jest.fn().mockReturnValue(true),
  isValidEmail: jest.fn().mockReturnValue(true),
  sanitizeInput: jest.fn((input) => input),
}));

// Mock de passwordValidation middleware
jest.mock("../middleware/passwordValidation", () => ({
  validateStrongPassword: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
}));

// Mock de securityLogger
jest.mock("../utils/securityLogger", () => ({
  logRegistrationFailed: jest.fn(),
  logRegistrationSuccess: jest.fn(),
  logWeakPasswordAttempt: jest.fn(),
}));

// Mock de audit-ctrl
jest.mock("../controllers/audit-ctrl", () => ({
  logUserActivity: jest.fn(),
  logSecurityEvent: jest.fn(),
  ActivityAction: {
    REGISTER: "REGISTER",
    LOGIN: "LOGIN",
    UPDATE_PROFILE: "UPDATE_PROFILE",
    CHANGE_PASSWORD: "CHANGE_PASSWORD",
    COMPLETE_GAME: "COMPLETE_GAME",
  },
  SecurityEvent: {
    FAILED_LOGIN: "FAILED_LOGIN",
    ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
    PASSWORD_CHANGE: "PASSWORD_CHANGE",
  },
  SecuritySeverity: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
  },
  ResourceType: {
    GAME: "GAME",
    PROFILE: "PROFILE",
  },
}));

// Mock de nodemailer
jest.mock("../nodemailer", () => ({
  transporter: {
    sendMail: jest.fn().mockResolvedValue({ messageId: "test-id" }),
  },
}));

import { comparePassword, isValidEmail } from "../utils/security";
import { validateStrongPassword } from "../middleware/passwordValidation";
import {
  createUserCtrl,
  loginUserCtrl,
  recoverPasswordCtrl,
  updateProfileCtrl,
  addGameHistory,
  getUserProgress,
} from "../controllers/user-ctrl";

describe("user-ctrl", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      body: {},
      query: {},
      params: {},
      headers: { "user-agent": "test" },
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" } as any,
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  // ============================================
  // Tests para createUserCtrl (Registro)
  // ============================================
  describe("createUserCtrl", () => {
    it("should create a user successfully", async () => {
      mockReq.body = {
        email: "test@example.com",
        username: "testuser",
        password: "StrongPass123!",
        answerSecret: "secret answer",
        role: "STUDENT_FREE",
      };

      const createdUser = {
        id: "user-1",
        email: "test@example.com",
        username: "testuser",
        role: "STUDENT_FREE",
        profilePicture: "default-profile-picture.jpg",
      };

      mockPrisma.user.create.mockResolvedValue(createdUser);

      await createUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "User created successfully",
        user: expect.objectContaining({
          id: "user-1",
          email: "test@example.com",
        }),
      });
    });

    it("should return 400 when required fields are missing", async () => {
      mockReq.body = { email: "test@example.com" };

      await createUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "All fields are required",
      });
    });

    it("should return 400 for invalid email", async () => {
      mockReq.body = {
        email: "invalid-email",
        username: "testuser",
        password: "StrongPass123!",
        answerSecret: "secret",
      };

      (isValidEmail as jest.Mock).mockReturnValueOnce(false);

      await createUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid email format",
      });
    });

    it("should return 400 for weak password", async () => {
      mockReq.body = {
        email: "test@example.com",
        username: "testuser",
        password: "weak",
        answerSecret: "secret",
      };

      (validateStrongPassword as jest.Mock).mockReturnValueOnce({
        isValid: false,
        errors: ["Password too short"],
      });

      await createUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Password does not meet security requirements",
        details: ["Password too short"],
      });
    });

    it("should return 409 when email is already registered", async () => {
      mockReq.body = {
        email: "existing@example.com",
        username: "testuser",
        password: "StrongPass123!",
        answerSecret: "secret",
      };

      mockPrisma.user.create.mockRejectedValue({ code: "P2002" });

      await createUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "This email is already registered. Please use a different email or try logging in.",
      });
    });

    it("should handle database errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockReq.body = {
        email: "test@example.com",
        username: "testuser",
        password: "StrongPass123!",
        answerSecret: "secret",
      };

      mockPrisma.user.create.mockRejectedValue(new Error("DB error"));

      await createUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para loginUserCtrl
  // ============================================
  describe("loginUserCtrl", () => {
    it("should login successfully", async () => {
      mockReq.body = {
        email: "test@example.com",
        password: "StrongPass123!",
      };

      const user = {
        id: "user-1",
        email: "test@example.com",
        username: "testuser",
        password: "hashed-password",
        role: "STUDENT_FREE",
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        profilePicture: "default.jpg",
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);
      (comparePassword as jest.Mock).mockResolvedValue(true);

      await loginUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Login successful",
          token: "test-token",
        })
      );
    });

    it("should return 400 when email or password missing", async () => {
      mockReq.body = { email: "test@example.com" };

      await loginUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Email and password are required",
      });
    });

    it("should return 400 for invalid email format", async () => {
      mockReq.body = { email: "invalid", password: "pass" };
      (isValidEmail as jest.Mock).mockReturnValueOnce(false);

      await loginUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid email format",
      });
    });

    it("should return 401 when user not found", async () => {
      mockReq.body = { email: "notfound@example.com", password: "pass" };
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await loginUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid credentials",
      });
    });

    it("should return 403 when account is locked", async () => {
      mockReq.body = { email: "locked@example.com", password: "pass" };

      const lockedUser = {
        id: "user-1",
        email: "locked@example.com",
        password: "hashed",
        failedLoginAttempts: 3,
        lockedUntil: new Date(Date.now() + 5 * 60 * 1000), // 5 min in future
      };

      mockPrisma.user.findUnique.mockResolvedValue(lockedUser);

      await loginUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Account is locked"),
        })
      );
    });

    it("should increment failed attempts on wrong password", async () => {
      mockReq.body = { email: "test@example.com", password: "wrongpass" };

      const user = {
        id: "user-1",
        email: "test@example.com",
        username: "testuser",
        password: "hashed-password",
        failedLoginAttempts: 1,
        lockedUntil: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user, failedLoginAttempts: 2 });
      (comparePassword as jest.Mock).mockResolvedValue(false);

      await loginUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("attempt"),
        })
      );
    });

    it("should lock account after 3 failed attempts", async () => {
      mockReq.body = { email: "test@example.com", password: "wrongpass" };

      const user = {
        id: "user-1",
        email: "test@example.com",
        username: "testuser",
        password: "hashed-password",
        failedLoginAttempts: 2, // This will be the 3rd attempt
        lockedUntil: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user, failedLoginAttempts: 3 });
      (comparePassword as jest.Mock).mockResolvedValue(false);

      await loginUserCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Account locked"),
        })
      );
    });
  });

  // ============================================
  // Tests para recoverPasswordCtrl
  // ============================================
  describe("recoverPasswordCtrl", () => {
    it("should recover password successfully", async () => {
      mockReq.body = {
        email: "test@example.com",
        answerSecret: "correct answer",
        newPassword: "NewStrongPass123!",
      };

      const user = {
        id: "user-1",
        email: "test@example.com",
        username: "testuser",
        answerSecret: "hashed-answer",
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user });
      (comparePassword as jest.Mock).mockResolvedValue(true);

      await recoverPasswordCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Password updated successfully",
      });
    });

    it("should return 400 when fields are missing", async () => {
      mockReq.body = { email: "test@example.com" };

      await recoverPasswordCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "All fields are required",
      });
    });

    it("should return 404 when user not found", async () => {
      mockReq.body = {
        email: "notfound@example.com",
        answerSecret: "answer",
        newPassword: "NewPass123!",
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await recoverPasswordCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "User not found" });
    });

    it("should return 401 for incorrect secret answer", async () => {
      mockReq.body = {
        email: "test@example.com",
        answerSecret: "wrong answer",
        newPassword: "NewPass123!",
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        answerSecret: "hashed-answer",
      });
      (comparePassword as jest.Mock).mockResolvedValue(false);

      await recoverPasswordCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Secret answer is incorrect",
      });
    });
  });

  // ============================================
  // Tests para updateProfileCtrl
  // ============================================
  describe("updateProfileCtrl", () => {
    it("should update profile successfully", async () => {
      mockReq.body = {
        email: "test@example.com",
        username: "newusername",
        profilePicture: "new-picture.jpg",
      };

      const user = {
        id: "user-1",
        email: "test@example.com",
        username: "oldusername",
        role: "STUDENT_FREE",
        profilePicture: "old.jpg",
      };

      const updatedUser = {
        ...user,
        username: "newusername",
        profilePicture: "new-picture.jpg",
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      await updateProfileCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        user: expect.objectContaining({
          username: "newusername",
          profilePicture: "new-picture.jpg",
        }),
      });
    });

    it("should return 404 when user not found", async () => {
      mockReq.body = { email: "notfound@example.com" };
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await updateProfileCtrl(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  // ============================================
  // Tests para addGameHistory
  // ============================================
  describe("addGameHistory", () => {
    it("should add game history successfully", async () => {
      mockReq.body = {
        userId: "user-123",
        game: "memory",
        score: 95,
      };

      const gameRecord = {
        id: "game-1",
        userId: "user-123",
        game: "memory",
        score: 95,
        playedAt: new Date(),
      };

      mockPrisma.gameHistory.create.mockResolvedValue(gameRecord);

      await addGameHistory(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(gameRecord);
    });

    it("should handle database errors", async () => {
      mockReq.body = { userId: "user-123", game: "memory", score: 95 };
      mockPrisma.gameHistory.create.mockRejectedValue(new Error("DB error"));

      await addGameHistory(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Error saving game history",
      });
    });
  });

  // ============================================
  // Tests para getUserProgress
  // ============================================
  describe("getUserProgress", () => {
    it("should return user progress", async () => {
      mockReq.query = { userId: "user-123" };

      const history = [
        { id: "g1", game: "memory", score: 80, playedAt: new Date() },
        { id: "g2", game: "words", score: 90, playedAt: new Date() },
      ];

      mockPrisma.gameHistory.findMany.mockResolvedValue(history);

      await getUserProgress(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        gamesPlayed: 2,
        averageScore: 85,
        history,
      });
    });

    it("should return zero averages for no games", async () => {
      mockReq.query = { userId: "user-new" };
      mockPrisma.gameHistory.findMany.mockResolvedValue([]);

      await getUserProgress(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        gamesPlayed: 0,
        averageScore: 0,
        history: [],
      });
    });
  });
});

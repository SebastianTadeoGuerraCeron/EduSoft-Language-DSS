/**
 * Tests para file-ctrl.ts
 * Cubre: subida, descarga y gestión de archivos de lecciones
 */

import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";

// Mock de Prisma
const mockPrisma = {
  lesson: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

// Mock de github-storage
jest.mock("../utils/github-storage", () => ({
  uploadFileToGitHub: jest.fn(),
  downloadFileFromGitHub: jest.fn(),
  deleteFileFromGitHub: jest.fn(),
  listFilesFromGitHub: jest.fn(),
  testGitHubConnection: jest.fn(),
}));

// Mock de audit-ctrl
jest.mock("../controllers/audit-ctrl", () => ({
  logUserActivity: jest.fn(),
  logAdminAction: jest.fn(),
  ActivityAction: {
    DOWNLOAD_LESSON_FILE: "DOWNLOAD_LESSON_FILE",
  },
  ResourceType: {
    LESSON: "LESSON",
  },
}));

// Mock de multer
jest.mock("multer", () => {
  const multerMock = () => ({
    single: () => (_req: any, _res: any, next: any) => next(),
  });
  multerMock.memoryStorage = jest.fn();
  return multerMock;
});

import {
  downloadFileFromGitHub,
  deleteFileFromGitHub,
  listFilesFromGitHub,
  testGitHubConnection,
} from "../utils/github-storage";
import {
  listLessonFilesCtrl,
  deleteLessonFileCtrl,
  downloadLessonFileCtrl,
  checkGitHubStatusCtrl,
} from "../controllers/file-ctrl";

describe("file-ctrl", () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      userId: "tutor-123",
      params: {},
      body: {},
      query: {},
      headers: { "user-agent": "test" },
      ip: "127.0.0.1",
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn(),
      send: jest.fn(),
    };
  });

  // ============================================
  // Tests para listLessonFilesCtrl
  // ============================================
  describe("listLessonFilesCtrl", () => {
    it("should return files for a lesson", async () => {
      mockReq.params = { lessonId: "lesson-123" };

      const mockFiles = [
        { name: "file1.pdf", sha: "sha1", size: 1024 },
        { name: "file2.pdf", sha: "sha2", size: 2048 },
      ];

      (listFilesFromGitHub as jest.Mock).mockResolvedValue(mockFiles);

      await listLessonFilesCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(listFilesFromGitHub).toHaveBeenCalledWith("lesson-123");
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        files: mockFiles,
      });
    });

    it("should handle empty files list", async () => {
      mockReq.params = { lessonId: "lesson-empty" };
      (listFilesFromGitHub as jest.Mock).mockResolvedValue([]);

      await listLessonFilesCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        files: [],
      });
    });

    it("should handle errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockReq.params = { lessonId: "lesson-123" };
      (listFilesFromGitHub as jest.Mock).mockRejectedValue(new Error("GitHub error"));

      await listLessonFilesCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Error"),
        })
      );
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para deleteLessonFileCtrl
  // ============================================
  describe("deleteLessonFileCtrl", () => {
    it("should delete a file successfully", async () => {
      mockReq.params = { lessonId: "lesson-123", fileName: "file.pdf" };

      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: "lesson-123",
        createdBy: "tutor-123",
      });

      (deleteFileFromGitHub as jest.Mock).mockResolvedValue({
        success: true,
        message: "File deleted",
      });

      await deleteLessonFileCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(deleteFileFromGitHub).toHaveBeenCalledWith({
        lessonId: "lesson-123",
        fileName: "file.pdf",
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "File deleted successfully",
      });
    });

    it("should return 401 when no userId", async () => {
      mockReq.userId = undefined;
      mockReq.params = { lessonId: "lesson-123", fileName: "file.pdf" };

      await deleteLessonFileCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 404 when lesson not found", async () => {
      mockReq.params = { lessonId: "nonexistent", fileName: "file.pdf" };
      mockPrisma.lesson.findUnique.mockResolvedValue(null);

      await deleteLessonFileCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Lesson not found" });
    });

    it("should return 403 when not lesson owner", async () => {
      mockReq.params = { lessonId: "lesson-123", fileName: "file.pdf" };
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: "lesson-123",
        createdBy: "other-tutor",
      });

      await deleteLessonFileCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it("should handle GitHub errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockReq.params = { lessonId: "lesson-123", fileName: "file.pdf" };

      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: "lesson-123",
        createdBy: "tutor-123",
      });

      (deleteFileFromGitHub as jest.Mock).mockRejectedValue(new Error("GitHub error"));

      await deleteLessonFileCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para downloadLessonFileCtrl
  // ============================================
  describe("downloadLessonFileCtrl", () => {
    it("should download a file successfully", async () => {
      mockReq.params = { lessonId: "lesson-123", fileName: "document.pdf" };

      const mockFileContent = Buffer.from("PDF content");
      (downloadFileFromGitHub as jest.Mock).mockResolvedValue({
        content: mockFileContent,
        name: "document.pdf",
      });

      await downloadLessonFileCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(downloadFileFromGitHub).toHaveBeenCalledWith({
        lessonId: "lesson-123",
        fileName: "document.pdf",
      });
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          "Content-Type": "application/pdf",
        })
      );
      expect(mockRes.send).toHaveBeenCalledWith(mockFileContent);
    });

    it("should handle file not found", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockReq.params = { lessonId: "lesson-123", fileName: "notfound.pdf" };

      (downloadFileFromGitHub as jest.Mock).mockRejectedValue(new Error("File not found"));

      await downloadLessonFileCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para checkGitHubStatusCtrl
  // ============================================
  describe("checkGitHubStatusCtrl", () => {
    it("should return success when GitHub connection works", async () => {
      (testGitHubConnection as jest.Mock).mockResolvedValue({
        success: true,
        message: "Connection successful",
        repoInfo: {
          name: "repo-name",
          owner: "owner",
        },
      });

      await checkGitHubStatusCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it("should return error when GitHub connection fails", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (testGitHubConnection as jest.Mock).mockRejectedValue(new Error("Connection failed"));

      await checkGitHubStatusCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });
});

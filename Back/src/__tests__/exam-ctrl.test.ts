/**
 * Tests para exam-ctrl.ts
 * Cubre: CRUD de exámenes, intentos de examen, y estadísticas
 */

import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";

// Mock de Prisma
const mockPrisma: any = {
  exam: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  question: {
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
  lesson: {
    findUnique: jest.fn(),
  },
  examAttempt: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(mockPrisma)),
};

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

// Mock de audit-ctrl
jest.mock("../controllers/audit-ctrl", () => ({
  logUserActivity: jest.fn(),
  logPremiumAccess: jest.fn(),
  logAdminAction: jest.fn(),
  ActivityAction: {
    VIEW_EXAM: "VIEW_EXAM",
    START_EXAM: "START_EXAM",
    SUBMIT_EXAM: "SUBMIT_EXAM",
    VIEW_EXAM_RESULTS: "VIEW_EXAM_RESULTS",
  },
  ResourceType: {
    EXAM: "EXAM",
  },
}));

import {
  createExamCtrl,
  updateExamCtrl,
  deleteExamCtrl,
  getAllExamsCtrl,
  getExamByIdCtrl,
} from "../controllers/exam-ctrl";

describe("exam-ctrl", () => {
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
    };
  });

  // ============================================
  // Tests para createExamCtrl
  // ============================================
  describe("createExamCtrl", () => {
    it("should create an exam successfully", async () => {
      mockReq.body = {
        title: "Test Exam",
        description: "Test Description",
        lessonId: "lesson-123",
        timeLimit: 30,
        passingPercentage: 70,
        isPremium: false,
        questions: [
          {
            text: "Question 1?",
            type: "MULTIPLE_CHOICE",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
            points: 1,
          },
        ],
      };

      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: "lesson-123",
        createdBy: "tutor-123",
        title: "Test Lesson",
      });

      const createdExam = {
        id: "exam-1",
        title: "Test Exam",
        description: "Test Description",
        lessonId: "lesson-123",
        timeLimit: 30,
        passingPercentage: 70,
        createdBy: "tutor-123",
        questions: [{ id: "q-1", text: "Question 1?", order: 1 }],
        lesson: { id: "lesson-123", title: "Test Lesson" },
        tutor: { id: "tutor-123", username: "tutor" },
      };

      mockPrisma.exam.create.mockResolvedValue(createdExam);

      await createExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ exam: createdExam });
    });

    it("should return 401 when no userId", async () => {
      mockReq.userId = undefined;
      mockReq.body = { title: "Test" };

      await createExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("should return 400 when required fields are missing", async () => {
      mockReq.body = { title: "Only Title" };

      await createExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Title, description, lessonId and timeLimit are required",
      });
    });

    it("should return 404 when lesson not found", async () => {
      mockReq.body = {
        title: "Test",
        description: "Test",
        lessonId: "nonexistent",
        timeLimit: 30,
        questions: [{ text: "Q1", correctAnswer: "A" }],
      };

      mockPrisma.lesson.findUnique.mockResolvedValue(null);

      await createExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Lesson not found" });
    });

    it("should return 403 when not lesson owner", async () => {
      mockReq.body = {
        title: "Test",
        description: "Test",
        lessonId: "lesson-123",
        timeLimit: 30,
        questions: [{ text: "Q1", correctAnswer: "A" }],
      };

      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: "lesson-123",
        createdBy: "other-tutor",
      });

      await createExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "You can only create exams for your own lessons",
      });
    });

    it("should return 400 when no questions provided", async () => {
      mockReq.body = {
        title: "Test",
        description: "Test",
        lessonId: "lesson-123",
        timeLimit: 30,
        questions: [],
      };

      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: "lesson-123",
        createdBy: "tutor-123",
      });

      await createExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "At least one question is required",
      });
    });

    it("should handle database errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockReq.body = {
        title: "Test",
        description: "Test",
        lessonId: "lesson-123",
        timeLimit: 30,
        questions: [{ text: "Q1", correctAnswer: "A" }],
      };

      mockPrisma.lesson.findUnique.mockRejectedValue(new Error("DB error"));

      await createExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para updateExamCtrl
  // ============================================
  describe("updateExamCtrl", () => {
    it("should update an exam successfully", async () => {
      mockReq.params = { id: "exam-123" };
      mockReq.body = {
        title: "Updated Exam",
        description: "Updated Description",
        timeLimit: 45,
        questions: [{ text: "New Question?", correctAnswer: "B" }],
      };

      mockPrisma.exam.findUnique.mockResolvedValue({
        id: "exam-123",
        createdBy: "tutor-123",
      });

      const updatedExam = {
        id: "exam-123",
        title: "Updated Exam",
        description: "Updated Description",
        timeLimit: 45,
        questions: [{ id: "q-new", text: "New Question?", order: 1 }],
      };

      mockPrisma.question.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.exam.update.mockResolvedValue(updatedExam);

      await updateExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({ exam: updatedExam });
    });

    it("should return 401 when no userId", async () => {
      mockReq.userId = undefined;
      mockReq.params = { id: "exam-123" };

      await updateExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 404 when exam not found", async () => {
      mockReq.params = { id: "nonexistent" };
      mockReq.body = { title: "Test", timeLimit: 30, questions: [{ text: "Q", correctAnswer: "A" }] };
      mockPrisma.exam.findUnique.mockResolvedValue(null);

      await updateExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Exam not found" });
    });

    it("should return 403 when not exam owner", async () => {
      mockReq.params = { id: "exam-123" };
      mockReq.body = { title: "Test", timeLimit: 30, questions: [{ text: "Q", correctAnswer: "A" }] };

      mockPrisma.exam.findUnique.mockResolvedValue({
        id: "exam-123",
        createdBy: "other-tutor",
      });

      await updateExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it("should return 400 when title or timeLimit missing", async () => {
      mockReq.params = { id: "exam-123" };
      mockReq.body = { questions: [{ text: "Q", correctAnswer: "A" }] };

      mockPrisma.exam.findUnique.mockResolvedValue({
        id: "exam-123",
        createdBy: "tutor-123",
      });

      await updateExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Title and timeLimit are required",
      });
    });

    it("should return 400 when no questions", async () => {
      mockReq.params = { id: "exam-123" };
      mockReq.body = { title: "Test", timeLimit: 30, questions: [] };

      mockPrisma.exam.findUnique.mockResolvedValue({
        id: "exam-123",
        createdBy: "tutor-123",
      });

      await updateExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "At least one question is required",
      });
    });
  });

  // ============================================
  // Tests para deleteExamCtrl
  // ============================================
  describe("deleteExamCtrl", () => {
    it("should delete an exam successfully", async () => {
      mockReq.params = { id: "exam-123" };

      mockPrisma.exam.findUnique.mockResolvedValue({
        id: "exam-123",
        createdBy: "tutor-123",
        title: "Exam to Delete",
      });

      mockPrisma.exam.delete.mockResolvedValue({ id: "exam-123" });

      await deleteExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Exam deleted successfully",
      });
    });

    it("should return 401 when no userId", async () => {
      mockReq.userId = undefined;
      mockReq.params = { id: "exam-123" };

      await deleteExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 404 when exam not found", async () => {
      mockReq.params = { id: "nonexistent" };
      mockPrisma.exam.findUnique.mockResolvedValue(null);

      await deleteExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("should return 403 when not exam owner", async () => {
      mockReq.params = { id: "exam-123" };
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: "exam-123",
        createdBy: "other-tutor",
      });

      await deleteExamCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  // ============================================
  // Tests para getAllExamsCtrl
  // ============================================
  describe("getAllExamsCtrl", () => {
    it("should return exams for a lesson", async () => {
      mockReq.params = { lessonId: "lesson-123" };

      const mockExams = [
        {
          id: "exam-1",
          title: "Exam 1",
          timeLimit: 30,
          tutor: { id: "tutor-1", username: "tutor1" },
          _count: { questions: 5, attempts: 10 },
        },
        {
          id: "exam-2",
          title: "Exam 2",
          timeLimit: 45,
          tutor: { id: "tutor-1", username: "tutor1" },
          _count: { questions: 10, attempts: 5 },
        },
      ];

      mockPrisma.exam.findMany.mockResolvedValue(mockExams);

      await getAllExamsCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({ exams: mockExams });
    });

    it("should handle database errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockReq.params = { lessonId: "lesson-123" };
      mockPrisma.exam.findMany.mockRejectedValue(new Error("DB error"));

      await getAllExamsCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Tests para getExamByIdCtrl
  // ============================================
  describe("getExamByIdCtrl", () => {
    it("should return an exam by ID", async () => {
      mockReq.params = { id: "exam-123" };

      const mockExam = {
        id: "exam-123",
        title: "Test Exam",
        description: "Test Description",
        timeLimit: 30,
        questions: [
          { id: "q-1", text: "Question 1?", order: 1 },
        ],
        lesson: { id: "lesson-123", title: "Test Lesson" },
        tutor: { id: "tutor-123", username: "tutor" },
      };

      mockPrisma.exam.findUnique.mockResolvedValue(mockExam);

      await getExamByIdCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({ exam: mockExam });
    });

    it("should return 404 when exam not found", async () => {
      mockReq.params = { id: "nonexistent" };
      mockPrisma.exam.findUnique.mockResolvedValue(null);

      await getExamByIdCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Exam not found" });
    });

    it("should handle database errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockReq.params = { id: "exam-123" };
      mockPrisma.exam.findUnique.mockRejectedValue(new Error("DB error"));

      await getExamByIdCtrl(mockReq as AuthRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });
});

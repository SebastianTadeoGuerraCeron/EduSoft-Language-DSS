import { Response, NextFunction } from "express";
import { authorize, authorizeOwnerOrAdmin } from "../middleware/authorize";
import { AuthRequest } from "../middleware/auth";

describe("Authorization Middleware", () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      userId: "user123",
      userRole: "STUDENT_FREE",
      params: {},
      body: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe("authorize", () => {
    it("should reject request without userRole", () => {
      delete mockReq.userRole;
      const middleware = authorize("ADMIN");

      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Unauthorized",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with unauthorized role", () => {
      mockReq.userRole = "STUDENT_FREE";
      const middleware = authorize("ADMIN", "TUTOR");

      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Forbidden",
        message: "You do not have permission to access this resource",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should allow request with ADMIN role", () => {
      mockReq.userRole = "ADMIN";
      const middleware = authorize("ADMIN");

      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow request with TUTOR role when TUTOR is allowed", () => {
      mockReq.userRole = "TUTOR";
      const middleware = authorize("ADMIN", "TUTOR");

      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow request with STUDENT_PRO role when STUDENT_PRO is allowed", () => {
      mockReq.userRole = "STUDENT_PRO";
      const middleware = authorize("STUDENT_PRO", "STUDENT_FREE");

      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow request with STUDENT_FREE role when STUDENT_FREE is allowed", () => {
      mockReq.userRole = "STUDENT_FREE";
      const middleware = authorize("STUDENT_FREE");

      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should work with single role", () => {
      mockReq.userRole = "ADMIN";
      const middleware = authorize("ADMIN");

      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should work with multiple roles", () => {
      mockReq.userRole = "TUTOR";
      const middleware = authorize("ADMIN", "TUTOR", "STUDENT_PRO");

      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject STUDENT_FREE when only ADMIN and TUTOR allowed", () => {
      mockReq.userRole = "STUDENT_FREE";
      const middleware = authorize("ADMIN", "TUTOR");

      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("authorizeOwnerOrAdmin", () => {
    it("should reject request without userId", () => {
      delete mockReq.userId;
      mockReq.params = { id: "target123" };

      authorizeOwnerOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Unauthorized",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should allow owner to access their own data (using params)", () => {
      mockReq.userId = "user123";
      mockReq.params = { id: "user123" };

      authorizeOwnerOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow owner to access their own data (using body)", () => {
      mockReq.userId = "user123";
      mockReq.body = { userId: "user123" };

      authorizeOwnerOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should reject non-owner trying to access other user's data", () => {
      mockReq.userId = "user123";
      mockReq.userRole = "STUDENT_FREE";
      mockReq.params = { id: "otherUser456" };

      authorizeOwnerOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Forbidden",
        message: "You can only modify your own data",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should allow ADMIN to access any user's data", () => {
      mockReq.userId = "admin123";
      mockReq.userRole = "ADMIN";
      mockReq.params = { id: "otherUser456" };

      authorizeOwnerOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should reject TUTOR trying to access other user's data", () => {
      mockReq.userId = "tutor123";
      mockReq.userRole = "TUTOR";
      mockReq.params = { id: "student456" };

      authorizeOwnerOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject STUDENT_PRO trying to access other user's data", () => {
      mockReq.userId = "student123";
      mockReq.userRole = "STUDENT_PRO";
      mockReq.params = { id: "student456" };

      authorizeOwnerOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should prioritize params.id over body.userId", () => {
      mockReq.userId = "user123";
      mockReq.params = { id: "user123" };
      mockReq.body = { userId: "otherUser456" };

      authorizeOwnerOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow ADMIN even if targetUserId is undefined", () => {
      mockReq.userId = "admin123";
      mockReq.userRole = "ADMIN";
      mockReq.params = {};
      mockReq.body = {};

      authorizeOwnerOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject non-admin if targetUserId is undefined", () => {
      mockReq.userId = "user123";
      mockReq.userRole = "STUDENT_FREE";
      mockReq.params = {};
      mockReq.body = {};

      authorizeOwnerOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

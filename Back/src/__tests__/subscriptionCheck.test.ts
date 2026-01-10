/**
 * Tests for subscriptionCheck.ts job
 * Verifies expired subscriptions handling
 */

// Mock Prisma before importing anything
jest.mock("@prisma/client", () => {
  const mockFindMany = jest.fn();
  const mockSubscriptionUpdate = jest.fn();
  const mockUserUpdate = jest.fn();

  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      subscription: {
        findMany: mockFindMany,
        update: mockSubscriptionUpdate,
      },
      user: {
        update: mockUserUpdate,
      },
      // Expose mocks for tests
      __mocks: {
        findMany: mockFindMany,
        subscriptionUpdate: mockSubscriptionUpdate,
        userUpdate: mockUserUpdate,
      },
    })),
  };
});

import { PrismaClient } from "@prisma/client";
import {
  checkExpiredSubscriptions,
  startSubscriptionCheckJob,
  stopSubscriptionCheckJob,
} from "../jobs/subscriptionCheck";

describe("Subscription Check Job", () => {
  let mockFindMany: jest.Mock;
  let mockSubscriptionUpdate: jest.Mock;
  let mockUserUpdate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    // Get mock functions from the PrismaClient instance
    const prismaInstance = new PrismaClient();
    const mocks = (prismaInstance as any).__mocks;
    mockFindMany = mocks.findMany;
    mockSubscriptionUpdate = mocks.subscriptionUpdate;
    mockUserUpdate = mocks.userUpdate;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("checkExpiredSubscriptions", () => {
    it("should find and process expired subscriptions", async () => {
      const expiredSub = {
        id: "sub-1",
        userId: "user-1",
        status: "ACTIVE",
        user: { id: "user-1", email: "test@test.com", username: "testuser" },
      };

      mockFindMany
        .mockResolvedValueOnce([expiredSub])
        .mockResolvedValueOnce([]);
      mockSubscriptionUpdate.mockResolvedValue({});
      mockUserUpdate.mockResolvedValue({});

      await checkExpiredSubscriptions();

      expect(mockFindMany).toHaveBeenCalledTimes(2);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Running check")
      );
    });

    it("should handle no expired subscriptions", async () => {
      mockFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await checkExpiredSubscriptions();

      expect(mockFindMany).toHaveBeenCalledTimes(2);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Found 0 expired")
      );
    });

    it("should process past due subscriptions", async () => {
      const pastDueSub = {
        id: "sub-2",
        userId: "user-2",
        status: "PAST_DUE",
        user: { id: "user-2", email: "past@test.com", username: "pastuser" },
      };

      mockFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([pastDueSub]);
      mockSubscriptionUpdate.mockResolvedValue({});
      mockUserUpdate.mockResolvedValue({});

      await checkExpiredSubscriptions();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Found 1 long past-due")
      );
    });

    it("should handle errors during subscription processing", async () => {
      const expiredSub = {
        id: "sub-error",
        userId: "user-error",
        status: "ACTIVE",
        user: { id: "user-error", email: "error@test.com", username: "erroruser" },
      };

      mockFindMany
        .mockResolvedValueOnce([expiredSub])
        .mockResolvedValueOnce([]);
      mockSubscriptionUpdate.mockRejectedValueOnce(new Error("DB Error"));

      await checkExpiredSubscriptions();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error processing subscription"),
        expect.any(Error)
      );
    });

    it("should handle general errors", async () => {
      mockFindMany.mockRejectedValueOnce(new Error("Connection failed"));

      await checkExpiredSubscriptions();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error running subscription check"),
        expect.any(Error)
      );
    });

    it("should process multiple expired subscriptions", async () => {
      const subs = [
        {
          id: "sub-1",
          userId: "user-1",
          status: "ACTIVE",
          user: { id: "user-1", email: "a@test.com", username: "user1" },
        },
        {
          id: "sub-2",
          userId: "user-2",
          status: "ACTIVE",
          user: { id: "user-2", email: "b@test.com", username: "user2" },
        },
      ];

      mockFindMany
        .mockResolvedValueOnce(subs)
        .mockResolvedValueOnce([]);
      mockSubscriptionUpdate.mockResolvedValue({});
      mockUserUpdate.mockResolvedValue({});

      await checkExpiredSubscriptions();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Found 2 expired")
      );
    });
  });

  describe("startSubscriptionCheckJob", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockFindMany.mockResolvedValue([]);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should start the job with default interval", () => {
      const intervalId = startSubscriptionCheckJob();
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Starting subscription check job")
      );
      expect(intervalId).toBeDefined();

      stopSubscriptionCheckJob(intervalId);
    });

    it("should start the job with custom interval", () => {
      const intervalId = startSubscriptionCheckJob(30);
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("every 30 minutes")
      );

      stopSubscriptionCheckJob(intervalId);
    });

    it("should run check immediately on start", () => {
      const intervalId = startSubscriptionCheckJob();
      
      expect(mockFindMany).toHaveBeenCalled();

      stopSubscriptionCheckJob(intervalId);
    });
  });

  describe("stopSubscriptionCheckJob", () => {
    it("should stop the job and log message", () => {
      jest.useFakeTimers();
      mockFindMany.mockResolvedValue([]);
      
      const intervalId = startSubscriptionCheckJob();
      stopSubscriptionCheckJob(intervalId);
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("job stopped")
      );

      jest.useRealTimers();
    });
  });
});

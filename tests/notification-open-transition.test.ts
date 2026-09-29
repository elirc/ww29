import { UserRole } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/notificationRepository", () => ({
  createNotificationBatch: vi.fn(),
  createNotification: vi.fn(),
  listNotificationsForActor: vi.fn(),
  findNotificationDetail: vi.fn(),
  getDeliveryStatusesForNotification: vi.fn(),
  getNotificationStatusesForBatch: vi.fn(),
  updateNotificationStatus: vi.fn(),
  updateNotificationOpenedAt: vi.fn(),
  updateBatchStatus: vi.fn(),
  deriveNotificationStatus: vi.fn(),
  deriveBatchStatus: vi.fn()
}));

vi.mock("@/repositories/deliveryRepository", () => ({
  createNotificationDelivery: vi.fn(),
  markDeliveryOpened: vi.fn()
}));

vi.mock("@/repositories/auditLogRepository", () => ({
  createAuditLog: vi.fn()
}));

vi.mock("@/repositories/templateRepository", () => ({
  findTemplateById: vi.fn(),
  listTemplates: vi.fn()
}));

vi.mock("@/repositories/userRepository", () => ({
  findRecipientsByIds: vi.fn(),
  listRecipientDirectory: vi.fn()
}));

describe("notification open transition", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("rejects opening a notification that has never been sent", async () => {
    // This test matters because engagement metrics become untrustworthy if failed or queued deliveries can silently transition to OPENED.
    const repo = await import("@/repositories/notificationRepository");
    vi.mocked(repo.findNotificationDetail).mockResolvedValue({
      id: "notification-1",
      batchId: "batch-1",
      recipientUserId: "viewer-1",
      deliveries: [{ id: "delivery-1", status: "FAILED" }]
    } as any);

    const { markNotificationOpenedForSession } = await import("@/services/notificationService");

    await expect(
      markNotificationOpenedForSession(
        {
          userId: "viewer-1",
          email: "viewer@example.com",
          name: "Vera Viewer",
          role: UserRole.VIEWER
        },
        "notification-1"
      )
    ).rejects.toMatchObject({
      status: 409
    });
  });
});

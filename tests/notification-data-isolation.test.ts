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

describe("notification data isolation", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("does not return another viewer's notification detail", async () => {
    // This test matters because list-level scoping is not enough; a direct detail lookup must still block cross-user data access.
    const repo = await import("@/repositories/notificationRepository");
    vi.mocked(repo.findNotificationDetail).mockResolvedValue({
      id: "notification-foreign",
      batchId: "batch-1",
      recipientUserId: "someone-else",
      deliveries: []
    } as any);

    const { getNotificationDetailForSession } = await import("@/services/notificationService");

    await expect(
      getNotificationDetailForSession(
        {
          userId: "viewer-1",
          email: "viewer@example.com",
          name: "Vera Viewer",
          role: UserRole.VIEWER
        },
        "notification-foreign"
      )
    ).rejects.toMatchObject({
      status: 404
    });
  });
});

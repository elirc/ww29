import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadTypeScript } from './helpers/load-typescript.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const prismaEnums = {
  Prisma: {},
  BatchStatus: Object.fromEntries(['QUEUED','COMPLETED','FAILED','PARTIAL_FAILURE','PROCESSING'].map(x=>[x,x])),
  NotificationStatus: Object.fromEntries(['QUEUED','COMPLETED','FAILED','PARTIAL_FAILURE','PROCESSING'].map(x=>[x,x])),
  UserRole: { ADMIN: 'ADMIN', OPERATOR: 'OPERATOR', VIEWER: 'VIEWER' },
  DeliveryStatus: { SENT: 'SENT', OPENED: 'OPENED', SKIPPED: 'SKIPPED', FAILED: 'FAILED', PROCESSING: 'PROCESSING' },
  NotificationChannel: { EMAIL: 'EMAIL', SMS: 'SMS', PUSH: 'PUSH' },
};
const actualRepository = await loadTypeScript('src/repositories/notificationRepository.ts', { root, stubs: { '@prisma/client': prismaEnums, '@/lib/db': { prisma: {} } } });

function fixture({ recipientUserId = 'viewer-1', deliveryStatus = 'SENT' } = {}) {
  const calls = [];
  const detail = {
    id: 'notification-1', batchId: 'batch-1', recipientUserId,
    deliveries: [{ id: 'delivery-1', status: deliveryStatus }],
  };
  const repos = {
    findNotificationDetail: async () => detail,
    markDeliveryOpened: async ids => calls.push(['open-deliveries', ids]),
    updateNotificationOpenedAt: async id => calls.push(['opened-at', id]),
    getDeliveryStatusesForNotification: async () => [{ status: 'OPENED' }],
    getNotificationStatusesForBatch: async () => [{ status: 'COMPLETED' }],
    updateNotificationStatus: async (id, status) => calls.push(['notification-status', id, status]),
    updateBatchStatus: async (id, status) => calls.push(['batch-status', id, status]),
  };
  return { calls, detail, repos };
}

async function serviceFor(f) {
  const mod = await loadTypeScript('src/services/notificationService.ts', { root, stubs: {
    '@prisma/client': prismaEnums,
    '@/lib/db': { prisma: {} },
    'zod': { ZodError: class extends Error {} },
    '@/lib/notifications/rendering': { buildMessageValues: () => ({}), isChannelOptedIn: () => true, isWithinQuietHours: () => false, renderTemplate: () => '', resolveChannelTarget: () => 'target' },
    '@/repositories/auditLogRepository': { createAuditLog: async data => f.calls.push(['audit', data.action]) },
    '@/repositories/deliveryRepository': { createNotificationDelivery: async () => {}, markDeliveryOpened: f.repos.markDeliveryOpened },
    '@/repositories/notificationRepository': { ...f.repos, deriveNotificationStatus: actualRepository.deriveNotificationStatus, deriveBatchStatus: actualRepository.deriveBatchStatus, createNotification: async () => {}, createNotificationBatch: async () => {}, findNotificationDetail: f.repos.findNotificationDetail, getNotificationStatusesForBatch: f.repos.getNotificationStatusesForBatch, getDeliveryStatusesForNotification: f.repos.getDeliveryStatusesForNotification, listNotificationsForActor: async () => [], updateNotificationOpenedAt: f.repos.updateNotificationOpenedAt, updateNotificationStatus: f.repos.updateNotificationStatus, updateBatchStatus: f.repos.updateBatchStatus },
    '@/repositories/templateRepository': { findTemplateById: async () => null, listTemplates: async () => [] },
    '@/repositories/userRepository': { findRecipientsByIds: async () => [], listRecipientDirectory: async () => [] },
  }});
  return mod;
}

const viewer = { userId: 'viewer-1', role: 'VIEWER' };
const admin = { userId: 'admin-1', role: 'ADMIN' };

test('viewer cannot open another recipient notification', async () => {
  const f = fixture({ recipientUserId: 'other-1' }); const { markNotificationOpenedForSession } = await serviceFor(f);
  await assert.rejects(markNotificationOpenedForSession(viewer, 'notification-1'), e => e.status === 404);
  assert.deepEqual(f.calls, []);
});

test('own notification must have a sent delivery before opening', async () => {
  const f = fixture({ deliveryStatus: 'QUEUED' }); const { markNotificationOpenedForSession } = await serviceFor(f);
  await assert.rejects(markNotificationOpenedForSession(viewer, 'notification-1'), e => e.status === 409);
  assert.deepEqual(f.calls, []);
});

test('sent owner open updates delivery, aggregate statuses, and audit', async () => {
  const f = fixture(); const { markNotificationOpenedForSession } = await serviceFor(f);
  const result = await markNotificationOpenedForSession(viewer, 'notification-1');
  assert.equal(result.opened, true);
  assert.deepEqual(f.calls, [['open-deliveries', ['delivery-1']], ['opened-at', 'notification-1'], ['notification-status', 'notification-1', 'COMPLETED'], ['batch-status', 'batch-1', 'COMPLETED'], ['audit', 'notifications.opened']]);
});

test('admin may open another recipient notification through the same transition', async () => {
  const f = fixture({ recipientUserId: 'other-1' }); const { markNotificationOpenedForSession } = await serviceFor(f);
  assert.equal((await markNotificationOpenedForSession(admin, 'notification-1')).opened, true);
  assert.equal(f.calls.at(-1)[1], 'notifications.opened');
});

test('mixed failed and opened deliveries use actual aggregate policy', async () => {
  const f = fixture();
  f.repos.getDeliveryStatusesForNotification = async () => [{ status: 'OPENED' }, { status: 'FAILED' }];
  f.repos.getNotificationStatusesForBatch = async () => [{ status: 'COMPLETED' }, { status: 'PARTIAL_FAILURE' }];
  await (await serviceFor(f)).markNotificationOpenedForSession(viewer, 'notification-1');
  assert.deepEqual(f.calls.slice(2,4), [['notification-status', 'notification-1', 'PARTIAL_FAILURE'], ['batch-status', 'batch-1', 'PARTIAL_FAILURE']]);
});

test('aggregate write failure propagates after open writes and prevents audit', async () => {
  const f = fixture(); const failure = new Error('aggregate unavailable');
  f.repos.updateNotificationStatus = async () => { throw failure; };
  await assert.rejects((await serviceFor(f)).markNotificationOpenedForSession(viewer, 'notification-1'), e=>e===failure);
  assert.deepEqual(f.calls, [['open-deliveries', ['delivery-1']], ['opened-at', 'notification-1']]);
});

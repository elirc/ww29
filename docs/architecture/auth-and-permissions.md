# Auth And Permissions

## Session flow

- Login input is validated in `src/lib/validation/authSchemas.ts` inside `loginSchema`.
- Credentials are checked in `src/services/authService.ts` inside `loginWithPassword()`.
- The signed cookie is created in `src/lib/auth/session.ts` inside `createSessionToken()` and written by `src/app/api/auth/login/route.ts` in `POST()`.
- Later API requests are authenticated in `src/lib/auth/session.ts` inside `getSessionFromRequest()` and `requireApiSession()`.
- The client bootstraps current-user state from `src/app/api/auth/me/route.ts` in `GET()` and `src/hooks/useSession.ts`.

## RBAC enforcement

- The permission matrix lives in `src/lib/auth/permissions.ts` in `rolePermissions`.
- All role checks go through `requireAction()` in `src/lib/auth/permissions.ts`.
- Admin dashboard access is enforced in `src/services/monitoringService.ts` inside `getAdminDashboard()`, which is called by `src/app/api/admin/dashboard/route.ts`.
- Notification creation is enforced in `src/services/notificationService.ts` inside `createNotificationBatchForSession()`, which is called by `src/app/api/notifications/route.ts` in `POST()`.
- Preference management is enforced in `src/app/api/preferences/route.ts` through `requireApiSession(request, "preferences:manage:own")`.

## Roles

- `ADMIN`
  Allowed by `src/lib/auth/permissions.ts`: create notifications, view any notification, open own notifications, manage own preferences, view admin dashboard.

- `OPERATOR`
  Allowed by `src/lib/auth/permissions.ts`: create notifications, view any notification, open own notifications, manage own preferences.
  Not allowed: `dashboard:view:admin`.

- `VIEWER`
  Allowed by `src/lib/auth/permissions.ts`: view own notifications, open own notifications, manage own preferences.
  Not allowed: create batches or view the admin dashboard.

## Ownership and data isolation

- List scoping is enforced in `src/repositories/notificationRepository.ts` inside `listNotificationsForActor()`. The repository itself applies `recipientUserId` filtering when the actor is a `VIEWER` or when the caller explicitly requests `mine=true`.
- Detail scoping is enforced in `src/services/notificationService.ts` inside `getNotificationDetailForSession()`. Even if a caller guesses another notification ID, the service returns `404` when `recipientUserId !== session.userId`.
- Open tracking uses the same ownership boundary in `src/services/notificationService.ts` inside `markNotificationOpenedForSession()`.

## Why multi-tenancy is not included

This codebase is single-tenant with explicit auth and role-based permissions. The product requirements did not require tenant-aware isolation, and the learning goal here is queue reliability plus backend layering, not organization scoping.

To add multi-tenancy later, these files would need to change:

- `prisma/schema.prisma`
  Add `Tenant` or `Organization` plus `tenantId` on tenant-owned models.

- `src/lib/auth/session.ts`
  Include `tenantId` in the signed session payload.

- `src/repositories/notificationRepository.ts`, `src/repositories/deliveryRepository.ts`, `src/repositories/preferenceRepository.ts`
  Add tenant filters to every tenant-owned query.

- `src/lib/auth/permissions.ts`
  Separate platform permissions from org-scoped permissions.

- `src/services/notificationService.ts`
  Pass tenant context into every batch, notification, and delivery write.

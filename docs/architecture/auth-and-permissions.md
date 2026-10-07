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
- Open tracking uses the same ownership boundary in `src/services/notificationService.ts` inside `markNotificationOpenedForSession()` (lines 292-296). Note what that implies: because ADMIN and OPERATOR hold `notifications:view:any`, they can also **open** another user's notification, even though the action checked is named `notifications:open:own`. The lab in `tests/runtime-notification-open-lab.test.mjs:72-76` pins this for ADMIN.

## Line-level session walkthrough

- `src/lib/auth/session.ts:27-38` signs `{ userId, email, name, role }` with HS256, `iat`, and a 7-day
  expiry using `env.SESSION_SECRET` (validated to at least 16 characters in `src/lib/env.ts:5`).
- `:100-102` writes the cookie as `HttpOnly; SameSite=Lax; Max-Age=604800` with `Path=/`. There is no
  `Secure` attribute, so the cookie would also travel over plain HTTP.
- `:40-60` verifies the token and requires all four claims; any `jose` error becomes `null`.
- `:62-73` parses the raw `cookie` header by hand and URL-decodes the value.
- `:85-98` `requireApiSession` throws 401 without a session and then optionally calls `requireAction`.
- `src/app/api/auth/me/route.ts:11-21` returns `{ user: null }` with 200 when unauthenticated, and
  otherwise re-reads the user from the database — the only place where the role is refreshed from
  the database rather than taken from the token.

## Route-to-permission matrix

| Route | Permission checked in route | Further check in service |
|---|---|---|
| `GET /api/notifications` | `notifications:view:own` | VIEWER (or `mine=true`) scoped to self in the repository query |
| `POST /api/notifications` | `notifications:create` | repeated at `notificationService.ts:89` |
| `GET /api/notifications/[id]` | `notifications:view:own` | ownership or `view:any`, 404 otherwise |
| `POST /api/notifications/[id]/open` | `notifications:open:own` | ownership or `view:any`, then `SENT` precondition |
| `GET, PUT /api/preferences` | `preferences:manage:own` | always the session's own user |
| `GET /api/admin/dashboard` | none (session only) | `dashboard:view:admin` in `monitoringService.ts:13` |

## Senior-review findings

1. **Staff-generated opens.** See the note on open tracking above.
2. **Directory over-exposure.** `GET /api/notifications` returns `composer` data to every role
   (`src/app/api/notifications/route.ts:26-28`), including every user's email and role from
   `listRecipientDirectory`. A VIEWER only needs their own notifications.
3. **Role changes lag up to 7 days.** The role is baked into the token; nothing re-reads it on
   protected routes. Logout clears the cookie on one browser only (`src/app/api/auth/logout/route.ts:18`);
   a copied token remains valid until expiry.
4. **No login throttling.** `loginWithPassword` (`src/services/authService.ts:12-32`) has no attempt
   counter; the vague error message prevents enumeration but not brute force.

**Exercise — Goal:** confirm finding 3. **Check:** follow `requireApiSession` and confirm no database
read of the user's role occurs between `verifySessionToken` and `requireAction`
(`session.ts:85-98`).

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

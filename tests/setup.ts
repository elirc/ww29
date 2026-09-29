process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/notification_platform?schema=public";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? "development-session-secret-please-change";
process.env.WORKER_ID = process.env.WORKER_ID ?? "test-worker";

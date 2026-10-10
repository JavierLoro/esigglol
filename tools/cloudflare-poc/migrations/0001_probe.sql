-- Isolated diagnostic schema. Never an application migration.
CREATE TABLE IF NOT EXISTS probe_records (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 0,
  value TEXT NOT NULL
);

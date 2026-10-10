-- Lifetime reservations. Never reset automatically or refund failed operations.
CREATE TABLE IF NOT EXISTS r2_budget (
  id TEXT PRIMARY KEY CHECK (id = 'pilot'),
  class_a INTEGER NOT NULL DEFAULT 0 CHECK (class_a BETWEEN 0 AND 100),
  class_b INTEGER NOT NULL DEFAULT 0 CHECK (class_b BETWEEN 0 AND 1000),
  uploaded_bytes INTEGER NOT NULL DEFAULT 0 CHECK (uploaded_bytes BETWEEN 0 AND 1048576)
);
INSERT OR IGNORE INTO r2_budget (id) VALUES ('pilot');

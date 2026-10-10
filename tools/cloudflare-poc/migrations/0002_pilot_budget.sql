-- Persistent request ceiling for the private remote fixture only.
CREATE TABLE IF NOT EXISTS pilot_budget (
  id TEXT PRIMARY KEY CHECK (id = 'pilot'),
  requests INTEGER NOT NULL CHECK (requests BETWEEN 1 AND 1000)
);

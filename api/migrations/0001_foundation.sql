-- Milestone 1: foundation tables. IDs are ULIDs (TEXT). Timestamps are UTC unix seconds.
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  clerk_user_id  TEXT NOT NULL UNIQUE,
  email          TEXT,
  phone          TEXT,
  role           TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator','admin')),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned')),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  last_seen_at   INTEGER
);
CREATE INDEX idx_users_status ON users(status);

CREATE TABLE profiles (
  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle           TEXT NOT NULL UNIQUE,
  display_name     TEXT NOT NULL,
  avatar_key       TEXT,
  bio              TEXT,
  state            TEXT,
  city             TEXT,
  is_spotter       INTEGER NOT NULL DEFAULT 1 CHECK (is_spotter IN (0,1)),
  is_inspector     INTEGER NOT NULL DEFAULT 0 CHECK (is_inspector IN (0,1)),
  followers_count  INTEGER NOT NULL DEFAULT 0,
  following_count  INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE verification_records (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('identity','agent','owner','inspector')),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','revoked')),
  document_keys  TEXT,
  notes          TEXT,
  reviewed_by    TEXT REFERENCES users(id),
  reviewed_at    INTEGER,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX idx_verif_user ON verification_records(user_id, kind, status);
CREATE INDEX idx_verif_queue ON verification_records(status, created_at);

CREATE TABLE audit_logs (
  id             TEXT PRIMARY KEY,
  actor_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  entity_type    TEXT,
  entity_id      TEXT,
  metadata       TEXT,
  created_at     INTEGER NOT NULL
);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);

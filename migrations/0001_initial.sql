PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  brief TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT 'Animação 3D educativa',
  aspect_ratio TEXT NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('9:16', '16:9', '1:1')),
  target_duration INTEGER NOT NULL DEFAULT 30 CHECK (target_duration BETWEEN 5 AND 600),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_updated ON projects(archived_at,updated_at DESC);
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  narration TEXT NOT NULL DEFAULT '',
  visual_prompt TEXT NOT NULL DEFAULT '',
  motion_prompt TEXT NOT NULL DEFAULT '',
  duration_sec INTEGER NOT NULL DEFAULT 5 CHECK (duration_sec BETWEEN 1 AND 30),
  reference_asset_id TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id,position)
);
CREATE INDEX IF NOT EXISTS scenes_project_position ON scenes(project_id,position);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS assets_project ON assets(project_id,created_at DESC);
CREATE TABLE IF NOT EXISTS simulations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_count INTEGER NOT NULL,
  duration_sec INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'simulated',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS simulations_project ON simulations(project_id,created_at DESC);

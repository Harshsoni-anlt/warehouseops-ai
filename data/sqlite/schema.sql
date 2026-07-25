-- SPDX-License-Identifier: Apache-2.0
-- SQLite schema for the Warehouse Operations Assistant (free, laptop-runnable build).
-- Ported from the original PostgreSQL/TimescaleDB schema:
--   SERIAL->INTEGER AUTOINCREMENT, UUID->TEXT, JSONB->TEXT, TIMESTAMPTZ->TEXT,
--   BOOLEAN->INTEGER, DOUBLE PRECISION/DECIMAL/FLOAT->REAL, INET->TEXT,
--   hypertables/extensions dropped. Foreign keys require `PRAGMA foreign_keys=ON`.

-- ---------- Core operations ----------
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  reorder_point INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  assignee TEXT,
  payload TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS safety_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  severity TEXT,
  description TEXT,
  reported_by TEXT,
  occurred_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS equipment_telemetry (
  ts TEXT NOT NULL,
  equipment_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_telemetry_equipment_ts ON equipment_telemetry(equipment_id, ts);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('inbound', 'outbound', 'adjustment')),
  quantity INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- Auth ----------
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','supervisor','operator','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended','pending')),
  hashed_password TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  is_revoked INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- Equipment ----------
CREATE TABLE IF NOT EXISTS equipment_assets (
  asset_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  model TEXT,
  zone TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  owner_user TEXT,
  next_pm_due TEXT,
  last_maintenance TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS equipment_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT NOT NULL REFERENCES equipment_assets(asset_id) ON DELETE CASCADE,
  task_id TEXT,
  assignee TEXT,
  assignment_type TEXT NOT NULL,
  assigned_at TEXT DEFAULT (datetime('now')),
  released_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS equipment_maintenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT NOT NULL REFERENCES equipment_assets(asset_id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL,
  description TEXT,
  performed_by TEXT,
  performed_at TEXT DEFAULT (datetime('now')),
  duration_minutes INTEGER,
  parts_used TEXT DEFAULT '[]',
  cost REAL,
  notes TEXT,
  next_due TEXT
);

CREATE TABLE IF NOT EXISTS equipment_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT NOT NULL REFERENCES equipment_assets(asset_id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  measurement_period TEXT NOT NULL,
  measured_at TEXT DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}'
);

-- ---------- Documents ----------
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  upload_timestamp TEXT DEFAULT (datetime('now')),
  user_id INTEGER REFERENCES users(id),
  status TEXT DEFAULT 'uploaded',
  processing_stage TEXT,
  document_type TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_operations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  operation_type TEXT,
  operation_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS processing_stages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  processing_time_ms INTEGER,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS extraction_results (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  raw_data TEXT,
  processed_data TEXT,
  confidence_score REAL,
  processing_time_ms INTEGER,
  model_used TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quality_scores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  overall_score REAL NOT NULL CHECK (overall_score >= 0 AND overall_score <= 5),
  completeness_score REAL NOT NULL CHECK (completeness_score >= 0 AND completeness_score <= 5),
  accuracy_score REAL NOT NULL CHECK (accuracy_score >= 0 AND accuracy_score <= 5),
  compliance_score REAL NOT NULL CHECK (compliance_score >= 0 AND compliance_score <= 5),
  quality_score REAL NOT NULL CHECK (quality_score >= 0 AND quality_score <= 5),
  decision TEXT NOT NULL,
  reasoning TEXT,
  issues_found TEXT DEFAULT '[]',
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  judge_model TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routing_decisions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  routing_action TEXT NOT NULL,
  routing_reason TEXT,
  wms_integration_status TEXT,
  wms_integration_data TEXT,
  human_review_required INTEGER DEFAULT 0,
  human_reviewer_id INTEGER REFERENCES users(id),
  human_review_completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_search_metadata (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  search_vector_id TEXT,
  embedding_model TEXT,
  extracted_text TEXT,
  key_entities TEXT DEFAULT '{}',
  document_summary TEXT,
  tags TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- Conversation memory ----------
CREATE TABLE IF NOT EXISTS conversation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  user_id TEXT,
  role TEXT,
  content TEXT,
  entities TEXT DEFAULT '{}',
  timestamp TEXT DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  name TEXT,
  role TEXT,
  preferences TEXT DEFAULT '{}',
  last_active TEXT DEFAULT (datetime('now')),
  conversation_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_contexts (
  session_id TEXT PRIMARY KEY,
  user_id TEXT,
  start_time TEXT DEFAULT (datetime('now')),
  last_activity TEXT DEFAULT (datetime('now')),
  current_focus TEXT,
  key_entities TEXT DEFAULT '{}',
  conversation_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ---------- Forecasting (model registry) ----------
CREATE TABLE IF NOT EXISTS model_training_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_name TEXT NOT NULL,
  sku TEXT,
  training_date TEXT DEFAULT (datetime('now')),
  accuracy_score REAL,
  mape_score REAL,
  rmse_score REAL,
  training_samples INTEGER,
  metadata TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_mth_model ON model_training_history(model_name, training_date);

CREATE TABLE IF NOT EXISTS model_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_name TEXT NOT NULL,
  sku TEXT,
  prediction_date TEXT DEFAULT (datetime('now')),
  forecast_horizon_days INTEGER,
  predicted_value REAL,
  actual_value REAL,
  metadata TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_mp_model ON model_predictions(model_name, prediction_date);

-- ---------- Seed: inventory (16 SKUs) ----------
INSERT INTO inventory_items (sku, name, quantity, location, reorder_point) VALUES
  ('LAY001', 'Lay''s Classic Potato Chips 9oz', 1250, 'Zone A-Aisle 1-Rack 2-Level 3', 200),
  ('LAY002', 'Lay''s Barbecue Potato Chips 9oz', 980, 'Zone A-Aisle 1-Rack 2-Level 2', 150),
  ('DOR001', 'Doritos Nacho Cheese Tortilla Chips 9.75oz', 1120, 'Zone A-Aisle 2-Rack 1-Level 3', 180),
  ('DOR002', 'Doritos Cool Ranch Tortilla Chips 9.75oz', 890, 'Zone A-Aisle 2-Rack 1-Level 2', 140),
  ('CHE001', 'Cheetos Crunchy Cheese Flavored Snacks 8.5oz', 750, 'Zone A-Aisle 3-Rack 2-Level 3', 120),
  ('CHE002', 'Cheetos Puffs Cheese Flavored Snacks 8.5oz', 680, 'Zone A-Aisle 3-Rack 2-Level 2', 110),
  ('TOS001', 'Tostitos Original Restaurant Style Tortilla Chips 13oz', 420, 'Zone B-Aisle 1-Rack 3-Level 1', 80),
  ('TOS002', 'Tostitos Scoops Tortilla Chips 10oz', 380, 'Zone B-Aisle 1-Rack 3-Level 2', 70),
  ('FRI001', 'Fritos Original Corn Chips 9.25oz', 320, 'Zone B-Aisle 2-Rack 1-Level 1', 60),
  ('FRI002', 'Fritos Chili Cheese Corn Chips 9.25oz', 280, 'Zone B-Aisle 2-Rack 1-Level 2', 50),
  ('RUF001', 'Ruffles Original Potato Chips 9oz', 450, 'Zone B-Aisle 3-Rack 2-Level 1', 85),
  ('RUF002', 'Ruffles Cheddar & Sour Cream Potato Chips 9oz', 390, 'Zone B-Aisle 3-Rack 2-Level 2', 75),
  ('SUN001', 'SunChips Original Multigrain Snacks 7oz', 180, 'Zone C-Aisle 1-Rack 1-Level 1', 40),
  ('SUN002', 'SunChips Harvest Cheddar Multigrain Snacks 7oz', 160, 'Zone C-Aisle 1-Rack 1-Level 2', 35),
  ('POP001', 'PopCorners Sea Salt Popcorn Chips 5oz', 95, 'Zone C-Aisle 2-Rack 2-Level 1', 25),
  ('POP002', 'PopCorners White Cheddar Popcorn Chips 5oz', 85, 'Zone C-Aisle 2-Rack 2-Level 2', 20)
ON CONFLICT (sku) DO UPDATE SET
  name = excluded.name, quantity = excluded.quantity,
  location = excluded.location, reorder_point = excluded.reorder_point,
  updated_at = datetime('now');

-- ---------- Seed: equipment assets ----------
INSERT INTO equipment_assets (asset_id, type, model, zone, status, owner_user, next_pm_due) VALUES
  ('FL-01', 'forklift', 'Toyota 8FGU25', 'Zone A', 'available', NULL, datetime('now','+30 days')),
  ('FL-02', 'forklift', 'Toyota 8FGU25', 'Zone B', 'assigned', 'operator1', datetime('now','+15 days')),
  ('FL-03', 'forklift', 'Hyster H2.5XM', 'Loading Dock', 'maintenance', NULL, datetime('now','+7 days')),
  ('AMR-001', 'amr', 'MiR-250', 'Zone A', 'available', NULL, datetime('now','+45 days')),
  ('AMR-002', 'amr', 'MiR-250', 'Zone B', 'charging', NULL, datetime('now','+30 days')),
  ('AGV-01', 'agv', 'Kiva Systems', 'Assembly Line', 'assigned', 'operator2', datetime('now','+60 days')),
  ('SCN-01', 'scanner', 'Honeywell CT60', 'Zone A', 'assigned', 'operator1', datetime('now','+90 days')),
  ('SCN-02', 'scanner', 'Honeywell CT60', 'Zone B', 'available', NULL, datetime('now','+90 days')),
  ('CHG-01', 'charger', 'Forklift Charger', 'Charging Station', 'available', NULL, datetime('now','+180 days')),
  ('CHG-02', 'charger', 'AMR Charger', 'Charging Station', 'available', NULL, datetime('now','+180 days')),
  ('CONV-01', 'conveyor', 'Belt Conveyor 3m', 'Assembly Line', 'available', NULL, datetime('now','+120 days')),
  ('HUM-01', 'humanoid', 'Boston Dynamics Stretch', 'Zone A', 'maintenance', NULL, datetime('now','+14 days'))
ON CONFLICT (asset_id) DO UPDATE SET
  type = excluded.type, model = excluded.model, zone = excluded.zone,
  status = excluded.status, owner_user = excluded.owner_user,
  next_pm_due = excluded.next_pm_due, updated_at = datetime('now');

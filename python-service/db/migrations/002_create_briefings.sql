CREATE TABLE IF NOT EXISTS briefings (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  ticker VARCHAR(20) NOT NULL,
  sector VARCHAR(120),
  analyst_name VARCHAR(120),
  summary TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  generated_html TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS briefing_points (
  id SERIAL PRIMARY KEY,
  briefing_id INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS briefing_risks (
  id SERIAL PRIMARY KEY,
  briefing_id INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS briefing_metrics (
  id SERIAL PRIMARY KEY,
  briefing_id INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  value VARCHAR(120) NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_briefing_metric_name UNIQUE (briefing_id, name)
);

CREATE INDEX IF NOT EXISTS idx_briefings_ticker ON briefings (ticker);
CREATE INDEX IF NOT EXISTS idx_briefing_points_briefing_id ON briefing_points (briefing_id);
CREATE INDEX IF NOT EXISTS idx_briefing_risks_briefing_id ON briefing_risks (briefing_id);
CREATE INDEX IF NOT EXISTS idx_briefing_metrics_briefing_id ON briefing_metrics (briefing_id);


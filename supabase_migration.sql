-- ============================================================
-- Supabase Migration: prediction_history table
-- Run this ONCE in the Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS prediction_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- All 13 UCI form fields stored as JSONB (flexible, no rigid per-field columns)
  form_inputs  JSONB NOT NULL,

  -- Prediction outputs
  risk         TEXT NOT NULL CHECK (risk IN ('High', 'Low')),
  probability  NUMERIC(6,4) NOT NULL,
  prediction   SMALLINT NOT NULL,   -- 0 = Low, 1 = High
  top_factors  JSONB NOT NULL,      -- array of {feature, label, importance, value}
  explanation  TEXT NOT NULL
);

-- 2. Index for fast per-user queries ordered by time
CREATE INDEX IF NOT EXISTS idx_prediction_history_user_time
  ON prediction_history (user_id, created_at DESC);

-- 3. Enable Row-Level Security
ALTER TABLE prediction_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies — users can only access their own rows
CREATE POLICY "Users read own history"
  ON prediction_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own history"
  ON prediction_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own history"
  ON prediction_history
  FOR DELETE
  USING (auth.uid() = user_id);

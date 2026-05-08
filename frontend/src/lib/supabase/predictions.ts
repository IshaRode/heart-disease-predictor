/**
 * predictions.ts — Supabase data-access layer for prediction history.
 *
 * All DB operations are scoped to the authenticated user via Row-Level Security
 * (the anon key + JWT cookie is sufficient — no service-role key needed).
 *
 * Table schema (run once in Supabase SQL editor):
 *   See /docs/supabase_migration.sql
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { PredictRequest, PredictResponse } from "@/types";

// ---------------------------------------------------------------------------
// Row shape returned by Supabase
// ---------------------------------------------------------------------------

export interface PredictionHistoryRow {
  id: string;
  user_id: string;
  created_at: string;          // ISO 8601
  form_inputs: PredictRequest; // JSONB stored as typed object
  risk: "High" | "Low";
  probability: number;
  prediction: number;
  top_factors: PredictResponse["top_factors"];
  explanation: string;
}

// ---------------------------------------------------------------------------
// Write — called right after a successful /api/predict response
// ---------------------------------------------------------------------------

export async function savePrediction(
  supabase: SupabaseClient,
  userId: string,
  formInputs: PredictRequest,
  result: PredictResponse
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("prediction_history")
    .insert({
      user_id:     userId,
      form_inputs: formInputs,
      risk:        result.risk,
      probability: result.probability,
      prediction:  result.prediction,
      top_factors: result.top_factors,
      explanation: result.explanation,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[savePrediction] Supabase insert error:", error.message);
    return null;
  }

  return data as { id: string };
}

// ---------------------------------------------------------------------------
// Read — fetch history for the authenticated user, newest first
// ---------------------------------------------------------------------------

export async function fetchHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 100
): Promise<PredictionHistoryRow[]> {
  const { data, error } = await supabase
    .from("prediction_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[fetchHistory] Supabase select error:", error.message);
    return [];
  }

  return (data ?? []) as PredictionHistoryRow[];
}

// ---------------------------------------------------------------------------
// Delete — remove a single entry (RLS ensures users can only delete their own)
// ---------------------------------------------------------------------------

export async function deleteHistoryEntry(
  supabase: SupabaseClient,
  id: string
): Promise<boolean> {
  const { error } = await supabase
    .from("prediction_history")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deleteHistoryEntry] Supabase delete error:", error.message);
    return false;
  }

  return true;
}

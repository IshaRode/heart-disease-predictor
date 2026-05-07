// Shared TypeScript types for the prediction API

export interface PredictRequest {
  age: number;
  sex: number;
  cp: number;
  trestbps: number;
  chol: number;
  fbs: number;
  restecg: number;
  thalach: number;
  exang: number;
  oldpeak: number;
  slope: number;
  ca: number;
  thal: number;
}

export interface TopFactor {
  feature: string;
  label: string;
  importance: number;
  value: number | string;
}

export interface PredictResponse {
  risk: "High" | "Low";
  probability: number;
  prediction: number;
  top_factors: TopFactor[];
  explanation: string;
}

export interface PredictionHistoryEntry {
  id: string;
  timestamp: string;
  input: PredictRequest;
  result: PredictResponse;
}

// ---------------------------------------------------------------------------
// Chat / AI Assistant types
// ---------------------------------------------------------------------------

/** A single message in the chat thread */
export interface ChatMessage {
  /** Unique ID for React key reconciliation */
  id: string;
  /** "user" = right-aligned bubble, "assistant" = left-aligned bubble */
  role: "user" | "assistant";
  /** Text content of the message */
  content: string;
  /** ISO timestamp for display */
  timestamp: string;
}

/** Payload sent to POST /api/chat */
export interface ChatRequest {
  question: string;
  patient_data: PredictRequest;
  prediction_data: {
    risk: string;
    probability: number;
    top_factors: TopFactor[];
  };
}

/** Response received from POST /api/chat */
export interface ChatResponse {
  answer: string;
}


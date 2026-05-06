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

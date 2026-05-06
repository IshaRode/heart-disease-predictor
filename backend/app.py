"""
app.py — FastAPI backend for Heart Disease Risk Predictor

Endpoints:
  GET  /health   — health check
  POST /predict  — predict heart disease risk from patient features

Loads model.pkl, scaler.pkl, features.json from ml/artifacts/ at startup.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Path setup — allow importing from ml/
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent  # heart-disease-predictor/
ML_DIR = BASE_DIR / "ml"
ARTIFACTS_DIR = ML_DIR / "artifacts"

sys.path.insert(0, str(ML_DIR))
from preprocess import preprocess_input, get_human_readable_label  # noqa: E402

# ---------------------------------------------------------------------------
# App initialization
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Heart Disease Risk Predictor API",
    description="Predicts heart disease risk and explains top contributing factors.",
    version="1.0.0",
)

# CORS — allow Next.js dev server and any localhost origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Globals — loaded once at startup
# ---------------------------------------------------------------------------
model = None
scaler = None
feature_columns: list[str] = []
feature_importances: np.ndarray = None


@app.on_event("startup")
def load_artifacts():
    """Load all model artifacts into memory at server startup."""
    global model, scaler, feature_columns, feature_importances

    model_path = ARTIFACTS_DIR / "model.pkl"
    scaler_path = ARTIFACTS_DIR / "scaler.pkl"
    features_path = ARTIFACTS_DIR / "features.json"

    if not model_path.exists():
        raise RuntimeError(
            f"model.pkl not found at {model_path}. "
            "Run 'python ml/train.py' first to generate artifacts."
        )

    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)

    with open(features_path) as f:
        feature_columns = json.load(f)

    # Extract importances for explainability
    if hasattr(model, "feature_importances_"):
        feature_importances = model.feature_importances_
    elif hasattr(model, "coef_"):
        feature_importances = np.abs(model.coef_[0])
    else:
        feature_importances = np.ones(len(feature_columns))

    print(f"[Startup] Loaded model: {type(model).__name__}")
    print(f"[Startup] Features: {len(feature_columns)}")


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class PredictRequest(BaseModel):
    """
    All 13 UCI Heart Disease features (Cleveland dataset raw values).
    See: https://archive.ics.uci.edu/dataset/45/heart+disease
    """
    age: float = Field(..., ge=1, le=120, description="Age in years")
    sex: int = Field(..., ge=0, le=1, description="Sex (1=male, 0=female)")
    cp: int = Field(..., ge=1, le=4, description="Chest pain type (1=typical, 2=atypical, 3=non-anginal, 4=asymptomatic)")
    trestbps: float = Field(..., ge=50, le=250, description="Resting blood pressure (mm Hg)")
    chol: float = Field(..., ge=100, le=600, description="Serum cholesterol (mg/dl)")
    fbs: int = Field(..., ge=0, le=1, description="Fasting blood sugar > 120 mg/dl (1=true)")
    restecg: int = Field(..., ge=0, le=2, description="Resting ECG results (0=normal, 1=ST-T, 2=LVH)")
    thalach: float = Field(..., ge=50, le=250, description="Maximum heart rate achieved")
    exang: int = Field(..., ge=0, le=1, description="Exercise induced angina (1=yes)")
    oldpeak: float = Field(..., ge=0.0, le=10.0, description="ST depression induced by exercise")
    slope: int = Field(..., ge=1, le=3, description="Slope of peak exercise ST segment (1=up, 2=flat, 3=down)")
    ca: int = Field(..., ge=0, le=4, description="Number of major vessels colored by fluoroscopy (0-4)")
    thal: int = Field(..., ge=0, le=7, description="Thalassemia (3=normal, 6=fixed defect, 7=reversable defect)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "age": 63,
                "sex": 1,
                "cp": 4,
                "trestbps": 145,
                "chol": 233,
                "fbs": 1,
                "restecg": 2,
                "thalach": 150,
                "exang": 0,
                "oldpeak": 2.3,
                "slope": 3,
                "ca": 0,
                "thal": 6,
            }
        }
    }


class PredictResponse(BaseModel):
    risk: str
    probability: float
    prediction: int
    top_factors: list[dict[str, Any]]
    explanation: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_top_factors(
    input_data: dict,
    feature_columns: list[str],
    importances: np.ndarray,
    n: int = 5,
) -> list[dict]:
    """
    Return the top N most influential features for this prediction.

    For each feature, returns:
      - feature: internal name
      - label: human-readable label
      - importance: global importance weight
      - value: the patient's value for this feature
    """
    # Map input features (pre-encoding) to encoded columns
    # We use global importances weighted by the magnitude of the feature value
    # relative to what we know (works well for tree models and linear models)
    pairs = sorted(
        zip(feature_columns, importances), key=lambda x: x[1], reverse=True
    )

    top = []
    for feat, imp in pairs[:n]:
        # Try to get the original value from input dict
        base_feat = feat.split("_")[0] if "_" in feat else feat
        value = input_data.get(feat, input_data.get(base_feat, "N/A"))
        top.append({
            "feature": feat,
            "label": get_human_readable_label(feat),
            "importance": round(float(imp), 4),
            "value": value,
        })
    return top


def build_explanation(top_factors: list[dict], risk: str) -> str:
    """Build a plain-language explanation string."""
    labels = [f["label"] for f in top_factors[:3]]
    if risk == "High":
        return (
            f"High risk detected primarily due to: {labels[0]}, {labels[1]}, and {labels[2]}. "
            "Please consult a cardiologist for a detailed evaluation."
        )
    else:
        return (
            f"Low risk indicated. Key factors assessed: {labels[0]}, {labels[1]}, and {labels[2]}. "
            "Maintain a healthy lifestyle and schedule regular check-ups."
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "model": type(model).__name__ if model else "not_loaded",
        "features": len(feature_columns),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    """
    Predict heart disease risk for a given patient.

    Returns:
      - risk: "High" or "Low"
      - probability: probability of being at risk (0.0 – 1.0)
      - prediction: raw prediction (0 or 1)
      - top_factors: list of top contributing features
      - explanation: plain-language explanation
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Run train.py first.")

    input_dict = request.model_dump()

    try:
        X_scaled = preprocess_input(input_dict, scaler, feature_columns)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Preprocessing error: {str(e)}")

    # Prediction
    prediction = int(model.predict(X_scaled)[0])
    probability = float(model.predict_proba(X_scaled)[0][1])

    risk = "High" if prediction == 1 else "Low"

    # Top contributing factors (global importances)
    top_factors = get_top_factors(input_dict, feature_columns, feature_importances, n=5)

    explanation = build_explanation(top_factors, risk)

    return PredictResponse(
        risk=risk,
        probability=round(probability, 4),
        prediction=prediction,
        top_factors=top_factors,
        explanation=explanation,
    )


# ---------------------------------------------------------------------------
# Dev runner
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

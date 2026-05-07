"""
app.py — FastAPI backend for Heart Disease Risk Predictor

Endpoints:
  GET  /health   — health check
  POST /predict  — predict heart disease risk from patient features
  POST /chat     — conversational AI assistant explaining predictions

Loads model.pkl, scaler.pkl, features.json from ml/artifacts/ at startup.
The /chat endpoint delegates to services/llm_service.py which calls the
NVIDIA NIM LLM API. All API credentials are sourced from environment variables.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Path setup — MUST happen before any local package imports.
#
# Uvicorn is launched from the project root as `python3 -m uvicorn backend.app:app`
# so Python's default sys.path does NOT include the `backend/` directory.
# We add it explicitly here so that:
#   - `from services.llm_service import ...` resolves backend/services/
#   - `from preprocess import ...` resolves ml/preprocess.py
# ---------------------------------------------------------------------------
BACKEND_DIR  = Path(__file__).resolve().parent           # .../backend/
BASE_DIR     = BACKEND_DIR.parent                         # .../heart-disease-predictor/
ML_DIR       = BASE_DIR / "ml"
ARTIFACTS_DIR = ML_DIR / "artifacts"

sys.path.insert(0, str(BACKEND_DIR))   # makes `services` importable
sys.path.insert(0, str(ML_DIR))        # makes `preprocess` importable

# ---------------------------------------------------------------------------
# Load .env — read backend/.env before any os.environ.get() calls.
# python-dotenv is optional; if not installed, env vars must be set manually.
# The path is resolved relative to this file so it works regardless of CWD.
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
    _env_path = BACKEND_DIR / ".env"
    if _env_path.exists():
        load_dotenv(dotenv_path=_env_path)
        print(f"[Startup] Loaded .env from {_env_path}")
except ImportError:
    pass  # python-dotenv not installed — rely on shell-exported env vars

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import the reusable LLM service layer.
# Keeping LLM logic in a dedicated service keeps this route file thin and
# makes it easy to swap LLM providers in the future (just update llm_service.py).
from services.llm_service import get_llm_response
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
# Chat endpoint schemas
# ---------------------------------------------------------------------------

class PredictionData(BaseModel):
    """
    Subset of the prediction output passed back from the frontend.
    The chatbot uses this as context when constructing the LLM prompt.
    """
    risk: str = Field(..., description="'High' or 'Low' risk label")
    probability: float = Field(..., ge=0.0, le=1.0, description="Risk probability (0-1)")
    top_factors: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Top contributing features returned by /predict",
    )


class ChatRequest(BaseModel):
    """
    Payload sent to POST /chat.

    The frontend must echo back the original patient_data and prediction_data
    from the /predict response so the LLM has full context to answer questions.
    """
    question: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="User's natural-language question about their prediction",
    )
    patient_data: dict[str, Any] = Field(
        ...,
        description="Original 13-feature patient input (mirrors PredictRequest fields)",
    )
    prediction_data: PredictionData = Field(
        ...,
        description="ML model output from /predict (risk, probability, top_factors)",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "question": "Why is my risk classified as High?",
                "patient_data": {
                    "age": 54, "sex": 1, "cp": 3, "trestbps": 130,
                    "chol": 290, "fbs": 0, "restecg": 0, "thalach": 120,
                    "exang": 1, "oldpeak": 2.6, "slope": 2, "ca": 2, "thal": 7,
                },
                "prediction_data": {
                    "risk": "High",
                    "probability": 0.82,
                    "top_factors": [
                        {"feature": "ca", "label": "Major Vessels (fluoroscopy)", "importance": 0.18, "value": 2},
                        {"feature": "thal", "label": "Thalassemia", "importance": 0.16, "value": 7},
                        {"feature": "cp", "label": "Chest Pain Type", "importance": 0.14, "value": 3},
                    ],
                },
            }
        }
    }


class ChatResponse(BaseModel):
    """Response returned by POST /chat."""
    answer: str = Field(..., description="LLM-generated educational response")


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


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Conversational AI endpoint — explains ML predictions via NVIDIA LLM.

    The endpoint is intentionally thin:
      - Input validation is handled by Pydantic (ChatRequest schema).
      - All LLM orchestration is delegated to services/llm_service.py.
      - No model inference happens here; the chatbot only *explains* predictions.

    Required environment variable: NVIDIA_API_KEY
    """
    try:
        # Delegate entirely to the service layer — keeps route logic minimal
        answer = await get_llm_response(
            patient_data    = request.patient_data,
            prediction_data = request.prediction_data.model_dump(),
            question        = request.question,
        )
    except ValueError as exc:
        # Configuration errors (missing API key, etc.) → 503 so the UI can
        # show a meaningful "service unavailable" message instead of a raw 500.
        raise HTTPException(status_code=503, detail=str(exc))
    except RuntimeError as exc:
        # Upstream LLM errors (rate-limit, timeout, bad response shape)
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        # Catch-all for unexpected failures — never leak raw tracebacks to clients
        raise HTTPException(
            status_code=500,
            detail=f"Internal error while contacting the AI assistant: {exc}",
        )

    return ChatResponse(answer=answer)


# ---------------------------------------------------------------------------
# Dev runner
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

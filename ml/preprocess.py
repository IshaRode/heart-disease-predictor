"""
preprocess.py — Shared preprocessing utilities for Heart Disease Risk Predictor.

This module is imported by both train.py (fitting) and app.py (inference)
to guarantee identical preprocessing logic at training and prediction time.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler


# ---------------------------------------------------------------------------
# Canonical feature configuration
# ---------------------------------------------------------------------------

# Columns to one-hot encode (multi-class categoricals)
CATEGORICAL_COLS = ["cp", "restecg", "slope", "thal"]

# Binary columns kept as-is (already 0/1)
BINARY_COLS = ["sex", "fbs", "exang"]

# Continuous numeric columns (to be scaled)
NUMERIC_COLS = ["age", "trestbps", "chol", "thalach", "oldpeak", "ca"]

# Human-readable labels for feature names shown in explanations
# Keys match the actual pandas get_dummies column names from UCI Cleveland dataset
FEATURE_LABELS = {
    # Numeric / binary
    "age": "Age",
    "sex": "Sex",
    "trestbps": "Resting Blood Pressure",
    "chol": "Serum Cholesterol",
    "fbs": "High Fasting Blood Sugar",
    "thalach": "Max Heart Rate Achieved",
    "exang": "Exercise-Induced Angina",
    "oldpeak": "ST Depression (Exercise vs Rest)",
    "ca": "Major Vessels Colored by Fluoroscopy",
    # Chest pain type (cp_1=typical, 2=atypical, 3=non-anginal, 4=asymptomatic)
    "cp_1": "Typical Angina",
    "cp_2": "Atypical Angina",
    "cp_3": "Non-Anginal Chest Pain",
    "cp_4": "Asymptomatic Chest Pain",
    # Resting ECG (restecg_0=normal, 1=ST-T wave abnormality, 2=LVH)
    "restecg_0": "Normal Resting ECG",
    "restecg_1": "ST-T Wave Abnormality",
    "restecg_2": "Left Ventricular Hypertrophy",
    # Slope of peak ST segment (1=upsloping, 2=flat, 3=downsloping)
    "slope_1": "Upsloping ST Segment",
    "slope_2": "Flat ST Segment",
    "slope_3": "Downsloping ST Segment",
    # Thalassemia (3.0=normal, 6.0=fixed defect, 7.0=reversable defect)
    "thal_3.0": "Normal Thalassemia",
    "thal_6.0": "Fixed Defect Thalassemia",
    "thal_7.0": "Reversable Defect Thalassemia",
}


def build_feature_columns(df: pd.DataFrame) -> list[str]:
    """
    Derive the ordered list of feature column names after one-hot encoding.
    Call this after get_dummies has been applied to the training DataFrame.
    Used to save features.json for inference consistency.
    """
    return list(df.columns)


def encode_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply one-hot encoding to categorical columns.
    Returns a new DataFrame with encoded features.
    Drops the first dummy to avoid multicollinearity.
    """
    df = df.copy()
    # One-hot encode categorical columns that are present
    cols_to_encode = [c for c in CATEGORICAL_COLS if c in df.columns]
    df = pd.get_dummies(df, columns=cols_to_encode, drop_first=False)
    return df


def align_to_feature_list(df: pd.DataFrame, feature_columns: list[str]) -> pd.DataFrame:
    """
    Reindex DataFrame to match the exact training feature column order.
    Missing columns (e.g. from sparse categoricals) are filled with 0.
    Extra columns are dropped.
    """
    return df.reindex(columns=feature_columns, fill_value=0)


def preprocess_input(
    data_dict: dict,
    scaler: StandardScaler,
    feature_columns: list[str],
) -> np.ndarray:
    """
    Preprocess a single inference input dict into a scaled numpy array
    ready for model.predict() / model.predict_proba().

    Args:
        data_dict: Raw feature values (e.g. from API request body).
        scaler: Fitted StandardScaler from training.
        feature_columns: Ordered list of feature columns from training.

    Returns:
        2D numpy array of shape (1, n_features).
    """
    df = pd.DataFrame([data_dict])

    # Convert all values to numeric, coercing errors to NaN
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Impute missing values with column median (fallback to 0)
    for col in df.columns:
        if df[col].isnull().any():
            df[col] = df[col].fillna(0)

    # Encode categoricals
    df = encode_dataframe(df)

    # Align columns to training order (adds missing OHE columns as 0)
    df = align_to_feature_list(df, feature_columns)

    # Scale
    scaled = scaler.transform(df)
    return scaled


def get_human_readable_label(feature_name: str) -> str:
    """Return a friendly display name for a feature column."""
    return FEATURE_LABELS.get(feature_name, feature_name.replace("_", " ").title())

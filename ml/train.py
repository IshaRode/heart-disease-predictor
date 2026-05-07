"""
train.py — Heart Disease Risk Predictor Training Pipeline

Steps:
  1. Download UCI Heart Disease dataset via ucimlrepo
  2. Binarize target variable (0 → no disease, 1-4 → at risk)
  3. Handle missing values (median/mode imputation)
  4. One-hot encode categorical features
  5. Fit StandardScaler on training features
  6. Train: Logistic Regression, Random Forest, SVM (linear kernel)
  7. Evaluate all models on test set (Accuracy, Precision, Recall, F1)
  8. Select best model by Recall (tiebreak: F1)
  9. Save model.pkl, scaler.pkl, features.json to ml/artifacts/

Usage:
    python ml/train.py
"""

import json
import os
import sys
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# Add ml/ to path so preprocess can be imported
sys.path.insert(0, BASE_DIR)
from preprocess import (  # noqa: E402
    CATEGORICAL_COLS,
    encode_dataframe,
    build_feature_columns,
)


# ---------------------------------------------------------------------------
# 1. Load dataset
# ---------------------------------------------------------------------------

def load_dataset() -> pd.DataFrame:
    """
    Load the UCI Heart Disease dataset.
    Tries local CSV first; falls back to ucimlrepo download.
    """
    local_csv = os.path.join(DATA_DIR, "heart.csv")
    if os.path.exists(local_csv):
        print(f"[Data] Loading from local file: {local_csv}")
        df = pd.read_csv(local_csv)
        return df

    print("[Data] Downloading UCI Heart Disease dataset via ucimlrepo...")
    try:
        from ucimlrepo import fetch_ucirepo
        dataset = fetch_ucirepo(id=45)  # Heart Disease dataset ID on UCI
        X = dataset.data.features
        y = dataset.data.targets
        df = pd.concat([X, y], axis=1)
        # Save locally for future runs
        df.to_csv(local_csv, index=False)
        print(f"[Data] Saved to {local_csv}")
        return df
    except Exception as e:
        print(f"[Error] Failed to download dataset: {e}")
        print("Please manually place 'heart.csv' in ml/data/ and re-run.")
        sys.exit(1)


# ---------------------------------------------------------------------------
# 2. Preprocess
# ---------------------------------------------------------------------------

def preprocess(df: pd.DataFrame):
    """
    Full preprocessing pipeline for training:
    - Normalize column names
    - Binarize target (0 → 0, 1-4 → 1)
    - Handle missing values
    - One-hot encode categoricals
    - Train/test split
    - Fit and apply StandardScaler

    Returns:
        X_train_scaled, X_test_scaled, y_train, y_test, scaler, feature_columns
    """
    df = df.copy()

    # Normalize column names to lowercase
    df.columns = [c.strip().lower() for c in df.columns]

    # Identify the target column
    target_col = None
    for candidate in ["target", "num", "condition"]:
        if candidate in df.columns:
            target_col = candidate
            break
    if target_col is None:
        # Last column as fallback
        target_col = df.columns[-1]
        print(f"[Warn] Target column not found by name; using '{target_col}'")

    print(f"[Data] Target column: '{target_col}'")
    print(f"[Data] Raw target value counts:\n{df[target_col].value_counts().to_string()}\n")

    # Binarize target: 0 → 0 (no disease), 1-4 → 1 (at risk)
    df[target_col] = df[target_col].apply(lambda x: 0 if x == 0 else 1)
    print(f"[Data] Binarized target distribution:\n{df[target_col].value_counts().to_string()}\n")

    # Separate features and target
    y = df[target_col]
    X = df.drop(columns=[target_col])

    # Convert all columns to numeric (coerce non-numeric to NaN)
    X = X.apply(pd.to_numeric, errors="coerce")

    # Impute missing values
    print(f"[Data] Missing values per column:\n{X.isnull().sum().to_string()}\n")
    for col in X.columns:
        if X[col].isnull().any():
            if col in CATEGORICAL_COLS:
                fill_val = X[col].mode()[0] if not X[col].mode().empty else 0
            else:
                fill_val = X[col].median()
            X[col] = X[col].fillna(fill_val)
            print(f"[Data] Imputed '{col}' with {fill_val}")

    print(f"\n[Data] Dataset shape after imputation: {X.shape}")

    # One-hot encode categorical columns
    X_encoded = encode_dataframe(X)
    print(f"[Data] Shape after OHE: {X_encoded.shape}")
    print(f"[Data] Features: {list(X_encoded.columns)}\n")

    # Train/test split (80/20, stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X_encoded, y, test_size=0.2, random_state=42, stratify=y
    )

    # Fit StandardScaler on training data only
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    feature_columns = build_feature_columns(X_encoded)

    return X_train_scaled, X_test_scaled, y_train, y_test, scaler, feature_columns


# ---------------------------------------------------------------------------
# 3. Model definitions
# ---------------------------------------------------------------------------

def get_models() -> dict:
    """Return candidate models with descriptive names."""
    return {
        "Logistic Regression": LogisticRegression(
            max_iter=1000, random_state=42, class_weight="balanced"
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=200,
            max_depth=10,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=42,
        ),
        "SVM (Linear)": SVC(
            kernel="linear",
            probability=True,
            class_weight="balanced",
            random_state=42,
        ),
    }


# ---------------------------------------------------------------------------
# 4. Evaluation
# ---------------------------------------------------------------------------

def evaluate_model(model, X_test, y_test) -> dict:
    """Return accuracy, precision, recall, and F1 for a fitted model."""
    y_pred = model.predict(X_test)
    return {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_test, y_pred, zero_division=0), 4),
        "f1": round(f1_score(y_test, y_pred, zero_division=0), 4),
    }


def print_comparison_table(results: dict):
    """Pretty-print a model comparison table."""
    header = f"{'Model':<25} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1':>10}"
    print("\n" + "=" * 67)
    print(" MODEL COMPARISON TABLE")
    print("=" * 67)
    print(header)
    print("-" * 67)
    for model_name, metrics in results.items():
        print(
            f"{model_name:<25} "
            f"{metrics['accuracy']:>10.4f} "
            f"{metrics['precision']:>10.4f} "
            f"{metrics['recall']:>10.4f} "
            f"{metrics['f1']:>10.4f}"
        )
    print("=" * 67)


def select_best_model(results: dict) -> str:
    """
    Select model with highest Recall.
    Tiebreak: highest F1.
    """
    best = max(results.items(), key=lambda kv: (kv[1]["recall"], kv[1]["f1"]))
    return best[0]


# ---------------------------------------------------------------------------
# 5. Serialization
# ---------------------------------------------------------------------------

def save_artifacts(model, scaler: StandardScaler, feature_columns: list[str]):
    """Save model, scaler, and feature list to ml/artifacts/."""
    model_path = os.path.join(ARTIFACTS_DIR, "model.pkl")
    scaler_path = os.path.join(ARTIFACTS_DIR, "scaler.pkl")
    features_path = os.path.join(ARTIFACTS_DIR, "features.json")

    joblib.dump(model, model_path)
    print(f"\n[Save] Model saved → {model_path}")

    joblib.dump(scaler, scaler_path)
    print(f"[Save] Scaler saved → {scaler_path}")

    with open(features_path, "w") as f:
        json.dump(feature_columns, f, indent=2)
    print(f"[Save] Feature list saved → {features_path}")


# ---------------------------------------------------------------------------
# 6. Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 67)
    print(" HEART DISEASE RISK PREDICTOR — TRAINING PIPELINE")
    print("=" * 67)

    # Load data
    df = load_dataset()

    # Preprocess
    X_train, X_test, y_train, y_test, scaler, feature_columns = preprocess(df)

    # Train and evaluate all models
    models = get_models()
    fitted_models = {}
    results = {}

    print("[Train] Training models...\n")
    for name, model in models.items():
        print(f"  → Training {name}...")
        model.fit(X_train, y_train)
        fitted_models[name] = model
        results[name] = evaluate_model(model, X_test, y_test)
        print(f"     Recall={results[name]['recall']:.4f}  F1={results[name]['f1']:.4f}")

    # Print comparison
    print_comparison_table(results)

    # Select best
    best_name = select_best_model(results)
    best_model = fitted_models[best_name]
    best_metrics = results[best_name]

    print(f"\n[Selection] Best model: {best_name}")
    print(f"  Justification: Highest Recall ({best_metrics['recall']:.4f}) "
          f"to minimize false negatives (missed disease cases).")
    print(f"  Metrics — Accuracy: {best_metrics['accuracy']:.4f} | "
          f"Precision: {best_metrics['precision']:.4f} | "
          f"Recall: {best_metrics['recall']:.4f} | "
          f"F1: {best_metrics['f1']:.4f}")

    # Feature importances (for transparency)
    print("\n[Explainability] Top feature importances:")
    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
    elif hasattr(best_model, "coef_"):
        importances = np.abs(best_model.coef_[0])
    else:
        importances = np.ones(len(feature_columns))

    fi_pairs = sorted(zip(feature_columns, importances), key=lambda x: x[1], reverse=True)
    for feat, imp in fi_pairs[:5]:
        print(f"  {feat:<40} {imp:.4f}")

    # Save artifacts
    save_artifacts(best_model, scaler, feature_columns)

    print("\n[Done] Training complete. Artifacts saved to ml/artifacts/")
    print("Run the API with: uvicorn backend.app:app --reload --port 8000")


if __name__ == "__main__":
    main()

"""
llm_service.py — Reusable service layer for NVIDIA LLM integration.

Architecture decisions:
- All credentials are sourced from environment variables (NVIDIA_API_KEY).
  Never hardcode API keys in source code.
- The service is stateless (no class instantiation required) — functions are
  imported directly, making them easy to test and mock.
- Prompt construction is centralised here so the route layer stays thin and
  focused purely on HTTP concerns.
- httpx is used for async I/O so the FastAPI event loop is never blocked.
- Comprehensive error handling surfaces actionable messages to the caller.

NVIDIA NIM API compatibility:
  The NVIDIA hosted NIM endpoints follow the OpenAI chat-completions schema.
  We target `meta/llama-3.1-8b-instruct` by default; swap the model name or
  base URL via environment variables to switch providers with zero code change.
"""

import os
import httpx

# ---------------------------------------------------------------------------
# Configuration — sourced entirely from environment variables
# ---------------------------------------------------------------------------

# Your NVIDIA API key — set this in the environment, never in source.
# Generate one at: https://build.nvidia.com/
NVIDIA_API_KEY: str = os.environ.get("NVIDIA_API_KEY", "")

# NVIDIA NIM base URL (OpenAI-compatible chat/completions endpoint)
NVIDIA_BASE_URL: str = os.environ.get(
    "NVIDIA_BASE_URL",
    "https://integrate.api.nvidia.com/v1",
)

# LLM model name — change via env var to switch models without code edits
NVIDIA_MODEL: str = os.environ.get(
    "NVIDIA_MODEL",
    "meta/llama-3.1-8b-instruct",
)

# Generation hyper-parameters — sensible defaults for a health-assistant use-case
MAX_TOKENS: int = int(os.environ.get("LLM_MAX_TOKENS", "512"))
TEMPERATURE: float = float(os.environ.get("LLM_TEMPERATURE", "0.6"))
TOP_P: float = float(os.environ.get("LLM_TOP_P", "0.9"))

# HTTP timeout in seconds for the upstream LLM call
REQUEST_TIMEOUT: float = float(os.environ.get("LLM_TIMEOUT_SECS", "30.0"))

# ---------------------------------------------------------------------------
# System prompt — defines the assistant's role and hard safety guardrails.
# This is used verbatim as specified in the product requirements.
# ---------------------------------------------------------------------------

SYSTEM_PROMPT: str = """You are an AI healthcare assistant integrated into a Heart Disease Risk Prediction System.

Your role is to:
- Explain the ML model prediction in simple and clear language
- Help users understand which health factors contributed to the prediction
- Answer user questions related to the prediction and heart health

You are NOT a doctor and must NOT:
- Provide medical diagnosis
- Prescribe medications
- Claim certainty
- Create fear or panic

Always:
- Mention that this is an AI-generated risk assessment
- Encourage consulting a healthcare professional for medical advice
- Use supportive and educational language

You will receive:
1. User medical attributes
2. ML model prediction
3. Probability score
4. Top contributing factors

Use this information to answer the user's question conversationally and clearly."""


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

# Human-readable labels for the 13 UCI Cleveland features
_FEATURE_LABELS: dict[str, str] = {
    "age":      "Age (years)",
    "sex":      "Sex",
    "cp":       "Chest Pain Type",
    "trestbps": "Resting Blood Pressure (mm Hg)",
    "chol":     "Serum Cholesterol (mg/dl)",
    "fbs":      "Fasting Blood Sugar > 120 mg/dl",
    "restecg":  "Resting ECG Results",
    "thalach":  "Max Heart Rate Achieved",
    "exang":    "Exercise-Induced Angina",
    "oldpeak":  "ST Depression (exercise vs rest)",
    "slope":    "Slope of Peak ST Segment",
    "ca":       "Number of Major Vessels (fluoroscopy)",
    "thal":     "Thalassemia",
}

# Categorical value maps for readable display
_VALUE_MAPS: dict[str, dict] = {
    "sex":     {0: "Female", 1: "Male"},
    "cp":      {1: "Typical Angina", 2: "Atypical Angina", 3: "Non-Anginal Pain", 4: "Asymptomatic"},
    "fbs":     {0: "No", 1: "Yes"},
    "restecg": {0: "Normal", 1: "ST-T Wave Abnormality", 2: "LVH"},
    "exang":   {0: "No", 1: "Yes"},
    "slope":   {1: "Upsloping", 2: "Flat", 3: "Downsloping"},
    "thal":    {3: "Normal", 6: "Fixed Defect", 7: "Reversable Defect"},
}


def _format_value(feature: str, raw_value) -> str:
    """Return a human-readable string for a feature value."""
    mapping = _VALUE_MAPS.get(feature)
    if mapping and isinstance(raw_value, (int, float)):
        readable = mapping.get(int(raw_value))
        if readable:
            return f"{readable} ({int(raw_value)})"
    if isinstance(raw_value, float):
        return str(round(raw_value, 2))
    return str(raw_value)


def build_llm_prompt(
    patient_data: dict,
    prediction_data: dict,
    question: str,
) -> str:
    """
    Construct the structured user-turn prompt sent to the LLM.

    Combines:
      1. Patient information section (formatted feature → value pairs)
      2. Model prediction output (risk level + probability)
      3. Top contributing factors list
      4. The user's question

    Guardrails are reinforced here in addition to the system prompt to create
    a "belt and suspenders" safety approach: even if the system prompt is
    altered, the user-turn reminds the model of its boundaries.
    """

    # --- Patient Information Section ---
    patient_lines: list[str] = []
    for feat, label in _FEATURE_LABELS.items():
        raw = patient_data.get(feat)
        if raw is not None:
            patient_lines.append(f"- {label}: {_format_value(feat, raw)}")

    patient_block = "\n".join(patient_lines) if patient_lines else "- No patient data provided"

    # --- Model Prediction Section ---
    risk        = prediction_data.get("risk", "Unknown")
    probability = prediction_data.get("probability", 0.0)
    prob_pct    = round(float(probability) * 100, 1)

    prediction_block = (
        f"- Heart Disease Risk: {risk}\n"
        f"- Probability Score: {prob_pct}%\n"
        f"  (This is an AI-generated estimate, not a clinical diagnosis)"
    )

    # --- Top Contributing Factors Section ---
    top_factors: list = prediction_data.get("top_factors", [])
    if top_factors:
        factor_lines = [
            f"- {i+1}. {f.get('label', f.get('feature', 'Unknown'))} "
            f"(importance: {round(float(f.get('importance', 0)), 4)}, "
            f"patient value: {f.get('value', 'N/A')})"
            for i, f in enumerate(top_factors[:5])
        ]
        factors_block = "\n".join(factor_lines)
    else:
        factors_block = "- No factor data available"

    # Compose the final structured prompt with an embedded reminder of the
    # assistant's non-diagnostic role (additional guardrail layer).
    prompt = f"""Patient Information:
{patient_block}

Model Prediction:
{prediction_block}

Top Contributing Factors:
{factors_block}

REMINDER: You are an educational AI assistant. Do not diagnose, prescribe, or claim certainty. Always recommend professional medical consultation.

User Question: {question}"""

    return prompt


# ---------------------------------------------------------------------------
# Async LLM call
# ---------------------------------------------------------------------------

async def get_llm_response(
    patient_data: dict,
    prediction_data: dict,
    question: str,
) -> str:
    """
    Send a structured prompt to the NVIDIA NIM LLM and return the response text.

    This function is async so it integrates cleanly with FastAPI's async
    request handling without blocking the event loop.

    Args:
        patient_data:    Raw form fields submitted by the user (age, sex, cp, …)
        prediction_data: ML model output {risk, probability, top_factors}
        question:        The user's natural-language question

    Returns:
        The assistant's reply as a plain string.

    Raises:
        ValueError:  Configuration error (missing API key, etc.)
        RuntimeError: Upstream API error or unexpected response shape.
    """

    # Guard: API key must be configured
    if not NVIDIA_API_KEY:
        raise ValueError(
            "NVIDIA_API_KEY environment variable is not set. "
            "Obtain a key from https://build.nvidia.com/ and export it before starting the server."
        )

    # Build the structured prompt for this request
    user_prompt = build_llm_prompt(patient_data, prediction_data, question)

    # Construct the OpenAI-compatible request payload
    payload: dict = {
        "model": NVIDIA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt},
        ],
        "temperature": TEMPERATURE,
        "top_p":       TOP_P,
        "max_tokens":  MAX_TOKENS,
        "stream":      False,  # streaming is not needed for the chat panel MVP
    }

    headers: dict = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type":  "application/json",
        "Accept":        "application/json",
    }

    # Make the async HTTP request — httpx is used to avoid blocking the event loop
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            response = await client.post(
                f"{NVIDIA_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
        except httpx.TimeoutException:
            raise RuntimeError(
                f"Request to NVIDIA LLM timed out after {REQUEST_TIMEOUT}s. "
                "Try again or increase LLM_TIMEOUT_SECS."
            )
        except httpx.RequestError as exc:
            raise RuntimeError(f"Network error contacting NVIDIA LLM: {exc}") from exc

    # Surface upstream API errors with actionable messages
    if response.status_code == 401:
        raise ValueError("Invalid NVIDIA_API_KEY. Check your key at https://build.nvidia.com/")
    if response.status_code == 429:
        raise RuntimeError("NVIDIA API rate limit reached. Please wait a moment and try again.")
    if response.status_code >= 400:
        raise RuntimeError(
            f"NVIDIA API returned HTTP {response.status_code}: {response.text[:300]}"
        )

    # Parse the OpenAI-compatible JSON response
    try:
        data = response.json()
        reply: str = data["choices"][0]["message"]["content"]
        return reply.strip()
    except (KeyError, IndexError, ValueError) as exc:
        raise RuntimeError(
            f"Unexpected response shape from NVIDIA LLM: {exc}. "
            f"Raw response: {response.text[:300]}"
        ) from exc

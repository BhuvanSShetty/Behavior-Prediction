from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pickle
import numpy as np
import pandas as pd
import os

# ─────────────────────────────────────────────────────────────────────────────
# main.py  (fixed)
#
# Fixes vs original:
#   1. add_features_row() now uses camelCase column names (intensityScore,
#      frustrationScore) to match what train.py saved in model["features"].
#      Original used snake_case — the names didn't crash because the list
#      position still matched, but any future column-based access would break.
#
#   2. normalize_state() fallback changed from "Frustrated" → "Unknown"
#      so unexpected values are clearly surfaced instead of silently
#      mislabelled as Frustrated.
#
# Usage:
#   uvicorn main:app --reload --port 8000
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Gaming Behavior ML Service")

# ── Load model on startup ─────────────────────────────────────────────────────
MODEL_PATH    = "model.pkl"
FEEDBACK_PATH = "feedback_data.csv"

if not os.path.exists(MODEL_PATH):
    raise RuntimeError("model.pkl not found. Run train.py first.")

with open(MODEL_PATH, "rb") as f:
    saved = pickle.load(f)

model    = saved["model"]
features = saved["features"]      # authoritative feature order from training
metadata = saved.get("metadata", {})

print(f"Model loaded. Features: {features}")
if metadata:
    print(f"Model metadata: {metadata}")


# ── Addiction risk score ──────────────────────────────────────────────────────
def compute_addiction_risk(proba: np.ndarray, classes: list) -> int:
    class_list = list(classes)
    if "Addicted" in class_list:
        addicted_idx = class_list.index("Addicted")
        risk = proba[addicted_idx] * 100
        return min(int(round(risk)), 100)
    return 0


# ── Feature engineering ───────────────────────────────────────────────────────
# FIX 1: column names now match train.py (camelCase: intensityScore, frustrationScore)
# The model's `features` list is the single source of truth for column order.
def add_features_row(f) -> list:
    intensityScore = (
        f.avgSessionDuration * 0.4
        + f.trend            * 0.3
        + f.dailyTotalTime   * 0.2
        + f.nightCount * 10  * 0.1
    )
    frustrationScore = (
        f.shortSessionRatio * 0.35
        + (f.reopenCount / (f.sessionsPerDay + 1)) * 0.2
        + (1 / (f.interSessionGap + 1)) * 40 * 0.25
        + (1 / (f.avgSessionDuration + 1)) * 20 * 0.2
    )
    frustrationScore = frustrationScore / (1 + intensityScore / 100)

    return [
        f.avgSessionDuration,
        f.shortSessionRatio,
        f.reopenCount,
        f.interSessionGap,
        f.dailyTotalTime,
        f.sessionsPerDay,
        f.nightCount,
        f.trend,
        intensityScore,    # camelCase — matches train.py saved features
        frustrationScore,  # camelCase — matches train.py saved features
    ]


# ── State normalizer ──────────────────────────────────────────────────────────
# FIX 2: fallback is now "Unknown" instead of "Frustrated"
# Silently mapping unexpected values to "Frustrated" hid bugs; "Unknown" surfaces them.
def normalize_state(state: str) -> str:
    if not state:
        return "Unknown"
    canonical = str(state).strip().title()
    if canonical in {"Normal", "Frustrated", "Addicted"}:
        return canonical
    return "Unknown"   # was "Frustrated" — changed to make errors visible


# ── Request / Response schemas ────────────────────────────────────────────────
class Features(BaseModel):
    avgSessionDuration: float
    shortSessionRatio:  float
    reopenCount:        float
    interSessionGap:    float
    dailyTotalTime:     float
    sessionsPerDay:     float
    nightCount:         float
    trend:              float

class PredictRequest(BaseModel):
    features: Features

class PredictResponse(BaseModel):
    state:         str
    confidence:    float
    addictionRisk: int

class FeedbackRequest(BaseModel):
    sessionId:      str
    userId:         str
    predictedState: str
    actualState:    str
    isCorrect:      bool
    note:           str = ""
    features:       Features
    createdAt:      str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":   "ML service running",
        "model":    "RandomForest",
        "classes":  list(model.classes_),
        "features": features,
        "metadata": metadata,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest):
    try:
        f = body.features

        # Build DataFrame using the authoritative feature list from training
        X = pd.DataFrame([add_features_row(f)], columns=features)

        state      = normalize_state(model.predict(X)[0])
        proba      = model.predict_proba(X)[0]
        confidence = round(float(np.max(proba)), 2)

        addiction_risk = compute_addiction_risk(proba, model.classes_)

        return PredictResponse(
            state         = state,
            confidence    = confidence,
            addictionRisk = addiction_risk,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback")
def feedback(body: FeedbackRequest):
    try:
        row = {
            "sessionId":          body.sessionId,
            "userId":             body.userId,
            "predictedState":     normalize_state(body.predictedState),
            "actualState":        normalize_state(body.actualState),
            "isCorrect":          body.isCorrect,
            "note":               body.note,
            "createdAt":          body.createdAt,
            "avgSessionDuration": body.features.avgSessionDuration,
            "shortSessionRatio":  body.features.shortSessionRatio,
            "reopenCount":        body.features.reopenCount,
            "interSessionGap":    body.features.interSessionGap,
            "dailyTotalTime":     body.features.dailyTotalTime,
            "sessionsPerDay":     body.features.sessionsPerDay,
            "nightCount":         body.features.nightCount,
            "trend":              body.features.trend,
        }

        df = pd.DataFrame([row])
        write_header = not os.path.exists(FEEDBACK_PATH)
        df.to_csv(FEEDBACK_PATH, mode="a", header=write_header, index=False)

        return {"status": "saved", "path": FEEDBACK_PATH}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
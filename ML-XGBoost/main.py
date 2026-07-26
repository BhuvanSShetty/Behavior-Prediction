from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pickle
import numpy as np
import pandas as pd
import os
import threading

# ─────────────────────────────────────────────────────────────────────────────
# main.py for ML-XGBoost service (Independent XGBoost Model Service)
#
# Endpoints:
#   GET  /health          — model info + metrics
#   POST /predict         — predict behavior state from features
#   POST /retrain         — accept feedback data, retrain XGBoost model, hot-swap
#   GET  /retrain/status  — current model metadata
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Gaming Behavior ML Service (XGBoost)")

MODEL_PATH    = "model.pkl"
FEEDBACK_PATH = "feedback_data.csv"

_retrain_lock = threading.Lock()   # prevent concurrent retrains

if not os.path.exists(MODEL_PATH):
    raise RuntimeError("model.pkl not found. Run train.py first.")

with open(MODEL_PATH, "rb") as f:
    saved = pickle.load(f)

model    = saved["model"]
features = saved["features"]      # authoritative feature order from training
metadata = saved.get("metadata", {})

print(f"XGBoost Model loaded. Features: {features}")
if metadata:
    print(f"Model metadata: {metadata}")


def compute_addiction_risk(proba: np.ndarray, classes: list) -> int:
    class_list = list(classes)
    if "Addicted" in class_list:
        addicted_idx = class_list.index("Addicted")
        risk = proba[addicted_idx] * 100
        return min(int(round(risk)), 100)
    return 0


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
        intensityScore,
        frustrationScore,
    ]


def normalize_state(state: str) -> str:
    if not state:
        return "Unknown"
    canonical = str(state).strip().title()
    if canonical in {"Normal", "Frustrated", "Addicted"}:
        return canonical
    return "Unknown"


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


class FeedbackRow(BaseModel):
    sessionId:          str
    avgSessionDuration: float
    shortSessionRatio:  float
    reopenCount:        float
    interSessionGap:    float
    dailyTotalTime:     float
    sessionsPerDay:     float
    nightCount:         float
    trend:              float
    actualState:        str

class RetrainRequest(BaseModel):
    feedbackRows: list[FeedbackRow]

class RetrainResponse(BaseModel):
    status:          str
    feedbackSamples: int
    metrics:         dict
    trainedAt:       str


@app.get("/health")
def health():
    return {
        "status":   "ML service running",
        "model":    metadata.get("modelName", "XGBoost"),
        "classes":  list(model.classes_),
        "features": features,
        "metadata": metadata,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest):
    try:
        f = body.features

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


@app.post("/retrain", response_model=RetrainResponse)
def retrain(body: RetrainRequest):
    """
    Accept feedback data from the backend, save as CSV,
    retrain the XGBoost model, and hot-swap it in memory.
    """
    global model, features, metadata

    if not _retrain_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Retrain already in progress")

    try:
        rows = [row.model_dump() for row in body.feedbackRows]
        if not rows:
            raise HTTPException(status_code=400, detail="No feedback rows provided")

        df = pd.DataFrame(rows)
        df.to_csv(FEEDBACK_PATH, index=False)
        print(f"Saved {len(rows)} feedback rows → {FEEDBACK_PATH}")

        from train import train as run_training
        result_metadata = run_training()

        with open(MODEL_PATH, "rb") as f:
            saved = pickle.load(f)

        model    = saved["model"]
        features = saved["features"]
        metadata = saved.get("metadata", {})
        print(f"XGBoost Model hot-swapped. New metadata: {metadata}")

        return RetrainResponse(
            status="success",
            feedbackSamples=len(rows),
            metrics=result_metadata.get("metrics", {}),
            trainedAt=result_metadata.get("trainedAt", ""),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retrain failed: {str(e)}")
    finally:
        _retrain_lock.release()


@app.get("/retrain/status")
def retrain_status():
    """Return the current model metadata (last trained, metrics, etc.)."""
    return {
        "modelName":       metadata.get("modelName", "XGBoost"),
        "trainedAt":       metadata.get("trainedAt", "unknown"),
        "classes":         metadata.get("classes", []),
        "feedbackSamples": metadata.get("feedbackSamples", 0),
        "classDistrib":    metadata.get("classDistrib", {}),
        "metrics":         metadata.get("metrics", {}),
    }


@app.get("/experiment-results")
def experiment_results():
    """Return the full research experiment results (predictions, CV folds, feature importances)."""
    import json
    path = "experiment_results.json"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="experiment_results.json not found")
    with open(path, "r") as f:
        return json.load(f)

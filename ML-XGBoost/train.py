import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold, GridSearchCV
from sklearn.metrics import (
    classification_report, accuracy_score, confusion_matrix,
    ConfusionMatrixDisplay, f1_score, balanced_accuracy_score,
    roc_auc_score, cohen_kappa_score
)
from xgboost import XGBClassifier
import matplotlib
matplotlib.use('Agg')       # headless — must be before pyplot import
import matplotlib.pyplot as plt
import pickle
import json
import random
from datetime import datetime, timezone
import os
import warnings
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# train.py for ML-XGBoost service (independent XGBoost model)
#
# Identical data generation and seed (42) as ML/train.py for fair comparison.
# ─────────────────────────────────────────────────────────────────────────────

np.random.seed(42)
random.seed(42)

# ── Config ────────────────────────────────────────────────────────────────────
N                  = 2400           # 800 per class
MODEL_PATH         = os.getenv("MODEL_PATH",                  "model.pkl")
FEEDBACK_PATH      = os.getenv("FEEDBACK_PATH",               "feedback_data.csv")
DATASET_PATH       = os.getenv("DATASET_PATH",                "dataset.csv")
FEEDBACK_WEIGHT    = float(os.getenv("FEEDBACK_WEIGHT",       "5.0"))
MIN_FEEDBACK_ONLY  = int(os.getenv("MIN_FEEDBACK_ONLY_SAMPLES","800"))
TUNE               = os.getenv("TUNE", "0") == "1"


BASE_FEATURES = [
    "avgSessionDuration",
    "shortSessionRatio",
    "reopenCount",
    "interSessionGap",
    "dailyTotalTime",
    "sessionsPerDay",
    "nightCount",
    "trend",
]
ALL_FEATURES = BASE_FEATURES + ["intensityScore", "frustrationScore"]
VALID_STATES = {"Normal", "Frustrated", "Addicted"}


# ── Wrapper for XGBClassifier to make label handling transparent ─────────────
class XGBoostWrapper(BaseEstimator, ClassifierMixin):
    def __init__(self, n_estimators=200, max_depth=4, learning_rate=0.08, subsample=0.85, colsample_bytree=0.8, min_child_weight=5, reg_alpha=0.1, reg_lambda=1.0, random_state=42):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.colsample_bytree = colsample_bytree
        self.min_child_weight = min_child_weight
        self.reg_alpha = reg_alpha
        self.reg_lambda = reg_lambda
        self.random_state = random_state
        self.classes_ = np.array(["Addicted", "Frustrated", "Normal"])

    def fit(self, X, y, sample_weight=None):
        self.classes_ = np.unique(y)
        label_map = {c: i for i, c in enumerate(self.classes_)}
        y_num = np.array([label_map[label] for label in y])
        self.model_ = XGBClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            subsample=self.subsample,
            colsample_bytree=self.colsample_bytree,
            min_child_weight=self.min_child_weight,
            reg_alpha=self.reg_alpha,
            reg_lambda=self.reg_lambda,
            random_state=self.random_state,
            eval_metric="mlogloss"
        )
        self.model_.fit(X, y_num, sample_weight=sample_weight)
        return self

    def predict(self, X):
        y_pred_num = self.model_.predict(X)
        return np.array([self.classes_[idx] for idx in y_pred_num])

    def predict_proba(self, X):
        return self.model_.predict_proba(X)

    @property
    def feature_importances_(self):
        return self.model_.feature_importances_


# ── Feature engineering — must match main.py exactly ─────────────────────────
def add_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["intensityScore"] = (
        df["avgSessionDuration"] * 0.4 +
        df["trend"]              * 0.3 +
        df["dailyTotalTime"]     * 0.2 +
        df["nightCount"]         * 10  * 0.1
    )
    df["frustrationScore"] = (
        df["shortSessionRatio"]  * 0.35 +
        (df["reopenCount"] / (df["sessionsPerDay"] + 1)) * 0.2 +
        (1 / (df["interSessionGap"] + 1))    * 40 * 0.25 +
        (1 / (df["avgSessionDuration"] + 1)) * 20 * 0.2
    )
    df["frustrationScore"] = df["frustrationScore"] / (1 + df["intensityScore"] / 100)
    return df


# ── Balanced synthetic data generator (identical to ML/train.py) ──────────────
def generate_data() -> pd.DataFrame:
    n_per_class = N // 3
    rows = []

    for label in ["Addicted", "Frustrated", "Normal"]:
        for _ in range(n_per_class):
            sessionsPerDay = np.random.randint(1, 15)
            nightCount     = np.random.randint(0, 5)

            if label == "Addicted":
                avgSessionDuration = np.clip(np.random.normal(60, 25), 15, 130)
                trend              = np.clip(np.random.normal(40, 35), -20, 130)
                dailyTotalTime     = np.clip(np.random.normal(240, 90), 60, 500)
                shortSessionRatio  = np.clip(np.random.beta(2, 5), 0, 0.7)
                interSessionGap    = np.clip(np.random.normal(60, 50), 5, 280)
                reopenCount        = int(shortSessionRatio * sessionsPerDay + np.random.randint(0, 3))
            elif label == "Frustrated":
                avgSessionDuration = np.clip(np.random.normal(30, 20), 10, 90)
                trend              = np.clip(np.random.normal(10, 30), -40, 90)
                dailyTotalTime     = np.clip(np.random.normal(130, 70), 30, 350)
                shortSessionRatio  = np.clip(np.random.beta(4, 3), 0.1, 0.95)
                interSessionGap    = np.clip(np.random.normal(90, 60), 5, 280)
                reopenCount        = int(shortSessionRatio * sessionsPerDay + np.random.randint(1, 5))
            else:  # Normal
                avgSessionDuration = np.clip(np.random.normal(35, 20), 10, 95)
                trend              = np.clip(np.random.normal(10, 25), -35, 80)
                dailyTotalTime     = np.clip(np.random.normal(120, 60), 30, 300)
                shortSessionRatio  = np.clip(np.random.beta(2, 3), 0.05, 0.85)
                interSessionGap    = np.clip(np.random.normal(130, 65), 10, 300)
                reopenCount        = int(shortSessionRatio * sessionsPerDay + np.random.randint(0, 3))

            rows.append({
                "avgSessionDuration": round(float(avgSessionDuration), 2),
                "shortSessionRatio":  round(float(shortSessionRatio), 3),
                "reopenCount":        int(reopenCount),
                "interSessionGap":    round(float(interSessionGap), 2),
                "dailyTotalTime":     round(float(dailyTotalTime), 2),
                "sessionsPerDay":     int(sessionsPerDay),
                "nightCount":         int(nightCount),
                "trend":              round(float(trend), 2),
                "label":              label,
            })

    df = pd.DataFrame(rows)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)   # shuffle
    return df


# ── Load real feedback data ───────────────────────────────────────────────────
def load_feedback(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        print("No feedback file found — using synthetic data only.")
        return pd.DataFrame()
    try:
        df = pd.read_csv(path)
    except Exception as e:
        print(f"Could not read feedback file: {e}")
        return pd.DataFrame()

    required = set(BASE_FEATURES + ["actualState"])
    if not required.issubset(df.columns):
        print(f"Feedback missing columns: {required - set(df.columns)}")
        return pd.DataFrame()

    if "sessionId" in df.columns:
        df = df.sort_values("sessionId").drop_duplicates(subset=["sessionId"], keep="last")

    df["label"] = df["actualState"].str.strip().str.title()
    df = df[df["label"].isin(VALID_STATES)]
    df = df.dropna(subset=BASE_FEATURES + ["label"])
    df["source"] = "feedback"
    df["weight"] = FEEDBACK_WEIGHT
    print(f"Loaded {len(df)} feedback samples  |  {df['label'].value_counts().to_dict()}")
    return df[BASE_FEATURES + ["label", "source", "weight"]]


# ── Main training function ────────────────────────────────────────────────────
def train():
    if os.path.exists(DATASET_PATH):
        print(f"Loading standard dataset from {DATASET_PATH}...")
        synthetic = pd.read_csv(DATASET_PATH)
        if "source" not in synthetic.columns:
            synthetic["source"] = "synthetic"
        if "weight" not in synthetic.columns:
            synthetic["weight"] = 1.0
    else:
        print(f"Standard dataset '{DATASET_PATH}' not found. Generating balanced dataset...")
        synthetic = generate_data()
        synthetic["source"] = "synthetic"
        synthetic["weight"] = 1.0
        synthetic.to_csv(DATASET_PATH, index=False)
        print(f"Saved standard training dataset → {DATASET_PATH}")

    feedback = load_feedback(FEEDBACK_PATH)

    # Choose data source
    if len(feedback) >= MIN_FEEDBACK_ONLY and feedback["label"].nunique() >= 2:
        df = feedback.copy()
        print("Training on feedback data only.")
    elif feedback.empty:
        df = synthetic.copy()
        print("Training on synthetic data only.")
    else:
        df = pd.concat([synthetic, feedback], ignore_index=True)
        print(f"Training on blended data ({len(synthetic)} synthetic + {len(feedback)} feedback).")

    df = add_features(df)
    print(f"\nDataset: {len(df)} samples")
    print("=== CLASS DISTRIBUTION ===")
    print(df["label"].value_counts())
    print()

    X = df[ALL_FEATURES]
    y = df["label"]
    w = df.get("weight", pd.Series(np.ones(len(df)))).values

    stratify = y if y.value_counts().min() >= 2 else None
    X_train, X_test, y_train, y_test, w_train, _ = train_test_split(
        X, y, w, test_size=0.2, random_state=42, stratify=stratify
    )

    print("Training XGBoost Classifier...")
    model = XGBoostWrapper(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.8,
        min_child_weight=5,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
    )
    model.fit(X_train, y_train, sample_weight=w_train)

    # ── Evaluation ──────────────────────────────────────────────────────────
    y_pred    = model.predict(X_test)
    y_proba   = model.predict_proba(X_test)
    train_acc = model.score(X_train, y_train)
    test_acc  = accuracy_score(y_test, y_pred)
    bal_acc   = balanced_accuracy_score(y_test, y_pred)
    f1_mac    = f1_score(y_test, y_pred, average="macro",    zero_division=0)
    f1_w      = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    roc_auc   = roc_auc_score(y_test, y_proba, multi_class="ovr", average="macro")
    kappa     = cohen_kappa_score(y_test, y_pred)
    gap       = train_acc - test_acc

    print("=== ACCURACY & RESEARCH METRICS ===")
    print(f"  Train accuracy     : {train_acc:.4f}")
    print(f"  Test  accuracy     : {test_acc:.4f}")
    print(f"  Balanced accuracy  : {bal_acc:.4f}  ← key metric")
    print(f"  Overfitting gap    : {gap:.4f}", "✅" if gap < 0.08 else "⚠️  still overfitting")
    print(f"  F1 macro           : {f1_mac:.4f}  ← key metric")
    print(f"  F1 weighted        : {f1_w:.4f}")
    print(f"  ROC-AUC (ovr macro): {roc_auc:.4f}")
    print(f"  Cohen's Kappa      : {kappa:.4f}")

    print("\n=== CLASSIFICATION REPORT ===")
    print(classification_report(y_test, y_pred, zero_division=0))

    cv = cross_val_score(
        model, X, y, cv=StratifiedKFold(10, shuffle=True, random_state=42),
        scoring="f1_macro", n_jobs=-1
    )
    cv_ci95 = 1.96 * cv.std() / np.sqrt(len(cv))
    print(f"=== 10-FOLD CV (f1_macro) ===  mean={cv.mean():.4f}  std=±{cv.std():.4f}  95% CI=±{cv_ci95:.4f}")
    print(f"  Per fold: {cv.round(4)}")

    print("\n=== FEATURE IMPORTANCE ===")
    fi = sorted(zip(ALL_FEATURES, model.feature_importances_), key=lambda x: -x[1])
    for feat, imp in fi:
        bar = "█" * int(imp * 40)
        print(f"  {feat:<25} {imp:.4f}  {bar}")

    # Confusion matrix
    cm   = confusion_matrix(y_test, y_pred, labels=model.classes_)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=model.classes_)
    fig, ax = plt.subplots(figsize=(7, 6))
    disp.plot(ax=ax, colorbar=False, cmap="Blues")
    ax.set_title(f"Confusion Matrix (XGBoost)  |  F1 macro={f1_mac:.3f}  bal_acc={bal_acc:.3f}")
    plt.tight_layout()
    plt.savefig("confusion_matrix.png", dpi=150)
    plt.close()
    print("\nConfusion matrix → confusion_matrix.png")

    # ── Save model ──────────────────────────────────────────────────────────
    metadata = {
        "modelName":        "XGBoost",
        "trainedAt":        datetime.now(timezone.utc).isoformat(),
        "classes":          list(model.classes_),
        "feedbackSamples":  int(len(feedback)),
        "classDistrib":     df["label"].value_counts().to_dict(),
        "metrics": {
            "trainAcc":    round(float(train_acc), 4),
            "testAcc":     round(float(test_acc),  4),
            "balancedAcc": round(float(bal_acc),   4),
            "f1Macro":     round(float(f1_mac),    4),
            "f1Weighted":  round(float(f1_w),      4),
            "rocAucMacro": round(float(roc_auc),   4),
            "cohenKappa":  round(float(kappa),     4),
            "cvMean":      round(float(cv.mean()), 4),
            "cvStd":       round(float(cv.std()),  4),
            "cvCi95":      round(float(cv_ci95),   4),
            "overfitGap":  round(float(gap),       4),
        },
    }

    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"model": model, "features": ALL_FEATURES, "metadata": metadata}, f)

    # Export experiment_results.json for research paper comparison
    experiment_results = {
        "modelName": "XGBoost",
        "trainedAt": metadata["trainedAt"],
        "classes": metadata["classes"],
        "metrics": metadata["metrics"],
        "featureImportances": dict(zip(ALL_FEATURES, [round(float(x), 4) for x in model.feature_importances_])),
        "cvFolds": [round(float(x), 4) for x in cv],
        "y_test": y_test.tolist(),
        "y_pred": y_pred.tolist(),
        "y_proba": y_proba.tolist(),
    }
    with open("experiment_results.json", "w") as f:
        json.dump(experiment_results, f, indent=2)

    print(f"\nModel saved → {MODEL_PATH} ✅")
    print("Experiment results saved → experiment_results.json ✅")
    print("Run: uvicorn main:app --reload --port 8000")

    return metadata


if __name__ == "__main__":
    train()

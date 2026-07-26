import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold, GridSearchCV
from sklearn.metrics import (
    classification_report, accuracy_score, confusion_matrix,
    ConfusionMatrixDisplay, f1_score, balanced_accuracy_score
)
import matplotlib
matplotlib.use('Agg')       # headless — must be before pyplot import
import matplotlib.pyplot as plt
import pickle
import random
from datetime import datetime, timezone
import os
import warnings
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# train.py  (improved)
#
# Key fixes vs original:
#   1. Standard dataset storage   — uses dataset.csv (2400 balanced samples)
#   2. class_weight="balanced"    — let sklearn compute weights automatically
#   3. max_depth reduced 6 → 4    — less overfitting
#   4. min_samples_leaf raised 5→10
#   5. Evaluation uses f1_macro   — not accuracy (accuracy hides imbalance)
#   6. Optional GridSearchCV      — set TUNE=True to run hyperparameter search
#
# Run: python train.py
# With tuning: TUNE=1 python train.py
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
TUNE               = os.getenv("TUNE", "0") == "1"   # set TUNE=1 to run GridSearchCV


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


# ── Balanced synthetic data generator ────────────────────────────────────────
# FIX: original generator produced ~75% Addicted. This version explicitly
# generates N//3 rows per class so all three classes are equally represented.
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




# ── Optional hyperparameter tuning ───────────────────────────────────────────
def tune_hyperparams(X_train, y_train, w_train):
    print("\nRunning GridSearchCV (this takes a few minutes)...")
    param_grid = {
        "n_estimators":    [100, 200, 300],
        "max_depth":       [3, 4, 5],
        "min_samples_leaf":[5, 10, 15],
        "max_features":    ["sqrt", "log2"],
    }
    rf = RandomForestClassifier(class_weight="balanced", random_state=42)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    gs = GridSearchCV(rf, param_grid, cv=cv, scoring="f1_macro", n_jobs=-1, verbose=1)
    gs.fit(X_train, y_train, sample_weight=w_train)
    print(f"Best params : {gs.best_params_}")
    print(f"Best F1 macro (CV): {gs.best_score_:.4f}")
    return gs.best_estimator_


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

    # Train or tune
    if TUNE:
        model = tune_hyperparams(X_train, y_train, w_train)
    else:
        print("Training Random Forest...")
        model = RandomForestClassifier(
            n_estimators=200,
            max_depth=4,            # FIX: was 6 — reduced to cut overfitting
            min_samples_split=10,
            min_samples_leaf=10,    # FIX: was 5 — more conservative leaves
            max_features="sqrt",
            class_weight="balanced",# FIX: was manual weights — auto-balanced is better
            random_state=42,
        )
        model.fit(X_train, y_train, sample_weight=w_train)

    # ── Evaluation ──────────────────────────────────────────────────────────
    y_pred    = model.predict(X_test)
    train_acc = model.score(X_train, y_train)
    test_acc  = accuracy_score(y_test, y_pred)
    bal_acc   = balanced_accuracy_score(y_test, y_pred)
    f1_mac    = f1_score(y_test, y_pred, average="macro",    zero_division=0)
    f1_w      = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    gap       = train_acc - test_acc

    print("=== ACCURACY ===")
    print(f"  Train accuracy     : {train_acc:.4f}")
    print(f"  Test  accuracy     : {test_acc:.4f}")
    print(f"  Balanced accuracy  : {bal_acc:.4f}  ← key metric (was 0.53, target ≥0.75)")
    print(f"  Overfitting gap    : {gap:.4f}", "✅" if gap < 0.08 else "⚠️  still overfitting")
    print(f"  F1 macro           : {f1_mac:.4f}  ← key metric (was 0.53, target ≥0.70)")
    print(f"  F1 weighted        : {f1_w:.4f}")

    print("\n=== CLASSIFICATION REPORT ===")
    print(classification_report(y_test, y_pred, zero_division=0))

    cv = cross_val_score(
        model, X, y, cv=StratifiedKFold(5, shuffle=True, random_state=42),
        scoring="f1_macro", n_jobs=-1
    )
    print(f"=== 5-FOLD CV (f1_macro) ===  mean={cv.mean():.4f}  std=±{cv.std():.4f}")
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
    ax.set_title(f"Confusion Matrix  |  F1 macro={f1_mac:.3f}  bal_acc={bal_acc:.3f}")
    plt.tight_layout()
    plt.savefig("confusion_matrix.png", dpi=150)
    plt.close()
    print("\nConfusion matrix → confusion_matrix.png")

    # ── Save model ──────────────────────────────────────────────────────────
    metadata = {
        "trainedAt":        datetime.now(timezone.utc).isoformat(),
        "classes":          list(model.classes_),
        "feedbackSamples":  int(len(feedback)),
        "classDistrib":     df["label"].value_counts().to_dict(),
        "metrics": {
            "trainAcc":    round(train_acc, 4),
            "testAcc":     round(test_acc,  4),
            "balancedAcc": round(bal_acc,   4),
            "f1Macro":     round(f1_mac,    4),
            "f1Weighted":  round(f1_w,      4),
            "cvMean":      round(cv.mean(),  4),
            "cvStd":       round(cv.std(),   4),
        },
    }

    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"model": model, "features": ALL_FEATURES, "metadata": metadata}, f)

    print(f"\nModel saved → {MODEL_PATH} ✅")
    print("Run: uvicorn main:app --reload --port 8000")

    return metadata


if __name__ == "__main__":
    train()
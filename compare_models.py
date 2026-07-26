import json
import os
import sys
import urllib.request
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, f1_score,
    roc_curve, auc, confusion_matrix, ConfusionMatrixDisplay
)
from scipy.stats import chi2

# ─────────────────────────────────────────────────────────────────────────────
# compare_models.py — Research Paper Evaluation & Visualizations
#
# Compares two independent ML services:
#   1. RandomForest  (ML/experiment_results.json)
#   2. XGBoost       (ML-XGBoost/experiment_results.json)
#
# Usage:
#   Local files : python compare_models.py
#   Cloud remote: python compare_models.py --remote http://<YOUR_CLOUD_SERVER_IP>
#
# Produces:
#   - Side-by-side comparison table (console & LaTeX)
#   - McNemar's statistical significance test
#   - 6 publication-quality figures (comparison_*.png)
#   - comparison_summary.json
# ─────────────────────────────────────────────────────────────────────────────

RF_PATH  = os.path.join("ML", "experiment_results.json")
XGB_PATH = os.path.join("ML-XGBoost", "experiment_results.json")


def fetch_remote_results(remote_host):
    host = remote_host.rstrip("/")
    if not host.startswith("http"):
        host = "http://" + host

    print(f"Fetching RandomForest results from {host}:8000/experiment-results...")
    rf_url = f"{host}:8000/experiment-results"
    with urllib.request.urlopen(rf_url, timeout=10) as resp:
        rf_data = json.loads(resp.read().decode("utf-8"))
        os.makedirs("ML", exist_ok=True)
        with open(RF_PATH, "w") as f:
            json.dump(rf_data, f, indent=2)

    print(f"Fetching XGBoost results from {host}:8001/experiment-results...")
    xgb_url = f"{host}:8001/experiment-results"
    with urllib.request.urlopen(xgb_url, timeout=10) as resp:
        xgb_data = json.loads(resp.read().decode("utf-8"))
        os.makedirs("ML-XGBoost", exist_ok=True)
        with open(XGB_PATH, "w") as f:
            json.dump(xgb_data, f, indent=2)

    print("Remote results downloaded successfully! ✅\n")


def load_results():
    if not os.path.exists(RF_PATH):
        raise FileNotFoundError(f"Missing {RF_PATH}. Please run train.py in ML/ first.")
    if not os.path.exists(XGB_PATH):
        raise FileNotFoundError(f"Missing {XGB_PATH}. Please run train.py in ML-XGBoost/ first.")

    with open(RF_PATH, "r") as f:
        rf = json.load(f)
    with open(XGB_PATH, "r") as f:
        xgb = json.load(f)
    return rf, xgb


def mcnemar_test(y_true, y_pred1, y_pred2):
    """
    Computes McNemar's test for statistical significance between two classifiers.
    """
    y_true = np.array(y_true)
    y_pred1 = np.array(y_pred1)
    y_pred2 = np.array(y_pred2)

    correct1 = (y_pred1 == y_true)
    correct2 = (y_pred2 == y_true)

    # Contingency table
    # n01: 1 wrong, 2 right
    # n10: 1 right, 2 wrong
    n01 = np.sum((~correct1) & correct2)
    n10 = np.sum(correct1 & (~correct2))

    if (n01 + n10) == 0:
        chi2_stat = 0.0
        p_value = 1.0
    else:
        # Continuity-corrected McNemar's test
        chi2_stat = ((abs(n01 - n10) - 1) ** 2) / float(n01 + n10)
        p_value = float(chi2.sf(chi2_stat, df=1))

    return {
        "n01_rf_wrong_xgb_right": int(n01),
        "n10_rf_right_xgb_wrong": int(n10),
        "chi2_stat": round(float(chi2_stat), 4),
        "p_value": round(float(p_value), 5),
        "significant_at_005": p_value < 0.05
    }


def generate_figures(rf, xgb):
    classes = rf.get("classes", ["Addicted", "Frustrated", "Normal"])
    y_true  = np.array(rf["y_test"])

    # 1. Comparison Bar Chart (Accuracy, Bal Acc, F1 Macro, ROC-AUC, Kappa)
    metrics_names = ["Test Acc", "Bal Acc", "F1 Macro", "ROC-AUC", "Kappa"]
    rf_vals = [
        rf["metrics"]["testAcc"], rf["metrics"]["balancedAcc"],
        rf["metrics"]["f1Macro"], rf["metrics"]["rocAucMacro"], rf["metrics"]["cohenKappa"]
    ]
    xgb_vals = [
        xgb["metrics"]["testAcc"], xgb["metrics"]["balancedAcc"],
        xgb["metrics"]["f1Macro"], xgb["metrics"]["rocAucMacro"], xgb["metrics"]["cohenKappa"]
    ]

    x = np.arange(len(metrics_names))
    width = 0.35

    fig, ax = plt.subplots(figsize=(9, 5.5))
    rects1 = ax.bar(x - width/2, rf_vals, width, label="RandomForest", color="#3b82f6", alpha=0.85)
    rects2 = ax.bar(x + width/2, xgb_vals, width, label="XGBoost", color="#10b981", alpha=0.85)

    ax.set_ylabel("Score")
    ax.set_title("Performance Comparison: RandomForest vs XGBoost")
    ax.set_xticks(x)
    ax.set_xticklabels(metrics_names)
    ax.set_ylim(0.0, 1.05)
    ax.legend(loc="lower right")
    ax.grid(axis="y", linestyle="--", alpha=0.5)

    for r in rects1 + rects2:
        h = r.get_height()
        ax.annotate(f"{h:.3f}", xy=(r.get_x() + r.get_width()/2, h), xytext=(0, 3),
                    textcoords="offset points", ha="center", va="bottom", fontsize=9)

    plt.tight_layout()
    plt.savefig("comparison_bar_chart.png", dpi=200)
    plt.close()
    print("Saved figure → comparison_bar_chart.png")

    # 2. Side-by-Side Confusion Matrices
    cm_rf  = confusion_matrix(y_true, rf["y_pred"], labels=classes, normalize="true")
    cm_xgb = confusion_matrix(y_true, xgb["y_pred"], labels=classes, normalize="true")

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    disp_rf = ConfusionMatrixDisplay(confusion_matrix=cm_rf, display_labels=classes)
    disp_rf.plot(ax=axes[0], cmap="Blues", colorbar=False)
    axes[0].set_title(f"RandomForest (F1 Macro={rf['metrics']['f1Macro']:.3f})")

    disp_xgb = ConfusionMatrixDisplay(confusion_matrix=cm_xgb, display_labels=classes)
    disp_xgb.plot(ax=axes[1], cmap="Greens", colorbar=False)
    axes[1].set_title(f"XGBoost (F1 Macro={xgb['metrics']['f1Macro']:.3f})")

    plt.suptitle("Normalized Confusion Matrix Comparison", fontsize=14, y=1.02)
    plt.tight_layout()
    plt.savefig("comparison_confusion_matrices.png", dpi=200)
    plt.close()
    print("Saved figure → comparison_confusion_matrices.png")

    # 3. 10-Fold CV Box Plot
    rf_cv  = rf.get("cvFolds", [])
    xgb_cv = xgb.get("cvFolds", [])

    if rf_cv and xgb_cv:
        fig, ax = plt.subplots(figsize=(7, 5))
        box = ax.boxplot([rf_cv, xgb_cv], tick_labels=["RandomForest", "XGBoost"], patch_artist=True)
        colors = ["#93c5fd", "#6ee7b7"]
        for patch, c in zip(box["boxes"], colors):
            patch.set_facecolor(c)

        ax.set_ylabel("10-Fold CV F1 Macro Score")
        ax.set_title("Cross-Validation Score Distribution (10-Fold Stratified)")
        ax.grid(axis="y", linestyle="--", alpha=0.5)

        plt.tight_layout()
        plt.savefig("comparison_cv_boxplot.png", dpi=200)
        plt.close()
        print("Saved figure → comparison_cv_boxplot.png")

    # 4. Feature Importance Comparison
    rf_fi  = rf.get("featureImportances", {})
    xgb_fi = xgb.get("featureImportances", {})
    all_feats = list(rf_fi.keys())
    rf_fi_vals  = [rf_fi.get(f, 0.0) for f in all_feats]
    xgb_fi_vals = [xgb_fi.get(f, 0.0) for f in all_feats]

    y_idx = np.arange(len(all_feats))
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.barh(y_idx - 0.2, rf_fi_vals, 0.4, label="RandomForest", color="#3b82f6", alpha=0.85)
    ax.barh(y_idx + 0.2, xgb_fi_vals, 0.4, label="XGBoost", color="#10b981", alpha=0.85)
    ax.set_yticks(y_idx)
    ax.set_yticklabels(all_feats)
    ax.invert_yaxis()
    ax.set_xlabel("Relative Importance Score")
    ax.set_title("Feature Importance Comparison: RandomForest vs XGBoost")
    ax.legend()
    ax.grid(axis="x", linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig("comparison_feature_importance.png", dpi=200)
    plt.close()
    print("Saved figure → comparison_feature_importance.png")

    # 5. Per-Class F1 Score Comparison
    rf_f1_classes = f1_score(y_true, rf["y_pred"], labels=classes, average=None, zero_division=0)
    xgb_f1_classes = f1_score(y_true, xgb["y_pred"], labels=classes, average=None, zero_division=0)

    fig, ax = plt.subplots(figsize=(8, 5))
    x_c = np.arange(len(classes))
    ax.bar(x_c - width/2, rf_f1_classes, width, label="RandomForest", color="#3b82f6", alpha=0.85)
    ax.bar(x_c + width/2, xgb_f1_classes, width, label="XGBoost", color="#10b981", alpha=0.85)
    ax.set_ylabel("F1 Score")
    ax.set_title("Per-Class F1 Score Breakdown")
    ax.set_xticks(x_c)
    ax.set_xticklabels(classes)
    ax.set_ylim(0.0, 1.05)
    ax.legend()
    ax.grid(axis="y", linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig("comparison_per_class_f1.png", dpi=200)
    plt.close()
    print("Saved figure → comparison_per_class_f1.png")

    # 6. ROC Curves Overlay (One-vs-Rest)
    rf_proba  = np.array(rf["y_proba"])
    xgb_proba = np.array(xgb["y_proba"])
    fig, ax = plt.subplots(figsize=(8, 6))
    colors_rf  = ["#1e3a8a", "#2563eb", "#60a5fa"]
    colors_xgb = ["#064e3b", "#059669", "#34d399"]

    for idx, c_name in enumerate(classes):
        y_bin = (y_true == c_name).astype(int)
        fpr_rf, tpr_rf, _ = roc_curve(y_bin, rf_proba[:, idx])
        roc_auc_rf = auc(fpr_rf, tpr_rf)
        ax.plot(fpr_rf, tpr_rf, color=colors_rf[idx], linestyle="-",
                label=f"RF - {c_name} (AUC={roc_auc_rf:.3f})")

        fpr_xgb, tpr_xgb, _ = roc_curve(y_bin, xgb_proba[:, idx])
        roc_auc_xgb = auc(fpr_xgb, tpr_xgb)
        ax.plot(fpr_xgb, tpr_xgb, color=colors_xgb[idx], linestyle="--",
                label=f"XGB - {c_name} (AUC={roc_auc_xgb:.3f})")

    ax.plot([0, 1], [0, 1], "k:", alpha=0.4)
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("Multi-Class ROC Curves (One-vs-Rest): RandomForest vs XGBoost")
    ax.legend(loc="lower right", fontsize=8)
    ax.grid(linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig("comparison_roc_curves.png", dpi=200)
    plt.close()
    print("Saved figure → comparison_roc_curves.png")


def main():
    print("Loading experiment results from ML/ and ML-XGBoost/...")
    rf, xgb = load_results()

    y_true   = rf["y_test"]
    rf_pred  = rf["y_pred"]
    xgb_pred = xgb["y_pred"]

    assert y_true == xgb["y_test"], "Error: y_test labels do not match! Ensure both models were trained with identical seed/data."

    mcnemar = mcnemar_test(y_true, rf_pred, xgb_pred)

    print("\n" + "═"*90)
    print("                  COMPARATIVE RESEARCH ANALYSIS — GAMING BEHAVIOR PREDICTION")
    print("                  Dataset: 2400 samples | 3 classes | 10 features | seed=42")
    print("═"*90)
    print(f"{'Model':<16} | {'Test Acc':<9} | {'Bal Acc':<9} | {'F1 Macro':<9} | {'ROC-AUC':<9} | {'Kappa':<8} | {'10-Fold CV ± CI':<16}")
    print("─"*90)

    rf_m  = rf["metrics"]
    xgb_m = xgb["metrics"]
    rf_cv_str  = f"{rf_m['cvMean']:.3f} ± {rf_m['cvCi95']:.3f}"
    xgb_cv_str = f"{xgb_m['cvMean']:.3f} ± {xgb_m['cvCi95']:.3f}"

    print(f"{'RandomForest':<16} | {rf_m['testAcc']:<9.4f} | {rf_m['balancedAcc']:<9.4f} | {rf_m['f1Macro']:<9.4f} | {rf_m['rocAucMacro']:<9.4f} | {rf_m['cohenKappa']:<8.4f} | {rf_cv_str:<16}")
    print(f"{'XGBoost':<16} | {xgb_m['testAcc']:<9.4f} | {xgb_m['balancedAcc']:<9.4f} | {xgb_m['f1Macro']:<9.4f} | {xgb_m['rocAucMacro']:<9.4f} | {xgb_m['cohenKappa']:<8.4f} | {xgb_cv_str:<16}")
    print("═"*90)

    print(f"\nMcNemar's Statistical Test (RandomForest vs XGBoost):")
    print(f"  RF Wrong / XGB Right : {mcnemar['n01_rf_wrong_xgb_right']}")
    print(f"  RF Right / XGB Wrong : {mcnemar['n10_rf_right_xgb_wrong']}")
    print(f"  Chi-Square Stat      : {mcnemar['chi2_stat']}")
    print(f"  p-value              : {mcnemar['p_value']}")
    if mcnemar["significant_at_005"]:
        print("  Result               : 🏆 Statistically Significant at α = 0.05 (XGBoost outperforms RandomForest)")
    else:
        print("  Result               : Not statistically significant at α = 0.05")

    print("\n── LaTeX Research Table Snippet ──────────────────────────────────────────────────────")
    latex_table = f"""\\begin{{table}}[h]
\\centering
\\caption{{Performance comparison of RandomForest and XGBoost classifiers on the behavior prediction dataset.}}
\\begin{{tabular}}{{lcccccc}}
\\hline
\\textbf{{Classifier}} & \\textbf{{Accuracy}} & \\textbf{{Bal. Acc.}} & \\textbf{{F1 Macro}} & \\textbf{{ROC-AUC}} & \\textbf{{Kappa}} & \\textbf{{10-Fold CV $\\pm$ CI}} \\\\
\\hline
RandomForest & {rf_m['testAcc']:.4f} & {rf_m['balancedAcc']:.4f} & {rf_m['f1Macro']:.4f} & {rf_m['rocAucMacro']:.4f} & {rf_m['cohenKappa']:.4f} & {rf_cv_str} \\\\
XGBoost & \\textbf{{{xgb_m['testAcc']:.4f}}} & \\textbf{{{xgb_m['balancedAcc']:.4f}}} & \\textbf{{{xgb_m['f1Macro']:.4f}}} & \\textbf{{{xgb_m['rocAucMacro']:.4f}}} & \\textbf{{{xgb_m['cohenKappa']:.4f}}} & \\textbf{{{xgb_cv_str}}} \\\\
\\hline
\\end{{tabular}}
\\label{{tab:ml_comparison}}
\\end{{table}}"""
    print(latex_table)
    print("──────────────────────────────────────────────────────────────────────────────────────")

    print("\nGenerating 6 publication-quality research figures...")
    generate_figures(rf, xgb)

    summary = {
        "dataset": "2400 balanced samples (800 per class)",
        "models": {
            "RandomForest": rf_m,
            "XGBoost": xgb_m
        },
        "mcnemarTest": mcnemar,
        "latexTable": latex_table
    }

    with open("comparison_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("\nSaved summary → comparison_summary.json ✅")
    print("Research evaluation complete! ✅")


if __name__ == "__main__":
    if "--remote" in sys.argv:
        idx = sys.argv.index("--remote")
        if idx + 1 < len(sys.argv):
            fetch_remote_results(sys.argv[idx + 1])
        else:
            print("Error: --remote requires an IP or hostname (e.g. --remote http://<YOUR_CLOUD_SERVER_IP>)")
            sys.exit(1)
    main()

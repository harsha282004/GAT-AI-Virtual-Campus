"""Read-only evaluation of the EXISTING trained LSTM intent classifier.

Does not modify backend/app/intent_model/* (model, dataset, training code,
or the saved checkpoint) in any way — it only imports and reads them.

What this does:
  1. Loads the actual saved checkpoint at
     backend/app/intent_model/artifacts/intent_lstm.pt using the actual
     IntentLSTM architecture (backend/app/intent_model/model.py) and the
     actual saved vocabulary (backend/app/intent_model/artifacts/vocab.json).
  2. Reconstructs the exact held-out validation split used to train that
     checkpoint by re-running backend/app/intent_model/train.py's own split
     logic verbatim (same SEED=42, same random.shuffle, same 80/20 cut over
     the same backend/app/intent_model/dataset.py TRAINING_EXAMPLES list).
     This is deterministic — re-running the same seeded shuffle over the
     same list produces the same split every time, so no new split is
     invented here.
  3. Runs real forward-pass inference (model.eval(), torch.no_grad()) on
     every validation example, one query at a time, using the exact same
     encode -> tensor -> forward -> softmax -> argmax path as production
     inference (backend/app/intent_model/classify.py).
  4. Computes accuracy/precision/recall/F1 (macro, weighted, per-class) and
     a confusion matrix from those real predictions, and writes them to
     evaluation/.

Nothing here retrains the model, edits the checkpoint, or edits the
dataset. If any required artifact is missing, this script stops and
reports exactly what is missing rather than fabricating results.

Usage (from repo root):
    python evaluation/evaluate_intent_classifier.py
"""

from __future__ import annotations

import csv
import datetime
import json
import random
import sys
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
ARTIFACTS_DIR = BACKEND_DIR / "app" / "intent_model" / "artifacts"
OUT_DIR = REPO_ROOT / "evaluation"

# Must match backend/app/intent_model/train.py exactly — this is what makes
# the reconstructed split identical to the one the checkpoint was actually
# validated against during training, not an arbitrary new split.
SEED = 42


def _fail_missing(path: Path, what: str) -> None:
    print(f"STOP: required file missing — {what}")
    print(f"  expected at: {path}")
    print("Cannot proceed without this file. No results were generated.")
    sys.exit(1)


def reconstruct_validation_split(training_examples: list[tuple[str, str]]):
    """Re-derive the identical train/val split train.py produced, by running
    the identical seeded shuffle + 80/20 cut over the identical example list."""
    random.seed(SEED)
    examples = list(training_examples)
    random.shuffle(examples)
    split = int(len(examples) * 0.8)
    return examples[:split], examples[split:]


def main() -> None:
    if not BACKEND_DIR.exists():
        _fail_missing(BACKEND_DIR, "backend/ directory")

    sys.path.insert(0, str(BACKEND_DIR))
    try:
        from app.intent_model.dataset import INTENTS, TRAINING_EXAMPLES
        from app.intent_model.model import IntentLSTM
        from app.intent_model.vocab import Vocab
    except ImportError as exc:
        print(f"STOP: could not import the existing intent_model package: {exc}")
        sys.exit(1)

    vocab_path = ARTIFACTS_DIR / "vocab.json"
    intents_path = ARTIFACTS_DIR / "intents.json"
    weights_path = ARTIFACTS_DIR / "intent_lstm.pt"
    metadata_path = ARTIFACTS_DIR / "training_metadata.json"

    for path, label in (
        (vocab_path, "vocab.json (saved vocabulary)"),
        (intents_path, "intents.json (class label list)"),
        (weights_path, "intent_lstm.pt (trained checkpoint)"),
    ):
        if not path.exists():
            _fail_missing(path, label)

    vocab = Vocab.from_dict(json.loads(vocab_path.read_text(encoding="utf-8")))
    intents: list[str] = json.loads(intents_path.read_text(encoding="utf-8"))
    if intents != INTENTS:
        print("STOP: artifacts/intents.json does not match the class order in dataset.py INTENTS.")
        print("Evaluating against a mismatched label order would silently corrupt the confusion matrix.")
        sys.exit(1)

    reported_metadata = None
    if metadata_path.exists():
        reported_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

    # --- Load the ACTUAL saved checkpoint into the ACTUAL model architecture ---
    model = IntentLSTM(
        vocab_size=len(vocab.itos),
        num_classes=len(intents),
        pad_idx=vocab.pad_idx,
    )
    state_dict = torch.load(weights_path, map_location="cpu")
    model.load_state_dict(state_dict)
    model.eval()

    # --- Reconstruct the exact held-out validation split used at training time ---
    train_examples, val_examples = reconstruct_validation_split(TRAINING_EXAMPLES)

    # --- Real inference, one query at a time, identical path to classify.py ---
    predictions = []
    y_true: list[str] = []
    y_pred: list[str] = []
    with torch.no_grad():
        for text, true_intent in val_examples:
            token_ids = vocab.encode(text)
            if not token_ids:
                token_ids = [vocab.stoi["<unk>"]]
            input_tensor = torch.tensor([token_ids])
            lengths = torch.tensor([len(token_ids)])
            logits = model(input_tensor, lengths)
            probs = torch.softmax(logits, dim=1)[0]
            pred_idx = int(probs.argmax())
            pred_intent = intents[pred_idx]
            confidence = round(probs[pred_idx].item(), 4)
            predictions.append(
                {
                    "query": text,
                    "true_intent": true_intent,
                    "predicted_intent": pred_intent,
                    "confidence": confidence,
                }
            )
            y_true.append(true_intent)
            y_pred.append(pred_intent)

    accuracy = float(np.mean([t == p for t, p in zip(y_true, y_pred)]))

    macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=intents, average="macro", zero_division=0
    )
    weighted_p, weighted_r, weighted_f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=intents, average="weighted", zero_division=0
    )
    per_class_p, per_class_r, per_class_f1, per_class_support = precision_recall_fscore_support(
        y_true, y_pred, labels=intents, average=None, zero_division=0
    )

    cm_raw = confusion_matrix(y_true, y_pred, labels=intents)
    with np.errstate(divide="ignore", invalid="ignore"):
        row_sums = cm_raw.sum(axis=1, keepdims=True)
        cm_norm = np.divide(
            cm_raw.astype(float), row_sums, out=np.zeros_like(cm_raw, dtype=float), where=row_sums != 0
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # --- evaluation/intent_predictions.csv ---
    predictions_csv = OUT_DIR / "intent_predictions.csv"
    with open(predictions_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["query", "true_intent", "predicted_intent", "confidence"])
        writer.writeheader()
        for row in predictions:
            writer.writerow(row)

    # --- evaluation/intent_confusion_matrix.csv ---
    cm_csv = OUT_DIR / "intent_confusion_matrix.csv"
    with open(cm_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["true_intent \\ predicted_intent", *intents])
        for label, row in zip(intents, cm_raw):
            writer.writerow([label, *row.tolist()])

    # --- confusion matrix plots ---
    _plot_confusion_matrix(
        cm_raw,
        intents,
        title="Intent Classifier — Confusion Matrix (Raw Counts)",
        out_path=OUT_DIR / "intent_confusion_matrix_raw.png",
        fmt="d",
    )
    _plot_confusion_matrix(
        cm_norm,
        intents,
        title="Intent Classifier — Confusion Matrix (Row-Normalized)",
        out_path=OUT_DIR / "intent_confusion_matrix_normalized.png",
        fmt=".2f",
    )

    # --- most confused pairs (off-diagonal, raw counts, descending) ---
    confused_pairs = []
    for i, true_label in enumerate(intents):
        for j, pred_label in enumerate(intents):
            if i != j and cm_raw[i, j] > 0:
                confused_pairs.append((true_label, pred_label, int(cm_raw[i, j])))
    confused_pairs.sort(key=lambda x: x[2], reverse=True)

    now = datetime.datetime.now().isoformat(timespec="seconds")

    # --- evaluation/intent_classification_report.txt ---
    report_path = OUT_DIR / "intent_classification_report.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("INTENT CLASSIFIER — REAL EVALUATION REPORT\n")
        f.write("=" * 60 + "\n")
        f.write(f"Evaluation date/time: {now}\n")
        f.write(
            "Command used: python evaluation/evaluate_intent_classifier.py "
            "(run from repository root)\n\n"
        )

        f.write("DATASET\n")
        f.write("-" * 60 + "\n")
        f.write("Source file: backend/app/intent_model/dataset.py (TRAINING_EXAMPLES)\n")
        f.write(f"Total examples: {len(TRAINING_EXAMPLES)}\n")
        f.write(f"Number of classes: {len(intents)}\n")
        f.write(f"Classes: {', '.join(intents)}\n")
        f.write(
            f"Split: seeded 80/20 (SEED={SEED}, random.shuffle then index cut), "
            "reconstructed identically to backend/app/intent_model/train.py\n"
        )
        f.write(f"Train examples (reconstructed): {len(train_examples)}\n")
        f.write(f"Validation examples (reconstructed, evaluated below): {len(val_examples)}\n\n")

        f.write("MODEL / CHECKPOINT\n")
        f.write("-" * 60 + "\n")
        f.write("Architecture: backend/app/intent_model/model.py — IntentLSTM "
                 "(Embedding -> single-layer LSTM -> Dropout(0.2) -> Linear)\n")
        f.write(f"Checkpoint used: {weights_path.relative_to(REPO_ROOT)}\n")
        f.write(f"Vocabulary used: {vocab_path.relative_to(REPO_ROOT)} (vocab_size={len(vocab.itos)})\n")
        if reported_metadata:
            f.write(f"Checkpoint's own training_metadata.json (as saved by train.py): {json.dumps(reported_metadata)}\n")
        else:
            f.write("training_metadata.json: NOT VERIFIED IN EXISTING PROJECT (file not found)\n")
        f.write("\n")

        f.write("EVALUATION RESULTS (measured on the reconstructed validation split above)\n")
        f.write("-" * 60 + "\n")
        f.write(f"Samples evaluated: {len(val_examples)}\n")
        f.write(f"Accuracy: {accuracy:.4f}\n")
        f.write(f"Macro Precision: {macro_p:.4f}\n")
        f.write(f"Macro Recall: {macro_r:.4f}\n")
        f.write(f"Macro F1: {macro_f1:.4f}\n")
        f.write(f"Weighted Precision: {weighted_p:.4f}\n")
        f.write(f"Weighted Recall: {weighted_r:.4f}\n")
        f.write(f"Weighted F1: {weighted_f1:.4f}\n\n")

        f.write("PER-CLASS METRICS\n")
        f.write("-" * 60 + "\n")
        f.write(f"{'class':<22}{'precision':>10}{'recall':>10}{'f1':>10}{'support':>10}\n")
        for label, p, r, f1, sup in zip(intents, per_class_p, per_class_r, per_class_f1, per_class_support):
            f.write(f"{label:<22}{p:>10.4f}{r:>10.4f}{f1:>10.4f}{int(sup):>10d}\n")
        f.write("\n")

        f.write("CONFUSION MATRIX (raw counts, rows=true, cols=predicted)\n")
        f.write("-" * 60 + "\n")
        header = "true\\pred".ljust(22) + "".join(lbl[:10].rjust(11) for lbl in intents)
        f.write(header + "\n")
        for label, row in zip(intents, cm_raw):
            f.write(label.ljust(22) + "".join(str(v).rjust(11) for v in row) + "\n")
        f.write("\n")

        f.write("COMPARISON WITH PREVIOUSLY REPORTED VALIDATION ACCURACY\n")
        f.write("-" * 60 + "\n")
        if reported_metadata and "val_accuracy" in reported_metadata:
            reported_acc = reported_metadata["val_accuracy"]
            diff = abs(accuracy - reported_acc)
            f.write(f"training_metadata.json val_accuracy: {reported_acc:.4f}\n")
            f.write(f"This evaluation's measured accuracy: {accuracy:.4f}\n")
            f.write(f"Absolute difference: {diff:.4f}\n")
            if diff < 1e-6:
                f.write(
                    "MATCH: identical, as expected — same checkpoint, same seed (42), "
                    "same deterministic split reconstruction, same evaluation logic as "
                    "the best-val-accuracy epoch selection in train.py.\n"
                )
            else:
                f.write(
                    "MISMATCH — see 'CRITICAL INFORMATION STILL REQUIRED' notes in the "
                    "final report for possible causes (different checkpoint/split/seed).\n"
                )
        else:
            f.write("No training_metadata.json val_accuracy available to compare against.\n")

    print("Evaluation complete.")
    print(f"Accuracy: {accuracy:.4f}  Macro F1: {macro_f1:.4f}  Weighted F1: {weighted_f1:.4f}")
    print(f"Outputs written to: {OUT_DIR}")
    for f in sorted(OUT_DIR.iterdir()):
        print(f"  - {f.name}")


def _plot_confusion_matrix(matrix, labels, title, out_path, fmt):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    n = len(labels)
    fig, ax = plt.subplots(figsize=(max(8, n * 0.85), max(7, n * 0.75)), dpi=300)
    im = ax.imshow(matrix, cmap="Blues", vmin=0)

    ax.set_xticks(np.arange(n))
    ax.set_yticks(np.arange(n))
    ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=8)
    ax.set_yticklabels(labels, fontsize=8)
    ax.set_xlabel("Predicted Intent", fontsize=10)
    ax.set_ylabel("True Intent", fontsize=10)
    ax.set_title(title, fontsize=11)

    thresh = matrix.max() / 2.0 if matrix.max() > 0 else 0.5
    for i in range(n):
        for j in range(n):
            value = matrix[i, j]
            text = format(value, fmt)
            color = "white" if value > thresh else "black"
            ax.text(j, i, text, ha="center", va="center", color=color, fontsize=7)

    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(out_path, dpi=300)
    plt.close(fig)


if __name__ == "__main__":
    main()

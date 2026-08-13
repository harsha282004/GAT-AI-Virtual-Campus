"""Phase 10 — trains the intent LSTM on dataset.py's synthetic seed data
and saves the artifacts classify.py loads at inference time.

Held-out accuracy is measured on an 80/20 split and printed at the end —
reported honestly in Phase 10's review, not assumed. Small dataset (~120
examples across 12 classes) means this WILL overfit some; that is expected
and documented, not hidden.

Usage: python -m app.intent_model.train   (run from backend/)
"""

from __future__ import annotations

import json
import random
from pathlib import Path

import torch
from torch import nn
from torch.nn.utils.rnn import pad_sequence

from app.intent_model.dataset import INTENTS, TRAINING_EXAMPLES
from app.intent_model.model import IntentLSTM
from app.intent_model.vocab import Vocab

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
SEED = 42
EPOCHS = 150
LEARNING_RATE = 0.01
WEIGHT_DECAY = 1e-3


def _prepare(
    vocab: Vocab, examples: list[tuple[str, str]]
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    intent_to_idx = {intent: i for i, intent in enumerate(INTENTS)}
    encoded = [torch.tensor(vocab.encode(text) or [vocab.stoi["<unk>"]]) for text, _ in examples]
    lengths = torch.tensor([len(e) for e in encoded])
    labels = torch.tensor([intent_to_idx[intent] for _, intent in examples])
    padded = pad_sequence(encoded, batch_first=True, padding_value=vocab.pad_idx)
    return padded, lengths, labels


def train() -> None:
    random.seed(SEED)
    torch.manual_seed(SEED)

    examples = list(TRAINING_EXAMPLES)
    random.shuffle(examples)
    split = int(len(examples) * 0.8)
    train_examples, val_examples = examples[:split], examples[split:]

    vocab = Vocab.build([text for text, _ in TRAINING_EXAMPLES])
    model = IntentLSTM(vocab_size=len(vocab.itos), num_classes=len(INTENTS), pad_idx=vocab.pad_idx)

    train_x, train_lengths, train_y = _prepare(vocab, train_examples)
    val_x, val_lengths, val_y = (
        _prepare(vocab, val_examples) if val_examples else (None, None, None)
    )

    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    criterion = nn.CrossEntropyLoss()

    best_val_acc = -1.0
    best_state = None
    best_epoch = 0

    for epoch in range(1, EPOCHS + 1):
        model.train()
        optimizer.zero_grad()
        logits = model(train_x, train_lengths)
        loss = criterion(logits, train_y)
        loss.backward()
        optimizer.step()

        model.eval()
        with torch.no_grad():
            if val_x is not None:
                val_acc = (model(val_x, val_lengths).argmax(dim=1) == val_y).float().mean().item()
                if val_acc >= best_val_acc:
                    best_val_acc = val_acc
                    best_state = {k: v.clone() for k, v in model.state_dict().items()}
                    best_epoch = epoch

        if epoch % 25 == 0 or epoch == EPOCHS:
            print(f"epoch {epoch:3d}  loss={loss.item():.4f}  val_acc={val_acc:.3f}")

    # Use the checkpoint with the best held-out accuracy seen during
    # training, not whatever the model looks like after the last epoch —
    # early stopping against overfitting on this small dataset.
    if best_state is not None:
        model.load_state_dict(best_state)

    model.eval()
    with torch.no_grad():
        train_acc = (model(train_x, train_lengths).argmax(dim=1) == train_y).float().mean().item()
        val_acc = best_val_acc if val_x is not None else None

    print(f"\nBest epoch: {best_epoch}")
    print(f"Train accuracy (best checkpoint): {train_acc:.3f} ({len(train_examples)} examples)")
    if val_acc is not None:
        print(
            f"Held-out val accuracy (best checkpoint): {val_acc:.3f} ({len(val_examples)} examples)"
        )

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), ARTIFACTS_DIR / "intent_lstm.pt")
    (ARTIFACTS_DIR / "vocab.json").write_text(json.dumps(vocab.to_dict()), encoding="utf-8")
    (ARTIFACTS_DIR / "intents.json").write_text(json.dumps(INTENTS), encoding="utf-8")
    metadata = {
        "train_accuracy": train_acc,
        "val_accuracy": val_acc,
        "best_epoch": best_epoch,
        "num_train_examples": len(train_examples),
        "num_val_examples": len(val_examples),
        "vocab_size": len(vocab.itos),
        "num_classes": len(INTENTS),
        "epochs": EPOCHS,
        "note": "Trained on a small synthetic seed dataset (dataset.py) — "
        "see that module's honesty note. Held-out accuracy measured on a "
        "random 80/20 split, not cross-validated. Checkpoint saved is the "
        "best-val-accuracy epoch (early stopping), not the final epoch.",
    }
    (ARTIFACTS_DIR / "training_metadata.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
    print(f"\nSaved artifacts to {ARTIFACTS_DIR}")


if __name__ == "__main__":
    train()

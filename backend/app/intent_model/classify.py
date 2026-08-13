"""Phase 10 — intent classifier inference.

`classify_intent(text) -> {"intent": str, "confidence": float, "scores":
{...}}`. This function ONLY understands the query — it never answers it.
The caller (scripts/ai/supervisor.py) decides what to do with the intent;
this module has no knowledge of agents, RAG, or the spatial knowledge base.

If the trained artifacts (backend/app/intent_model/artifacts/) don't exist
yet — e.g. `python -m app.intent_model.train` hasn't been run — this
degrades to returning intent=None, confidence=0.0 rather than crashing the
whole chat pipeline. A caller MUST treat that as "no opinion", exactly like
a low-confidence prediction, never as a reason to fail the request.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import torch

from app.intent_model.model import IntentLSTM
from app.intent_model.vocab import Vocab

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"


class _IntentClassifier:
    def __init__(self) -> None:
        self.available = False
        vocab_path = ARTIFACTS_DIR / "vocab.json"
        intents_path = ARTIFACTS_DIR / "intents.json"
        weights_path = ARTIFACTS_DIR / "intent_lstm.pt"
        if not (vocab_path.exists() and intents_path.exists() and weights_path.exists()):
            return

        self.vocab = Vocab.from_dict(json.loads(vocab_path.read_text(encoding="utf-8")))
        self.intents: list[str] = json.loads(intents_path.read_text(encoding="utf-8"))
        self.model = IntentLSTM(
            vocab_size=len(self.vocab.itos),
            num_classes=len(self.intents),
            pad_idx=self.vocab.pad_idx,
        )
        self.model.load_state_dict(torch.load(weights_path, map_location="cpu"))
        self.model.eval()
        self.available = True

    def classify(self, text: str) -> dict[str, Any]:
        if not self.available:
            return {"intent": None, "confidence": 0.0, "scores": {}}

        token_ids = self.vocab.encode(text)
        if not token_ids:
            return {"intent": None, "confidence": 0.0, "scores": {}}

        input_tensor = torch.tensor([token_ids])
        lengths = torch.tensor([len(token_ids)])
        with torch.no_grad():
            logits = self.model(input_tensor, lengths)
            probs = torch.softmax(logits, dim=1)[0]

        scores = {intent: round(probs[i].item(), 4) for i, intent in enumerate(self.intents)}
        best_idx = int(probs.argmax())
        return {
            "intent": self.intents[best_idx],
            "confidence": round(probs[best_idx].item(), 4),
            "scores": scores,
        }


_singleton: _IntentClassifier | None = None


def classify_intent(text: str) -> dict[str, Any]:
    global _singleton
    if _singleton is None:
        _singleton = _IntentClassifier()
    return _singleton.classify(text)


if __name__ == "__main__":
    for demo_query in [
        "What all courses are available in college?",
        "Where can I find room 202?",
        "Which branches are offered?",
        "What is the capital of France?",
    ]:
        result = classify_intent(demo_query)
        print(f"{demo_query!r} -> {result['intent']} (confidence={result['confidence']})")

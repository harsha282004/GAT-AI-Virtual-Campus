"""Phase 10 — vocabulary + tokenization for the intent classifier.

Deliberately simple (lowercase alphanumeric word tokens, no subword/BPE) —
consistent with hybrid_retrieval.py's own `_tokenize()` choice for the same
reason: technical terms and room numbers ("cse", "202", "203a") should
survive intact rather than being split apart by a general-purpose
tokenizer trained on unrelated text.
"""

from __future__ import annotations

import re

from app.intent_model.model import PAD_TOKEN, UNK_TOKEN


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


class Vocab:
    def __init__(self, tokens: list[str]) -> None:
        unique = sorted(set(tokens))
        self.itos: list[str] = [PAD_TOKEN, UNK_TOKEN] + unique
        self.stoi: dict[str, int] = {tok: i for i, tok in enumerate(self.itos)}

    @property
    def pad_idx(self) -> int:
        return self.stoi[PAD_TOKEN]

    def encode(self, text: str) -> list[int]:
        unk = self.stoi[UNK_TOKEN]
        return [self.stoi.get(tok, unk) for tok in tokenize(text)]

    def to_dict(self) -> dict:
        return {"itos": self.itos}

    @classmethod
    def from_dict(cls, data: dict) -> Vocab:
        vocab = cls.__new__(cls)
        vocab.itos = data["itos"]
        vocab.stoi = {tok: i for i, tok in enumerate(vocab.itos)}
        return vocab

    @classmethod
    def build(cls, texts: list[str]) -> Vocab:
        all_tokens = [tok for text in texts for tok in tokenize(text)]
        return cls(all_tokens)

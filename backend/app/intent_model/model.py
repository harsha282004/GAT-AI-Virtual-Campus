"""Phase 10 — RNN (LSTM) intent classifier architecture.

Input text -> tokenize -> embed -> LSTM -> dense+softmax -> intent +
confidence. Deliberately small (this is a bootstrap classifier over a few
hundred synthetic examples, not a production NLU system) — see dataset.py's
honesty note. This module's ONLY job is understanding the query; it never
generates an answer (see classify.py's docstring for how its output is
used downstream).
"""

from __future__ import annotations

import torch
from torch import nn

PAD_TOKEN = "<pad>"
UNK_TOKEN = "<unk>"


class IntentLSTM(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        num_classes: int,
        embed_dim: int = 32,
        hidden_dim: int = 32,
        pad_idx: int = 0,
    ) -> None:
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=pad_idx)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True)
        self.dropout = nn.Dropout(0.2)
        self.classifier = nn.Linear(hidden_dim, num_classes)

    def forward(self, token_ids: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        """token_ids: (batch, seq_len) padded int64. lengths: (batch,) real
        (unpadded) sequence lengths. Returns raw logits (batch, num_classes)
        — softmax/argmax happens in classify.py, not here."""
        embedded = self.embedding(token_ids)
        packed = nn.utils.rnn.pack_padded_sequence(
            embedded, lengths.cpu(), batch_first=True, enforce_sorted=False
        )
        _, (hidden, _) = self.lstm(packed)
        last_hidden = hidden[-1]  # (batch, hidden_dim) — final LSTM hidden state
        return self.classifier(self.dropout(last_hidden))

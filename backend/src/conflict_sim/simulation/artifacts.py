"""Read/write the offline estimation artifacts consumed by the online simulator."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

OUTCOME_NAMES = ("gdp", "fdi")


def bootstrap_path(artifacts_dir: Path, outcome: str) -> Path:
    return artifacts_dir / f"lp_bootstrap_{outcome}.npz"


def estimates_path(artifacts_dir: Path, outcome: str) -> Path:
    return artifacts_dir / f"lp_estimates_{outcome}.json"


def meta_path(artifacts_dir: Path) -> Path:
    return artifacts_dir / "meta.json"


@dataclass(frozen=True)
class Artifacts:
    horizons: np.ndarray  # e.g. [-3..10]
    draws: dict[str, dict[str, np.ndarray]]  # outcome -> measure -> (B, H), NaN rows removed
    estimates: dict[str, dict[str, list[dict[str, Any]]]]  # outcome -> measure -> rows
    meta: dict[str, Any]

    def response_draws(self, outcome: str, key: str, max_h: int) -> np.ndarray:
        """Bootstrap draws for h = 0..max_h (post-shock horizons only)."""
        cols = (self.horizons >= 0) & (self.horizons <= max_h)
        return self.draws[outcome][key][:, cols]

    def response_terms(self, outcome: str, measure: str, max_h: int) -> dict[str, np.ndarray]:
        """{'shock': beta, 'shock_age': gamma, 'spill': delta} (those estimated), row-aligned."""
        out = {}
        for key in self.draws[outcome]:
            if key == measure:
                out["shock"] = self.response_draws(outcome, key, max_h)
            elif key.startswith(f"{measure}_"):
                out[key.removeprefix(f"{measure}_")] = self.response_draws(outcome, key, max_h)
        return out

    @classmethod
    def load(cls, artifacts_dir: Path) -> Artifacts:
        draws: dict[str, dict[str, np.ndarray]] = {}
        estimates: dict[str, dict[str, list[dict[str, Any]]]] = {}
        horizons = np.array([])
        for outcome in OUTCOME_NAMES:
            with np.load(bootstrap_path(artifacts_dir, outcome)) as npz:
                horizons = npz["horizons"]
                raw = {k: npz[k] for k in npz.files if k != "horizons"}
            draws[outcome] = {}
            for m in ("continuous", "onset"):
                keys = [k for k in raw if k == m or k.startswith(f"{m}_")]
                ok = np.all([~np.isnan(raw[k]).any(axis=1) for k in keys], axis=0)
                for k in keys:  # drop degenerate draws jointly so terms stay row-aligned
                    draws[outcome][k] = raw[k][ok]
            estimates[outcome] = json.loads(estimates_path(artifacts_dir, outcome).read_text())
        meta = json.loads(meta_path(artifacts_dir).read_text())
        return cls(horizons=horizons, draws=draws, estimates=estimates, meta=meta)

    @staticmethod
    def exists(artifacts_dir: Path) -> bool:
        return meta_path(artifacts_dir).exists() and all(
            bootstrap_path(artifacts_dir, o).exists() for o in OUTCOME_NAMES
        )

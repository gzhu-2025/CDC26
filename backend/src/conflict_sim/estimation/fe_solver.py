"""Fast two-way fixed-effects OLS point estimates (used for bootstrap draws only).

FWL: demean y, X and year dummies within entity, then OLS on [X, D_year]. Exact for
unbalanced panels; tests check agreement with linearmodels.PanelOLS.
"""

from __future__ import annotations

import numpy as np


def _entity_demean(a: np.ndarray, entity: np.ndarray, n_entities: int) -> np.ndarray:
    counts = np.bincount(entity, minlength=n_entities).astype(float)
    counts[counts == 0] = 1.0
    out = np.empty_like(a)
    for j in range(a.shape[1]):
        means = np.bincount(entity, weights=a[:, j], minlength=n_entities) / counts
        out[:, j] = a[:, j] - means[entity]
    return out


def twoway_fe_ols(y: np.ndarray, X: np.ndarray, entity: np.ndarray, time: np.ndarray) -> np.ndarray:
    """Coefficients on X (entity/time are integer codes from 0). NaN if the shock is degenerate."""
    n_e = int(entity.max()) + 1
    n_t = int(time.max()) + 1
    dummies = np.zeros((len(y), n_t))
    dummies[np.arange(len(y)), time] = 1.0
    stacked = _entity_demean(np.column_stack([y, X, dummies]), entity, n_e)
    yd, Xd = stacked[:, 0], stacked[:, 1:]
    k = X.shape[1]
    if np.var(Xd[:, 0]) < 1e-12:
        return np.full(k, np.nan)
    coef, *_ = np.linalg.lstsq(Xd, yd, rcond=None)
    return coef[:k]

import unittest
import numpy as np
import pandas as pd
from social_health_analysis import aligned, partial_fit, circular_p


class StatisticalChecks(unittest.TestCase):
    def test_alignment_does_not_close_a_calendar_gap(self):
        dates = pd.date_range("1990", periods=9, freq="YS")
        d = pd.DataFrame({"outcome": np.arange(9, dtype=float), "conflict": np.arange(9, dtype=float)}, index=dates)
        d.loc["1993", "outcome"] = np.nan
        pair = aligned(d, "outcome", 2)
        self.assertEqual(pair.index.year.tolist(), [1994, 1995, 1996, 1997, 1998])
        self.assertEqual(pair.x.iloc[0], d.conflict.loc["1992-01-01"])

    def test_partial_fit_removes_linear_time_component(self):
        rng = np.random.default_rng(42)
        n = 40
        time = np.arange(n)
        frame = pd.DataFrame({"x": 3*time+rng.normal(size=n), "y": -6*time+rng.normal(size=n)},
                             index=pd.date_range("1980", periods=n, freq="YS"))
        fit, residual, _, _ = partial_fit(frame)
        self.assertAlmostEqual(np.dot(residual.x, time-time.mean()), 0, places=8)
        self.assertAlmostEqual(np.dot(residual.y, time-time.mean()), 0, places=8)
        self.assertEqual(fit.df_resid, n-3)

    def test_circular_test_includes_observed_alignment(self):
        rng = np.random.default_rng(3)
        x = rng.normal(size=30)
        self.assertAlmostEqual(circular_p(pd.DataFrame({"x": x, "y": x})), 1/30)


if __name__ == "__main__":
    unittest.main()

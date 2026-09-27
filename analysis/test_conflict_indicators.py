"""Checks for calendar gaps, lag direction, and held-out target leakage."""
import unittest

import numpy as np
import pandas as pd

from conflict_indicators import backtest, changes, longest_run


class AnalysisTests(unittest.TestCase):
    def test_missing_year_does_not_become_a_one_year_change(self):
        index = pd.date_range("2000", periods=5, freq="YS")
        frame = pd.DataFrame({"GDP": [100, 110, np.nan, 150, 165]}, index=index)
        result = changes(frame)
        self.assertTrue(result.GDP.iloc[2:4].isna().all())
        self.assertAlmostEqual(result.GDP.iloc[4], 100*np.log(1.1))

    def test_longest_run_keeps_calendar_continuity(self):
        index = pd.date_range("2000", periods=7, freq="YS")
        frame = pd.DataFrame({"y": [1, 2, np.nan, 4, 5, 6, 7], "x": 1}, index=index)
        result = longest_run(frame)
        self.assertEqual(result.index.year.tolist(), [2003, 2004, 2005, 2006])

    def test_positive_lag_means_conflict_precedes_indicator(self):
        index = pd.date_range("2000", periods=5, freq="YS")
        x = pd.Series([1, 4, 8, 3, 2], index=index)
        pair = pd.DataFrame({"y": x.shift(1), "x": x.shift(1)}).dropna()
        self.assertEqual(pair.loc["2002-01-01", "x"], x.loc["2001-01-01"])

    def test_holdout_target_cannot_change_its_prediction(self):
        rng = np.random.default_rng(24)
        frame = pd.DataFrame(rng.normal(size=(13, 2)), columns=["y", "x"],
                             index=pd.date_range("2000", periods=13, freq="YS"))
        first = backtest(frame, {})[0]
        frame.iloc[-1, 0] = 1e6
        second = backtest(frame, {})[0]
        for name in ["arima_prediction", "arimax_prediction"]:
            self.assertAlmostEqual(first[name], second[name])


if __name__ == "__main__":
    unittest.main()

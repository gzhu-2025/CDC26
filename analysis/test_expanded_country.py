import unittest
import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.sandwich_covariance import cov_cluster_2groups
from expanded_country_analysis import absorb, panel_fit


class CountryModelTests(unittest.TestCase):
    def sample(self):
        rng=np.random.default_rng(51)
        index=pd.MultiIndex.from_product([range(40),range(2000,2018)],names=['iso3','year'])
        c=index.get_level_values('iso3').to_numpy()
        yr=index.get_level_values('year').to_numpy()-2000
        x=rng.normal(size=len(index))
        y=.4*x+rng.normal(size=40)[c]+rng.normal(size=18)[yr]+rng.normal(size=len(index))
        frame=pd.DataFrame({'y':y,'x':x},index=index)
        return frame[rng.uniform(size=len(frame))>.2]

    def test_absorption_removes_group_means_in_unbalanced_panel(self):
        frame=self.sample()
        c,_=pd.factorize(frame.index.get_level_values('iso3'))
        y,_=pd.factorize(frame.index.get_level_values('year'))
        result=pd.DataFrame(absorb(frame,c,y),index=frame.index)
        self.assertLess(np.max(abs(result.groupby(level='iso3').mean().to_numpy())),1e-8)
        self.assertLess(np.max(abs(result.groupby(level='year').mean().to_numpy())),1e-8)

    def test_coefficient_and_cluster_covariance_match_dummy_regression(self):
        frame=self.sample()
        result,_=panel_fit(frame)
        self.assertEqual(result['status'],'ok')
        z=(frame-frame.mean())/frame.std(ddof=0)
        flat=frame.reset_index()
        c,_=pd.factorize(flat.iso3)
        yr,_=pd.factorize(flat.year)
        design=np.column_stack([np.ones(len(frame)),z.x,
                 pd.get_dummies(flat.iso3,drop_first=True,dtype=float),
                 pd.get_dummies(flat.year,drop_first=True,dtype=float)])
        fit=sm.OLS(z.y.to_numpy(),design).fit()
        covariance,_,_=cov_cluster_2groups(fit,c,yr,use_correction=True)
        self.assertAlmostEqual(result['beta'],fit.params[1],places=8)
        self.assertAlmostEqual(result['se'],np.sqrt(covariance[1,1]),places=8)


if __name__=='__main__':
    unittest.main()

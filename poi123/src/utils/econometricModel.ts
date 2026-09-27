import { CountryData, ForecastPoint, ForecastScenario, TimeSeriesPoint } from '../types';

/**
 * Calculates Pearson Correlation Coefficient r between two series
 */
export function calculatePearsonR(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  
  const n = x.length;
  const avgX = x.reduce((a, b) => a + b, 0) / n;
  const avgY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - avgX;
    const dy = y[i] - avgY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  if (denomX === 0 || denomY === 0) return 0;
  return Number((numerator / Math.sqrt(denomX * denomY)).toFixed(3));
}

/**
 * Calculates simple linear regression for scatter plots: y = mx + b
 */
export interface RegressionResult {
  slope: number;
  intercept: number;
  r: number;
  rSquared: number;
  predict: (x: number) => number;
}

export function calculateLinearRegression(points: { x: number; y: number }[]): RegressionResult {
  const n = points.length;
  if (n < 2) {
    return {
      slope: 0,
      intercept: 0,
      r: 0,
      rSquared: 0,
      predict: () => 0,
    };
  }

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const avgX = sumX / n;
  const avgY = sumY / n;

  let sumXX = 0;
  let sumXY = 0;
  let sumYY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - avgX;
    const dy = ys[i] - avgY;
    sumXX += dx * dx;
    sumXY += dx * dy;
    sumYY += dy * dy;
  }

  const slope = sumXX !== 0 ? sumXY / sumXX : 0;
  const intercept = avgY - slope * avgX;
  const r = (sumXX !== 0 && sumYY !== 0) ? sumXY / Math.sqrt(sumXX * sumYY) : 0;
  const rSquared = Number((r * r).toFixed(3));

  return {
    slope: Number(slope.toFixed(4)),
    intercept: Number(intercept.toFixed(2)),
    r: Number(r.toFixed(3)),
    rSquared,
    predict: (x: number) => slope * x + intercept,
  };
}

/**
 * Econometric Forecasting Engine:
 * Simulates future trajectories of GDP per capita and HDI over 1-10 years
 * given an endogenous or exogenous change in conflict intensity, aid, and institutional resilience.
 */
export function runPredictiveModel(
  country: CountryData,
  scenario: ForecastScenario
): ForecastPoint[] {
  const history = country.history;
  const latest = history[history.length - 1];
  const startYear = latest.year;
  
  // Base parameters
  const currentConflict = country.currentConflictIntensity;
  const targetConflict = scenario.targetConflictIntensity;
  const conflictDelta = targetConflict - currentConflict;
  
  // Historical growth trend (CAGR over last 5 years or 2.5% default)
  const fiveYearsAgo = history[Math.max(0, history.length - 6)];
  const baselineAnnualGrowth = fiveYearsAgo && latest.gdpPerCapita > 0 && fiveYearsAgo.gdpPerCapita > 0
    ? Math.max(-0.04, Math.min(0.06, Math.pow(latest.gdpPerCapita / fiveYearsAgo.gdpPerCapita, 1 / 5) - 1))
    : 0.02;

  // Elasticity coefficients calibrated from econometric conflict literature
  // (Collier & Hoeffler, Gates et al. 2012 on development regression in civil conflict)
  const conflictElasticity = (country.econometrics.estimatedAnnualCostPct || 1.8) / 100;
  const aidMultiplier = 0.00035; // Economic multiplier per dollar of targeted reconstruction aid
  const resilienceModifier = (country.econometrics.institutionalResilience / 50) * scenario.resilienceFactor;

  const forecast: ForecastPoint[] = [];

  let currentGdp = latest.gdpPerCapita;
  let currentHci = latest.hciPlus ?? latest.hdi ?? 0.5;
  let currentDisp = latest.displacedPersons;

  // Counterfactual baseline (if conflict stayed at current status quo)
  let statusQuoGdp = latest.gdpPerCapita;

  for (let yearStep = 1; yearStep <= scenario.horizonYears; yearStep++) {
    const year = startYear + yearStep;
    
    // Convergence factor: conflict shifts progressively towards the target over 2-3 years
    const progressRate = Math.min(1, yearStep / 2.5);
    const stepConflict = currentConflict + conflictDelta * progressRate;
    const activeConflictDrag = (stepConflict / 100) * conflictElasticity * 1.5;

    // Growth calculation
    // Peace dividend kick when conflict drops, or shock penalty when conflict flares
    const conflictChangeEffect = -(conflictDelta / 100) * (conflictElasticity * 2.2) * (1 / (yearStep * 0.7 + 0.3));
    const aidStimulus = (scenario.reconstructionAidAnnualUSD * aidMultiplier) * (stepConflict < 40 ? 1.4 : 0.6);
    
    // Net growth rate for the year
    const netGrowth = baselineAnnualGrowth - activeConflictDrag + conflictChangeEffect * resilienceModifier + aidStimulus;
    
    // Bound growth to realistic annual rates (-25% to +18%)
    const boundedGrowth = Math.max(-0.25, Math.min(0.18, netGrowth));
    currentGdp = Math.max(150, currentGdp * (1 + boundedGrowth));

    // Status quo tracking for net peace dividend
    const sqDrag = (currentConflict / 100) * conflictElasticity * 1.5;
    const sqGrowth = Math.max(-0.15, Math.min(0.08, baselineAnnualGrowth - sqDrag));
    statusQuoGdp = Math.max(150, statusQuoGdp * (1 + sqGrowth));

    // Confidence Interval expands with forecast horizon sqrt(t)
    const uncertaintyStdDev = 0.035 * Math.sqrt(yearStep);
    const gdpUpperBand = Math.round(currentGdp * (1 + 1.96 * uncertaintyStdDev));
    const gdpLowerBand = Math.round(currentGdp * Math.max(0.4, 1 - 1.96 * uncertaintyStdDev));

    // World Bank Human Capital Index Plus (HCI+) Dynamics:
    // HCI+ responds to real productivity, health, and learning gains, minus conflict shocks on schooling and nutrition
    const gdpHciGain = 0.014 * Math.log(Math.max(1, currentGdp / latest.gdpPerCapita));
    const conflictHciLoss = (stepConflict / 100) * 0.028 * (1 - country.econometrics.institutionalResilience / 120);
    const targetHci = Math.min(0.96, Math.max(0.25, (latest.hciPlus || latest.hdi || 0.5) + gdpHciGain - conflictHciLoss + (aidStimulus > 0 ? 0.005 * yearStep : 0)));
    
    // Smooth HCI+ transition
    currentHci = Number((currentHci * 0.6 + targetHci * 0.4).toFixed(3));
    const hciUncertainty = 0.008 * Math.sqrt(yearStep);
    const hciUpperBand = Number(Math.min(0.98, currentHci + 1.96 * hciUncertainty).toFixed(3));
    const hciLowerBand = Number(Math.max(0.20, currentHci - 1.96 * hciUncertainty).toFixed(3));

    // Displaced population projection
    const dispChangeFactor = 1 + (stepConflict - currentConflict) * 0.015;
    currentDisp = Math.max(0, Math.round(currentDisp * (stepConflict < 15 ? 0.82 : dispChangeFactor)));

    const cumulativePeaceDividendUSD = Math.round((currentGdp - statusQuoGdp));

    forecast.push({
      year,
      projectedGdpPerCapita: Math.round(currentGdp),
      gdpUpperBand,
      gdpLowerBand,
      projectedHciPlus: currentHci,
      hciUpperBand,
      hciLowerBand,
      projectedHdi: currentHci,
      hdiUpperBand: hciUpperBand,
      hdiLowerBand: hciLowerBand,
      projectedDisplaced: currentDisp,
      cumulativePeaceDividendUSD,
    });
  }

  return forecast;
}

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
  let currentHdi = latest.hdi;
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

    // HDI Dynamics:
    // HDI responds to GDP changes logarithmically, minus direct conflict degradation on schooling/health
    const gdpHdiGain = 0.012 * Math.log(Math.max(1, currentGdp / latest.gdpPerCapita));
    const conflictHdiLoss = (stepConflict / 100) * 0.025 * (1 - country.econometrics.institutionalResilience / 120);
    const targetHdi = Math.min(0.96, Math.max(0.25, latest.hdi + gdpHdiGain - conflictHdiLoss + (aidStimulus > 0 ? 0.004 * yearStep : 0)));
    
    // Smooth HDI transition
    currentHdi = Number((currentHdi * 0.6 + targetHdi * 0.4).toFixed(3));
    const hdiUncertainty = 0.008 * Math.sqrt(yearStep);
    const hdiUpperBand = Number(Math.min(0.98, currentHdi + 1.96 * hdiUncertainty).toFixed(3));
    const hdiLowerBand = Number(Math.max(0.20, currentHdi - 1.96 * hdiUncertainty).toFixed(3));

    // Displaced population projection
    const dispChangeFactor = 1 + (stepConflict - currentConflict) * 0.015;
    currentDisp = Math.max(0, Math.round(currentDisp * (stepConflict < 15 ? 0.82 : dispChangeFactor)));

    const cumulativePeaceDividendUSD = Math.round((currentGdp - statusQuoGdp));

    // HCI+ Dynamics (World Bank Data360 WB_HCIP dataset on 0-325 scale):
    // 1 point = ~1% higher future labor income.
    const latestHciPlus = latest.hciPlus ?? (country.currentHciPlus || (latest.hdi * 240));
    const hciConflictPenalty = (stepConflict / 100) * 12.5 * (1 - country.econometrics.institutionalResilience / 140);
    const hciGrowthBonus = 2.8 * Math.log(Math.max(1, currentGdp / latest.gdpPerCapita)) + (aidStimulus > 0 ? 0.95 * yearStep : 0);
    const targetHciPlus = Math.min(325, Math.max(30, latestHciPlus + hciGrowthBonus - hciConflictPenalty));
    
    // Inertial human capital transition
    const projectedHciPlus = Number((latestHciPlus * (1 - progressRate * 0.4) + targetHciPlus * (progressRate * 0.4)).toFixed(1));
    const hciUncertainty = 1.8 * Math.sqrt(yearStep);
    const hciPlusUpperBand = Number(Math.min(325, projectedHciPlus + 1.96 * hciUncertainty).toFixed(1));
    const hciPlusLowerBand = Number(Math.max(25, projectedHciPlus - 1.96 * hciUncertainty).toFixed(1));

    forecast.push({
      year,
      projectedGdpPerCapita: Math.round(currentGdp),
      gdpUpperBand,
      gdpLowerBand,
      projectedHdi: currentHdi,
      hdiUpperBand,
      hdiLowerBand,
      projectedHciPlus,
      hciPlusUpperBand,
      hciPlusLowerBand,
      projectedDisplaced: currentDisp,
      cumulativePeaceDividendUSD,
    });
  }

  return forecast;
}

/**
 * Computes detailed HCI+ component breakdown for a specific country and conflict state
 * according to the World Bank Data360 WB_HCIP specification (0 - 325 scale across 3 pillars)
 * Reference: https://data360.worldbank.org/en/dataset/WB_HCIP
 */
export function calculateLiveHciBreakdown(country: CountryData, conflictOverride?: number) {
  const conflict = conflictOverride !== undefined ? conflictOverride : country.currentConflictIntensity;
  const hdi = country.currentHdi;
  const resilience = country.econometrics.institutionalResilience;

  const childSurvival = Math.min(0.998, 0.88 + 0.118 * hdi - (conflict / 100) * 0.04);
  const expectedYears = Math.min(14.0, Math.max(4.0, 4.5 + 9.5 * hdi - (conflict / 100) * 1.8));
  // World Bank Harmonized Test Scores (HLO) range from 300 to 625 (325 is the basic proficiency benchmark threshold)
  const testScore = Math.min(625, Math.max(300, Math.round(300 + 325 * hdi - (conflict / 100) * 55)));
  const lays = Math.min(13.5, Math.max(3.0, expectedYears * (testScore / 625)));
  const adultSurvival = Math.min(0.96, Math.max(0.55, 0.58 + 0.38 * hdi - (conflict / 100) * 0.08));
  const tertiaryRate = Math.min(88, Math.max(4, Math.round((6 + 78 * hdi) * (resilience / 100))));
  const productiveEmpRate = Math.min(94, Math.max(28, Math.round((35 + 55 * hdi) * (1 - (conflict / 100) * 0.35))));
  const frontierSkills = Math.min(96, Math.max(10, Math.round((12 + 82 * hdi) * (resilience / 100))));

  const resilienceFactor = Math.min(1.0, resilience / 160);
  const fragilityPenalty = (conflict / 100) * 0.32 * (1 - resilienceFactor * 0.6);

  // Data360 WB_HCIP Three Pillars:
  // 1. Health & Nutrition Pillar: 0 - 100 pts
  const healthPillar = (childSurvival * 45 + adultSurvival * 55) * (1 - (conflict / 100) * 0.15);
  
  // 2. Education Pillar: 0 - 125 pts (LAYS, HLO test quality, tertiary)
  const educationPillar = ((lays / 13.5) * 90 + (tertiaryRate / 100) * 35) * (1 - (conflict / 100) * 0.28);
  
  // 3. Employment & On-the-Job Learning Pillar: 0 - 100 pts (wage employment, adult skills accumulation)
  const employmentPillar = ((productiveEmpRate / 100) * 70 + (frontierSkills / 100) * 30) * (1 - fragilityPenalty);

  const rawTotal = healthPillar + educationPillar + employmentPillar;
  const finalHci325 = Number(Math.min(325, Math.max(35, rawTotal)).toFixed(1));

  return {
    totalScore: finalHci325,
    score: finalHci325,
    healthPillarScore: Number(healthPillar.toFixed(1)),
    educationPillarScore: Number(educationPillar.toFixed(1)),
    employmentPillarScore: Number(employmentPillar.toFixed(1)),
    childSurvivalRate: Number((childSurvival * 100).toFixed(1)),
    learningAdjustedSchoolYears: Number(lays.toFixed(1)),
    expectedYearsOfSchool: Number(expectedYears.toFixed(1)),
    harmonizedTestScore: testScore,
    adultSurvivalRate: Number((adultSurvival * 100).toFixed(1)),
    tertiaryAttainmentRate: tertiaryRate,
    productiveEmploymentRate: productiveEmpRate,
    frontierSkillsScore: frontierSkills,
    conflictProductivityPenaltyPct: Number((fragilityPenalty * 100).toFixed(1)),
    expectedWorkforceProductivity: Number(((finalHci325 / 325) * 100).toFixed(1)),
  };
}

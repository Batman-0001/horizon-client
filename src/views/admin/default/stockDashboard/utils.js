export const numberFmt = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const DASHBOARD_PREFS_KEY = 'jarnox-stock-dashboard:prefs';

function canUseSessionStorage() {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage);
}

export function readDashboardPrefs() {
  if (!canUseSessionStorage()) {
    return { symbol: '', compareSymbol: '', days: '30', forecastHorizon: '30' };
  }

  try {
    const raw = window.sessionStorage.getItem(DASHBOARD_PREFS_KEY);
    if (!raw) {
      return {
        symbol: '',
        compareSymbol: '',
        days: '30',
        forecastHorizon: '30',
      };
    }
    const parsed = JSON.parse(raw);
    return {
      symbol: String(parsed?.symbol || ''),
      compareSymbol: String(parsed?.compareSymbol || ''),
      days: String(parsed?.days || '30'),
      forecastHorizon: String(parsed?.forecastHorizon || '30'),
    };
  } catch {
    return { symbol: '', compareSymbol: '', days: '30', forecastHorizon: '30' };
  }
}

export function saveDashboardPrefs(prefs) {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage write failures.
  }
}

export function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeCompanies(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.companies)
      ? payload.companies
      : [];
  return rows
    .map((item) => {
      if (typeof item === 'string') return { symbol: item, name: item };
      const symbol = item.symbol || item.ticker || item.code;
      const name = item.name || symbol;
      return symbol ? { symbol, name } : null;
    })
    .filter(Boolean);
}

export function normalizePriceRows(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

  return rows
    .map((row) => {
      const date = row.date || row.Date;
      const close = safeNumber(row.close ?? row.Close);
      const open = safeNumber(row.open ?? row.Open);
      if (!date || close === null) return null;
      return { date, close, open };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function normalizeTopMovers(payload) {
  const gainers = Array.isArray(payload?.top_gainers)
    ? payload.top_gainers
    : [];
  const losers = Array.isArray(payload?.top_losers) ? payload.top_losers : [];
  return [...gainers, ...losers].slice(0, 5);
}

export function movingAverage(values, windowSize) {
  return values.map((_, idx) => {
    if (idx + 1 < windowSize) return null;
    const slice = values.slice(idx + 1 - windowSize, idx + 1);
    return slice.reduce((sum, value) => sum + value, 0) / windowSize;
  });
}

function stdDev(values) {
  if (!values.length) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeClientMetrics(priceRows) {
  if (priceRows.length < 8) {
    return {
      volatility7d: null,
      momentum7d: null,
      drawdown: null,
      score: null,
    };
  }

  const closes = priceRows.map((row) => row.close);
  const returns = closes
    .map((close, idx) => {
      if (idx === 0 || closes[idx - 1] === 0) return null;
      return (close - closes[idx - 1]) / closes[idx - 1];
    })
    .filter((v) => v !== null);
  const recentReturns = returns.slice(-7);
  const volatility7d = recentReturns.length ? stdDev(recentReturns) : null;

  const latest = closes[closes.length - 1];
  const lag7 = closes[closes.length - 8];
  const momentum7d = lag7 ? latest - lag7 : null;

  let rollingMax = -Infinity;
  let latestDrawdown = 0;
  closes.forEach((close) => {
    rollingMax = Math.max(rollingMax, close);
    latestDrawdown = rollingMax ? (close - rollingMax) / rollingMax : 0;
  });

  const avgReturn = returns.length
    ? returns.reduce((sum, value) => sum + value, 0) / returns.length
    : 0;
  const momentumPct = lag7 ? (momentum7d / lag7) * 100 : 0;
  const volatilityPct = volatility7d ? volatility7d * 100 : 0;
  const score = momentumPct * 0.4 - volatilityPct * 0.3 + avgReturn * 100 * 0.3;

  return {
    volatility7d,
    momentum7d,
    drawdown: latestDrawdown,
    score,
  };
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pearsonCorrelation(x, y) {
  if (x.length < 2 || y.length < 2 || x.length !== y.length) return null;

  const xMean = mean(x);
  const yMean = mean(y);
  if (xMean === null || yMean === null) return null;

  const numerator = x.reduce((acc, value, idx) => {
    return acc + (value - xMean) * (y[idx] - yMean);
  }, 0);
  const xStd = Math.sqrt(
    x.reduce((acc, value) => acc + (value - xMean) ** 2, 0),
  );
  const yStd = Math.sqrt(
    y.reduce((acc, value) => acc + (value - yMean) ** 2, 0),
  );

  if (!xStd || !yStd) return null;
  return numerator / (xStd * yStd);
}

function buildAlignedReturnPairs(primaryRows, secondaryRows) {
  const primaryMap = new Map(primaryRows.map((row) => [row.date, row.close]));
  const secondaryMap = new Map(
    secondaryRows.map((row) => [row.date, row.close]),
  );
  const sharedDates = Array.from(primaryMap.keys())
    .filter((date) => secondaryMap.has(date))
    .sort((a, b) => new Date(a) - new Date(b));

  if (sharedDates.length < 3) {
    return {
      primaryReturns: [],
      secondaryReturns: [],
      returnCount: 0,
      identicalOverlap: false,
    };
  }

  const overlappingPrimaryCloses = [];
  const overlappingSecondaryCloses = [];
  const primaryReturns = [];
  const secondaryReturns = [];

  for (let i = 1; i < sharedDates.length; i += 1) {
    const prevDate = sharedDates[i - 1];
    const currDate = sharedDates[i];

    const pPrev = primaryMap.get(prevDate);
    const pCurr = primaryMap.get(currDate);
    const sPrev = secondaryMap.get(prevDate);
    const sCurr = secondaryMap.get(currDate);

    if (![pPrev, pCurr, sPrev, sCurr].every(Number.isFinite)) continue;

    const pRet = (pCurr - pPrev) / pPrev;
    const sRet = (sCurr - sPrev) / sPrev;

    if (!Number.isFinite(pRet) || !Number.isFinite(sRet)) continue;

    overlappingPrimaryCloses.push(pCurr);
    overlappingSecondaryCloses.push(sCurr);
    primaryReturns.push(pRet);
    secondaryReturns.push(sRet);
  }

  const identicalOverlap =
    overlappingPrimaryCloses.length > 0 &&
    overlappingPrimaryCloses.every(
      (value, idx) => Math.abs(value - overlappingSecondaryCloses[idx]) < 1e-9,
    );

  return {
    primaryReturns,
    secondaryReturns,
    returnCount: primaryReturns.length,
    identicalOverlap,
  };
}

export function computeCorrelation(primaryRows, secondaryRows) {
  const { primaryReturns, secondaryReturns, returnCount, identicalOverlap } =
    buildAlignedReturnPairs(primaryRows, secondaryRows);

  // Very small samples can produce spurious +/-1.00 correlations.
  if (returnCount < 10) return null;

  if (identicalOverlap) return 1;

  const correlation = pearsonCorrelation(primaryReturns, secondaryReturns);
  if (correlation === null) return null;

  return clamp(correlation, -1, 1);
}

export function getVolatilityExplainability(volatility7d) {
  if (volatility7d === null || volatility7d === undefined) {
    return 'Need more data to assess short-term risk.';
  }
  const volatilityPct = volatility7d * 100;
  if (volatilityPct >= 3) {
    return 'High volatility -> elevated short-term risk and wider price swings.';
  }
  if (volatilityPct >= 1.5) {
    return 'Moderate volatility -> short-term risk is present.';
  }
  return 'Low volatility -> price action is relatively stable right now.';
}

export function getMomentumExplainability(momentum7d) {
  if (momentum7d === null || momentum7d === undefined) {
    return 'Need more data to detect directional pressure.';
  }
  if (momentum7d < 0) {
    return 'Bearish momentum -> selling pressure detected.';
  }
  if (momentum7d > 0) {
    return 'Bullish momentum -> buying pressure detected.';
  }
  return 'Flat momentum -> no strong directional edge.';
}

export function deriveForecastConfidence(forecast) {
  if (!forecast) return null;

  const probabilities = Array.isArray(forecast.predictions)
    ? forecast.predictions
        .map((row) => safeNumber(row?.trend_probability_up))
        .filter((value) => value !== null)
    : [];
  const trendConsistency =
    probabilities.length > 0
      ? mean(probabilities.map((value) => Math.abs(value - 0.5) * 2))
      : null;

  const rmseValues = Array.isArray(forecast?.model_diagnostics?.models)
    ? forecast.model_diagnostics.models
        .map((model) => safeNumber(model?.rmse))
        .filter((value) => value !== null)
    : [];
  const avgRmse = rmseValues.length ? mean(rmseValues) : null;

  const referencePrice =
    safeNumber(forecast?.current_close) || safeNumber(forecast?.expected_close);
  const rmseRatio =
    avgRmse !== null && referencePrice
      ? clamp(avgRmse / Math.max(referencePrice, 1), 0, 1)
      : null;

  const terminalPrediction = Array.isArray(forecast.predictions)
    ? forecast.predictions[forecast.predictions.length - 1]
    : null;
  const ciLower = safeNumber(terminalPrediction?.confidence_95?.lower);
  const ciUpper = safeNumber(terminalPrediction?.confidence_95?.upper);
  const ciMid =
    ciLower !== null && ciUpper !== null
      ? Math.max((ciLower + ciUpper) / 2, 1)
      : null;
  const ciHalfWidthRatio =
    ciLower !== null && ciUpper !== null && ciMid !== null
      ? clamp((ciUpper - ciLower) / (2 * ciMid), 0, 1)
      : null;

  const trendComponent = trendConsistency === null ? 0.5 : trendConsistency;
  const errorComponent = rmseRatio === null ? 0.5 : 1 - rmseRatio;
  const bandComponent = ciHalfWidthRatio === null ? 0.5 : 1 - ciHalfWidthRatio;

  const confidence = clamp(
    0.45 * trendComponent + 0.35 * errorComponent + 0.2 * bandComponent,
    0,
    0.99,
  );

  return Math.round(confidence * 100);
}

export function scoreLabel(score) {
  if (score === null || score === undefined) return 'Insufficient Data';
  if (score >= 2) return 'Strong Buy';
  if (score <= -2) return 'Risky';
  return 'Hold';
}

export function createPriceChartOptions(prices) {
  return {
    chart: { toolbar: { show: false }, animations: { easing: 'easeinout' } },
    stroke: { curve: 'smooth', width: [3, 2] },
    colors: ['#2B6CB0', '#F6AD55'],
    xaxis: {
      categories: prices.map((row) => row.date),
      labels: { rotate: -45, style: { fontSize: '11px' } },
    },
    yaxis: { labels: { formatter: (v) => numberFmt.format(v) } },
    tooltip: { shared: true, theme: 'dark' },
    legend: { position: 'top' },
    grid: { borderColor: 'rgba(120, 130, 150, 0.2)' },
  };
}

export function createCompareChartConfig(
  prices,
  comparePrices,
  symbol,
  compareSymbol,
) {
  if (!prices.length || !comparePrices.length || symbol === compareSymbol) {
    return null;
  }

  const toNormalized = (rows) => {
    const base = rows[0]?.close;
    if (!base) return [];
    return rows.map((row) => ({
      date: row.date,
      pct: ((row.close - base) / base) * 100,
    }));
  };

  const primary = toNormalized(prices);
  const secondary = toNormalized(comparePrices);
  const secondaryMap = new Map(secondary.map((row) => [row.date, row.pct]));
  const mergedDates = primary
    .map((row) => row.date)
    .filter((date) => secondaryMap.has(date));
  const returnPairs = buildAlignedReturnPairs(prices, comparePrices);

  return {
    options: {
      chart: { toolbar: { show: false } },
      xaxis: { categories: mergedDates },
      yaxis: { labels: { formatter: (v) => `${numberFmt.format(v)}%` } },
      legend: { position: 'top' },
      tooltip: { shared: true, theme: 'dark' },
      colors: ['#2F855A', '#C53030'],
    },
    series: [
      {
        name: `${symbol} Normalized %`,
        data: primary
          .filter((row) => mergedDates.includes(row.date))
          .map((row) => row.pct),
      },
      {
        name: `${compareSymbol} Normalized %`,
        data: secondary
          .filter((row) => mergedDates.includes(row.date))
          .map((row) => row.pct),
      },
    ],
    correlation: computeCorrelation(prices, comparePrices),
    correlationSampleSize: returnPairs.returnCount,
    correlationDataWarning: returnPairs.identicalOverlap
      ? 'Overlapping prices are identical; correlation is likely inflated by duplicate series.'
      : null,
  };
}

export function createForecastSeries(forecast, prices) {
  if (!forecast?.predictions?.length) return null;
  const predictionRows = forecast.predictions;
  const historySlice = prices.slice(-20);
  const categories = [
    ...historySlice.map((row) => row.date),
    ...predictionRows.map((row) => row.date),
  ];
  const historyData = [
    ...historySlice.map((row) => row.close),
    ...Array(predictionRows.length).fill(null),
  ];
  const futureData = [
    ...Array(historySlice.length).fill(null),
    ...predictionRows.map((row) => safeNumber(row.predicted_close)),
  ];

  return {
    categories,
    series: [
      { name: 'Recent Close', data: historyData },
      { name: 'Forecast Close', data: futureData },
    ],
  };
}

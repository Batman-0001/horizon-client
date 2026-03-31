import React from 'react';
import {
  Badge,
  Box,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Grid,
  Input,
  Progress,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import ReactApexChart from 'react-apexcharts';
import Card from 'components/card/Card';
import {
  fetchCompanies,
  fetchStockData,
  fetchStrategyRecommendationHistory,
  fetchStrategyRecommendation,
} from 'api/stockApi';
import {
  normalizeCompanies,
  normalizePriceRows,
} from 'views/admin/default/stockDashboard/utils';

const LOOKBACK_OPTIONS = [
  { label: '1 Month', months: 1, days: 45 },
  { label: '3 Months', months: 3, days: 110 },
  { label: '6 Months', months: 6, days: 210 },
  { label: '12 Months', months: 12, days: 390 },
];

const STRATEGY_OPTIONS = [
  { value: 'lumpsum', label: 'Lump Sum' },
  { value: 'sip', label: 'Monthly SIP' },
  { value: 'value_averaging', label: 'Value Averaging' },
  { value: 'dip_buying', label: 'Dip Buying' },
  { value: 'moving_average', label: '7-Day MA Filter' },
  { value: 'volatility_allocation', label: 'Volatility Allocation' },
  { value: 'profit_booking', label: 'Profit Booking (10%)' },
  { value: 'rebalancing_50_50', label: '50-50 Rebalancing' },
];

const SIMULATION_MODE_OPTIONS = [
  { value: 'independent', label: 'Independent Strategies' },
  { value: 'portfolio_rebalance', label: 'Portfolio Rebalancing 50-50' },
];

const STRATEGY_LABELS = STRATEGY_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const pctFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

function toDateValue(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function findClosestOnOrAfter(rows, targetDate) {
  const targetTime = targetDate.getTime();
  const nextRow = rows.find((row) => {
    const rowDate = toDateValue(row.date);
    return rowDate && rowDate.getTime() >= targetTime;
  });
  return nextRow || rows[rows.length - 1] || null;
}

function findClosestIndexOnOrAfter(rows, targetDate) {
  const targetTime = targetDate.getTime();
  const index = rows.findIndex((row) => {
    const rowDate = toDateValue(row.date);
    return rowDate && rowDate.getTime() >= targetTime;
  });
  return index >= 0 ? index : rows.length - 1;
}

function addMonths(baseDate, months) {
  const next = new Date(baseDate);
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatSignedCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${inrFormatter.format(Math.abs(value))}`;
}

function computeAnnualizedReturnPct(result, lookbackMonths) {
  if (
    !result ||
    !result.invested ||
    result.invested <= 0 ||
    lookbackMonths <= 0
  ) {
    return null;
  }
  const totalReturn = result.currentValue / result.invested;
  if (!Number.isFinite(totalReturn) || totalReturn <= 0) return null;
  const years = lookbackMonths / 12;
  if (years <= 0) return null;
  return (Math.pow(totalReturn, 1 / years) - 1) * 100;
}

function getRelevantRows(rows, lookbackMonths) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const endDate = toDateValue(rows[rows.length - 1]?.date);
  if (!endDate) return [];
  const startDate = addMonths(endDate, -lookbackMonths);
  return rows.filter((row) => {
    const d = toDateValue(row.date);
    return d && d.getTime() >= startDate.getTime();
  });
}

function computeDailyReturns(rows, lookbackMonths) {
  const relevantRows = getRelevantRows(rows, lookbackMonths);
  const returns = [];
  for (let idx = 1; idx < relevantRows.length; idx += 1) {
    const prev = relevantRows[idx - 1]?.close;
    const curr = relevantRows[idx]?.close;
    if (!prev || !curr) continue;
    returns.push(((curr - prev) / prev) * 100);
  }
  return returns;
}

function computeAverageDailyReturnPct(rows, lookbackMonths) {
  const returns = computeDailyReturns(rows, lookbackMonths);
  if (!returns.length) return null;
  const total = returns.reduce((sum, value) => sum + value, 0);
  return total / returns.length;
}

function computeVolatilityPct(rows, lookbackMonths) {
  const returns = computeDailyReturns(rows, lookbackMonths);
  if (returns.length < 2) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (returns.length - 1);
  const std = Math.sqrt(variance);
  return Number.isFinite(std) ? std : null;
}

function marketConditionFromAvg(avgDailyReturnPct) {
  if (avgDailyReturnPct === null || avgDailyReturnPct === undefined) {
    return { tag: 'Insufficient Data', colorScheme: 'gray' };
  }
  if (avgDailyReturnPct < 0) {
    return { tag: 'Bearish Phase', colorScheme: 'red' };
  }
  if (avgDailyReturnPct > 0) {
    return { tag: 'Bullish Phase', colorScheme: 'green' };
  }
  return { tag: 'Sideways Phase', colorScheme: 'orange' };
}

function computeMaxDrawdownPct(rows, lookbackMonths) {
  if (!Array.isArray(rows) || rows.length < 2) return null;

  const endRow = rows[rows.length - 1];
  const endDate = toDateValue(endRow?.date);
  if (!endDate) return null;

  const startDate = addMonths(endDate, -lookbackMonths);
  const relevantRows = rows.filter((row) => {
    const d = toDateValue(row.date);
    return d && d.getTime() >= startDate.getTime();
  });

  if (relevantRows.length < 2) return null;

  let peak = relevantRows[0].close;
  let worst = 0;
  relevantRows.forEach((row) => {
    if (!row?.close) return;
    peak = Math.max(peak, row.close);
    if (!peak) return;
    const dd = ((row.close - peak) / peak) * 100;
    worst = Math.min(worst, dd);
  });

  return worst;
}

function computeMonthlyWinRatePct(rows, lookbackMonths) {
  if (!Array.isArray(rows) || rows.length < 2 || lookbackMonths <= 0)
    return null;

  const endRow = rows[rows.length - 1];
  const endDate = toDateValue(endRow?.date);
  if (!endDate) return null;

  const startDate = addMonths(endDate, -lookbackMonths);
  const relevantRows = rows.filter((row) => {
    const d = toDateValue(row.date);
    return d && d.getTime() >= startDate.getTime();
  });

  if (relevantRows.length < 2) return null;

  let positiveMonths = 0;
  let totalMonths = 0;

  for (let idx = 1; idx <= lookbackMonths; idx += 1) {
    const monthStart = addMonths(startDate, idx - 1);
    const monthEnd = addMonths(startDate, idx);
    const startRow = findClosestOnOrAfter(relevantRows, monthStart);
    const endMonthRows = relevantRows.filter((row) => {
      const d = toDateValue(row.date);
      return d && d.getTime() < monthEnd.getTime();
    });
    const monthEndRow = endMonthRows[endMonthRows.length - 1] || null;

    if (!startRow || !monthEndRow || !startRow.close || !monthEndRow.close) {
      continue;
    }

    totalMonths += 1;
    if (monthEndRow.close >= startRow.close) {
      positiveMonths += 1;
    }
  }

  if (!totalMonths) return null;
  return (positiveMonths / totalMonths) * 100;
}

function calculateLumpsum(rows, amount, lookbackMonths) {
  if (!rows.length || amount <= 0) return null;

  const endRow = rows[rows.length - 1];
  const endDate = toDateValue(endRow.date);
  if (!endDate) return null;

  const startTarget = addMonths(endDate, -lookbackMonths);
  const startRow = findClosestOnOrAfter(rows, startTarget);
  if (!startRow || !startRow.close || !endRow.close) return null;

  const units = amount / startRow.close;
  const currentValue = units * endRow.close;
  const pnl = currentValue - amount;

  return {
    invested: amount,
    currentValue,
    pnl,
    pnlPct: amount ? (pnl / amount) * 100 : 0,
    units,
    entries: 1,
    startDate: startRow.date,
    endDate: endRow.date,
  };
}

function calculateSip(rows, amount, lookbackMonths) {
  if (!rows.length || amount <= 0 || lookbackMonths <= 0) return null;

  const endRow = rows[rows.length - 1];
  const endDate = toDateValue(endRow.date);
  if (!endDate || !endRow.close) return null;

  const startDate = addMonths(endDate, -lookbackMonths);
  const installments = lookbackMonths;
  const installmentAmount = amount / installments;

  let totalUnits = 0;
  let invested = 0;
  for (let idx = 0; idx < installments; idx += 1) {
    const targetDate = addMonths(startDate, idx);
    const priceRow = findClosestOnOrAfter(rows, targetDate);
    if (!priceRow || !priceRow.close) continue;
    totalUnits += installmentAmount / priceRow.close;
    invested += installmentAmount;
  }

  if (invested <= 0 || totalUnits <= 0) return null;

  const currentValue = totalUnits * endRow.close;
  const pnl = currentValue - invested;

  return {
    invested,
    currentValue,
    pnl,
    pnlPct: invested ? (pnl / invested) * 100 : 0,
    units: totalUnits,
    entries: installments,
    startDate: rows[0]?.date || '--',
    endDate: endRow.date,
  };
}

function calculateValueAveraging(rows, amount, lookbackMonths) {
  if (!rows.length || amount <= 0 || lookbackMonths <= 0) return null;

  const endRow = rows[rows.length - 1];
  const endDate = toDateValue(endRow.date);
  if (!endDate || !endRow.close) return null;

  const startDate = addMonths(endDate, -lookbackMonths);
  const targetGrowth = amount / lookbackMonths;
  let units = 0;
  let invested = 0;
  let entries = 0;

  for (let idx = 0; idx < lookbackMonths; idx += 1) {
    const targetDate = addMonths(startDate, idx);
    const row = findClosestOnOrAfter(rows, targetDate);
    if (!row?.close) continue;

    const targetValue = targetGrowth * (idx + 1);
    const currentValue = units * row.close;
    const investment = Math.max(0, targetValue - currentValue);
    if (!investment) continue;

    units += investment / row.close;
    invested += investment;
    entries += 1;
  }

  if (invested <= 0 || units <= 0) return null;

  const currentValue = units * endRow.close;
  const pnl = currentValue - invested;

  return {
    invested,
    currentValue,
    pnl,
    pnlPct: invested ? (pnl / invested) * 100 : 0,
    units,
    entries,
    startDate: rows[0]?.date || '--',
    endDate: endRow.date,
  };
}

function calculateDipBuying(rows, amount, lookbackMonths) {
  if (!rows.length || amount <= 0 || lookbackMonths <= 0) return null;

  const endRow = rows[rows.length - 1];
  const endDate = toDateValue(endRow.date);
  if (!endDate || !endRow.close) return null;

  const startDate = addMonths(endDate, -lookbackMonths);
  const baseInstallment = amount / lookbackMonths;
  const dipThresholdPct = -5;
  const dipMultiplier = 1.6;
  let units = 0;
  let invested = 0;
  let entries = 0;
  let prevPrice = null;

  for (let idx = 0; idx < lookbackMonths; idx += 1) {
    const targetDate = addMonths(startDate, idx);
    const row = findClosestOnOrAfter(rows, targetDate);
    if (!row?.close) continue;

    let installment = baseInstallment;
    if (prevPrice) {
      const changePct = ((row.close - prevPrice) / prevPrice) * 100;
      if (changePct <= dipThresholdPct) {
        installment *= dipMultiplier;
      }
    }

    units += installment / row.close;
    invested += installment;
    entries += 1;
    prevPrice = row.close;
  }

  if (invested <= 0 || units <= 0) return null;

  const currentValue = units * endRow.close;
  const pnl = currentValue - invested;

  return {
    invested,
    currentValue,
    pnl,
    pnlPct: invested ? (pnl / invested) * 100 : 0,
    units,
    entries,
    startDate: rows[0]?.date || '--',
    endDate: endRow.date,
  };
}

function calculateMovingAverageFilter(rows, amount, lookbackMonths) {
  if (!rows.length || amount <= 0 || lookbackMonths <= 0) return null;

  const endRow = rows[rows.length - 1];
  const endDate = toDateValue(endRow.date);
  if (!endDate || !endRow.close) return null;

  const startDate = addMonths(endDate, -lookbackMonths);
  const installment = amount / lookbackMonths;
  let units = 0;
  let invested = 0;
  let entries = 0;

  for (let idx = 0; idx < lookbackMonths; idx += 1) {
    const targetDate = addMonths(startDate, idx);
    const rowIndex = findClosestIndexOnOrAfter(rows, targetDate);
    const row = rows[rowIndex];
    if (!row?.close || rowIndex < 6) continue;

    const lastSeven = rows.slice(Math.max(0, rowIndex - 6), rowIndex + 1);
    const ma7 =
      lastSeven.reduce((sum, day) => sum + (day?.close || 0), 0) /
      lastSeven.length;
    if (!ma7 || row.close <= ma7) continue;

    units += installment / row.close;
    invested += installment;
    entries += 1;
  }

  if (invested <= 0 || units <= 0) return null;

  const currentValue = units * endRow.close;
  const pnl = currentValue - invested;

  return {
    invested,
    currentValue,
    pnl,
    pnlPct: invested ? (pnl / invested) * 100 : 0,
    units,
    entries,
    startDate: rows[0]?.date || '--',
    endDate: endRow.date,
  };
}

function calculateVolatilityAllocation(rows, amount, lookbackMonths) {
  if (!rows.length || amount <= 0 || lookbackMonths <= 0) return null;

  const endRow = rows[rows.length - 1];
  const endDate = toDateValue(endRow.date);
  if (!endDate || !endRow.close) return null;

  const startDate = addMonths(endDate, -lookbackMonths);
  const baseInstallment = amount / lookbackMonths;
  let units = 0;
  let invested = 0;
  let entries = 0;

  for (let idx = 0; idx < lookbackMonths; idx += 1) {
    const targetDate = addMonths(startDate, idx);
    const rowIndex = findClosestIndexOnOrAfter(rows, targetDate);
    const row = rows[rowIndex];
    if (!row?.close) continue;

    const lookbackSlice = rows.slice(Math.max(0, rowIndex - 20), rowIndex + 1);
    const vol = computeVolatilityPct(lookbackSlice, 1) ?? 2;
    const multiplier = vol > 2 ? 0.75 : 1.25;
    const allocation = baseInstallment * multiplier;

    units += allocation / row.close;
    invested += allocation;
    entries += 1;
  }

  if (invested <= 0 || units <= 0) return null;

  const currentValue = units * endRow.close;
  const pnl = currentValue - invested;

  return {
    invested,
    currentValue,
    pnl,
    pnlPct: invested ? (pnl / invested) * 100 : 0,
    units,
    entries,
    startDate: rows[0]?.date || '--',
    endDate: endRow.date,
  };
}

function calculateProfitBooking(rows, amount, lookbackMonths) {
  if (!rows.length || amount <= 0 || lookbackMonths <= 0) return null;

  const endRow = rows[rows.length - 1];
  const endDate = toDateValue(endRow.date);
  if (!endDate || !endRow.close) return null;

  const startDate = addMonths(endDate, -lookbackMonths);
  const installment = amount / lookbackMonths;
  let units = 0;
  let invested = 0;
  let cashBooked = 0;
  let entries = 0;

  for (let idx = 0; idx < lookbackMonths; idx += 1) {
    const targetDate = addMonths(startDate, idx);
    const row = findClosestOnOrAfter(rows, targetDate);
    if (!row?.close) continue;

    units += installment / row.close;
    invested += installment;
    entries += 1;

    const currentMarketValue = units * row.close;
    const gainPct = invested
      ? ((currentMarketValue - invested) / invested) * 100
      : 0;
    if (gainPct >= 10 && units > 0) {
      const sellUnits = units * 0.15;
      const booked = sellUnits * row.close;
      units -= sellUnits;
      cashBooked += booked;
    }
  }

  if (invested <= 0) return null;

  const currentValue = units * endRow.close + cashBooked;
  const pnl = currentValue - invested;

  return {
    invested,
    currentValue,
    pnl,
    pnlPct: invested ? (pnl / invested) * 100 : 0,
    units,
    entries,
    startDate: rows[0]?.date || '--',
    endDate: endRow.date,
  };
}

function calculateRebalancing5050(rows, peerRows, amount, lookbackMonths) {
  if (!rows.length || !peerRows.length || amount <= 0 || lookbackMonths <= 0) {
    return null;
  }

  const endRow = rows[rows.length - 1];
  const endPeerRow = peerRows[peerRows.length - 1];
  const endDate = toDateValue(endRow.date);
  const endPeerDate = toDateValue(endPeerRow.date);
  if (!endDate || !endPeerDate || !endRow.close || !endPeerRow.close)
    return null;

  const effectiveEndDate = endDate < endPeerDate ? endDate : endPeerDate;
  const startDate = addMonths(effectiveEndDate, -lookbackMonths);
  const startRow = findClosestOnOrAfter(rows, startDate);
  const startPeerRow = findClosestOnOrAfter(peerRows, startDate);
  if (!startRow?.close || !startPeerRow?.close) return null;

  let unitsPrimary = (amount * 0.5) / startRow.close;
  let unitsSecondary = (amount * 0.5) / startPeerRow.close;

  for (let idx = 1; idx < lookbackMonths; idx += 1) {
    const rebalanceDate = addMonths(startDate, idx);
    const row = findClosestOnOrAfter(rows, rebalanceDate);
    const peer = findClosestOnOrAfter(peerRows, rebalanceDate);
    if (!row?.close || !peer?.close) continue;

    const totalValue = unitsPrimary * row.close + unitsSecondary * peer.close;
    const targetBucket = totalValue * 0.5;
    unitsPrimary = targetBucket / row.close;
    unitsSecondary = targetBucket / peer.close;
  }

  const finalRow = findClosestOnOrAfter(rows, effectiveEndDate);
  const finalPeerRow = findClosestOnOrAfter(peerRows, effectiveEndDate);
  if (!finalRow?.close || !finalPeerRow?.close) return null;

  const currentValue =
    unitsPrimary * finalRow.close + unitsSecondary * finalPeerRow.close;
  const pnl = currentValue - amount;

  return {
    invested: amount,
    currentValue,
    pnl,
    pnlPct: amount ? (pnl / amount) * 100 : 0,
    units: unitsPrimary,
    entries: lookbackMonths,
    startDate: startRow.date,
    endDate: finalRow.date,
  };
}

function calculateStatic5050(rows, peerRows, amount, lookbackMonths) {
  if (!rows.length || !peerRows.length || amount <= 0 || lookbackMonths <= 0) {
    return null;
  }

  const endRow = rows[rows.length - 1];
  const endPeerRow = peerRows[peerRows.length - 1];
  const endDate = toDateValue(endRow.date);
  const endPeerDate = toDateValue(endPeerRow.date);
  if (!endDate || !endPeerDate || !endRow.close || !endPeerRow.close)
    return null;

  const effectiveEndDate = endDate < endPeerDate ? endDate : endPeerDate;
  const startDate = addMonths(effectiveEndDate, -lookbackMonths);
  const startRow = findClosestOnOrAfter(rows, startDate);
  const startPeerRow = findClosestOnOrAfter(peerRows, startDate);
  if (!startRow?.close || !startPeerRow?.close) return null;

  const unitsPrimary = (amount * 0.5) / startRow.close;
  const unitsSecondary = (amount * 0.5) / startPeerRow.close;
  const finalRow = findClosestOnOrAfter(rows, effectiveEndDate);
  const finalPeerRow = findClosestOnOrAfter(peerRows, effectiveEndDate);
  if (!finalRow?.close || !finalPeerRow?.close) return null;

  const currentValue =
    unitsPrimary * finalRow.close + unitsSecondary * finalPeerRow.close;
  const pnl = currentValue - amount;

  return {
    invested: amount,
    currentValue,
    pnl,
    pnlPct: amount ? (pnl / amount) * 100 : 0,
    units: unitsPrimary,
    entries: 1,
    startDate: startRow.date,
    endDate: finalRow.date,
  };
}

function calculateSeriesVolatilityPct(values) {
  if (!Array.isArray(values) || values.length < 3) return null;
  const returns = [];
  for (let idx = 1; idx < values.length; idx += 1) {
    const prev = values[idx - 1];
    const curr = values[idx];
    if (!prev || !curr) continue;
    returns.push(((curr - prev) / prev) * 100);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (returns.length - 1);
  const std = Math.sqrt(variance);
  return Number.isFinite(std) ? std : null;
}

function calculateSeriesMaxDrawdownPct(values) {
  if (!Array.isArray(values) || values.length < 2) return null;
  let peak = values[0];
  let worst = 0;
  values.forEach((value) => {
    if (!value) return;
    peak = Math.max(peak, value);
    if (!peak) return;
    const dd = ((value - peak) / peak) * 100;
    worst = Math.min(worst, dd);
  });
  return worst;
}

function buildPortfolioValueSeries(
  rows,
  peerRows,
  amount,
  lookbackMonths,
  rebalanceMonthly,
) {
  if (!rows.length || !peerRows.length || amount <= 0 || lookbackMonths <= 0) {
    return [];
  }

  const endRow = rows[rows.length - 1];
  const endPeerRow = peerRows[peerRows.length - 1];
  const endDate = toDateValue(endRow.date);
  const endPeerDate = toDateValue(endPeerRow.date);
  if (!endDate || !endPeerDate || !endRow.close || !endPeerRow.close) return [];

  const effectiveEndDate = endDate < endPeerDate ? endDate : endPeerDate;
  const startDate = addMonths(effectiveEndDate, -lookbackMonths);
  const startRow = findClosestOnOrAfter(rows, startDate);
  const startPeerRow = findClosestOnOrAfter(peerRows, startDate);
  if (!startRow?.close || !startPeerRow?.close) return [];

  let unitsPrimary = (amount * 0.5) / startRow.close;
  let unitsSecondary = (amount * 0.5) / startPeerRow.close;
  const values = [amount];

  for (let idx = 1; idx <= lookbackMonths; idx += 1) {
    const sampleDate = addMonths(startDate, idx);
    const row = findClosestOnOrAfter(rows, sampleDate);
    const peer = findClosestOnOrAfter(peerRows, sampleDate);
    if (!row?.close || !peer?.close) continue;

    const currentValue = unitsPrimary * row.close + unitsSecondary * peer.close;
    values.push(currentValue);

    if (rebalanceMonthly && idx < lookbackMonths) {
      const targetBucket = currentValue * 0.5;
      unitsPrimary = targetBucket / row.close;
      unitsSecondary = targetBucket / peer.close;
    }
  }

  return values;
}

function explainDriver(driver) {
  if (!driver) return '';
  const copyMap = {
    volatility:
      'High volatility pushed allocation toward defensive cadence and phased entries.',
    drawdown:
      'Deeper drawdown profile increased the model preference for downside-resilient strategies.',
    avg_daily_return:
      'Average daily return trend influenced whether momentum capture or defense was prioritized.',
    primary_edge:
      'Relative performance edge between selected setups shifted the final strategy tilt.',
  };
  return (
    copyMap[driver.feature] ||
    `${driver.feature} materially impacted the recommendation weighting.`
  );
}

function marketConditionFromTag(tag) {
  if (tag === 'Bearish Phase') return { tag, colorScheme: 'red' };
  if (tag === 'Bullish Phase') return { tag, colorScheme: 'green' };
  if (tag === 'Sideways Phase') return { tag, colorScheme: 'orange' };
  return { tag: tag || 'Insufficient Data', colorScheme: 'gray' };
}

function buildStrategyInsight({
  marketConditionTag,
  primaryResult,
  secondaryResult,
  primaryStrategy,
  secondaryStrategy,
}) {
  if (!primaryResult || !secondaryResult) {
    return 'Run both scenarios to unlock strategy-level intelligence.';
  }

  const primaryLabel = STRATEGY_LABELS[primaryStrategy] || primaryStrategy;
  const secondaryLabel =
    STRATEGY_LABELS[secondaryStrategy] || secondaryStrategy;
  const diff = primaryResult.currentValue - secondaryResult.currentValue;
  const leader = diff >= 0 ? primaryLabel : secondaryLabel;

  if (marketConditionTag === 'Bearish Phase') {
    if (primaryStrategy === 'sip' || secondaryStrategy === 'sip') {
      return `${leader} outperformed during a falling tape, helping reduce drawdown pressure versus lumpier entries.`;
    }
    return `${leader} held up better in a bearish phase, indicating stronger downside resilience for this window.`;
  }

  if (marketConditionTag === 'Bullish Phase') {
    return `${leader} captured upside more effectively in a bullish phase, converting trend strength into higher terminal value.`;
  }

  return `${leader} delivered better consistency in a range-bound phase, where disciplined allocation mattered more than timing.`;
}

function buildRecommendation({
  marketConditionTag,
  avgVolatilityPct,
  primaryResult,
  secondaryResult,
  primaryStrategy,
  secondaryStrategy,
}) {
  if (!primaryResult || !secondaryResult) {
    return {
      strategy: 'Awaiting Data',
      reason:
        'Need two valid strategy outcomes before recommendation can be generated.',
    };
  }

  const highVolatility = avgVolatilityPct !== null && avgVolatilityPct >= 2;
  if (marketConditionTag === 'Bearish Phase' || highVolatility) {
    if (primaryStrategy === 'sip' || secondaryStrategy === 'sip') {
      return {
        strategy: 'Monthly SIP',
        reason:
          'Lower timing risk in volatile or bearish conditions improves consistency and limits drawdown shocks.',
      };
    }
    return {
      strategy: 'Value Averaging',
      reason:
        'Adaptive allocation performs better when volatility is elevated and prices mean-revert quickly.',
    };
  }

  const better =
    primaryResult.currentValue >= secondaryResult.currentValue
      ? STRATEGY_LABELS[primaryStrategy] || primaryStrategy
      : STRATEGY_LABELS[secondaryStrategy] || secondaryStrategy;

  return {
    strategy: better,
    reason:
      'Trend and volatility profile favor the higher-return setup in the selected lookback period.',
  };
}

function SimulationCard({
  title,
  subtitle,
  result,
  annualizedReturnPct,
  maxDrawdownPct,
  monthlyWinRatePct,
}) {
  const mutedColor = useColorModeValue(
    'secondaryGray.600',
    'secondaryGray.300',
  );
  const positive = result?.pnl >= 0;
  const pnlStrength = result ? Math.min(100, Math.abs(result.pnlPct) * 2) : 0;

  return (
    <Card p="20px">
      <Text color="secondaryGray.900" fontWeight="700" fontSize="lg">
        {title}
      </Text>
      <Text color={mutedColor} fontSize="sm" mt="2px">
        {subtitle}
      </Text>
      <Stack spacing="10px" mt="18px">
        <Box>
          <Text fontSize="xs" color={mutedColor}>
            Current Value
          </Text>
          <Text fontSize="xl" fontWeight="700">
            {result ? inrFormatter.format(result.currentValue) : '--'}
          </Text>
        </Box>
        <Box>
          <Text fontSize="xs" color={mutedColor}>
            Profit / Loss
          </Text>
          <Text
            fontSize="xl"
            fontWeight="700"
            color={result ? (positive ? 'green.500' : 'red.500') : mutedColor}
          >
            {result
              ? `${formatSignedCurrency(result.pnl)} (${pctFormatter.format(result.pnlPct)}%)`
              : '--'}
          </Text>
          <Progress
            value={pnlStrength}
            colorScheme={positive ? 'green' : 'red'}
            size="sm"
            mt="8px"
            borderRadius="999px"
            bg="blackAlpha.100"
          />
        </Box>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="10px">
          <Box>
            <Text fontSize="xs" color={mutedColor}>
              Annualized Return
            </Text>
            <Text
              fontSize="sm"
              fontWeight="700"
              color={
                annualizedReturnPct !== null && annualizedReturnPct >= 0
                  ? 'green.500'
                  : 'red.500'
              }
            >
              {annualizedReturnPct === null
                ? '--'
                : `${pctFormatter.format(annualizedReturnPct)}%`}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color={mutedColor}>
              Max Drawdown
            </Text>
            <Text
              fontSize="sm"
              fontWeight="700"
              color={maxDrawdownPct === null ? mutedColor : 'red.500'}
            >
              {maxDrawdownPct === null
                ? '--'
                : `${pctFormatter.format(maxDrawdownPct)}%`}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color={mutedColor}>
              Positive Months
            </Text>
            <Text
              fontSize="sm"
              fontWeight="700"
              color={
                monthlyWinRatePct !== null && monthlyWinRatePct >= 50
                  ? 'green.500'
                  : mutedColor
              }
            >
              {monthlyWinRatePct === null
                ? '--'
                : `${pctFormatter.format(monthlyWinRatePct)}%`}
            </Text>
          </Box>
        </SimpleGrid>
        <Text fontSize="sm" color={mutedColor}>
          {result
            ? `${result.entries} allocation${result.entries > 1 ? 's' : ''} from ${result.startDate} to ${result.endDate}`
            : 'Not enough data for this simulation window.'}
        </Text>
      </Stack>
    </Card>
  );
}

export default function WhatIfSimulator() {
  const [companies, setCompanies] = React.useState([]);
  const [simulationMode, setSimulationMode] = React.useState('independent');
  const [amount, setAmount] = React.useState('10000');
  const [lookbackMonths, setLookbackMonths] = React.useState(3);
  const [primarySymbol, setPrimarySymbol] = React.useState('');
  const [secondarySymbol, setSecondarySymbol] = React.useState('');
  const [primaryStrategy, setPrimaryStrategy] = React.useState('lumpsum');
  const [secondaryStrategy, setSecondaryStrategy] = React.useState('sip');
  const [pricesBySymbol, setPricesBySymbol] = React.useState({});
  const [mlRecommendation, setMlRecommendation] = React.useState(null);
  const [mlLoading, setMlLoading] = React.useState(false);
  const [mlError, setMlError] = React.useState('');
  const [recommendationHistory, setRecommendationHistory] = React.useState([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const mutedColor = useColorModeValue(
    'secondaryGray.600',
    'secondaryGray.300',
  );

  const selectedDays = React.useMemo(
    () =>
      LOOKBACK_OPTIONS.find((option) => option.months === lookbackMonths)
        ?.days || 110,
    [lookbackMonths],
  );

  React.useEffect(() => {
    let active = true;

    const loadCompanies = async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await fetchCompanies();
        if (!active) return;
        const normalized = normalizeCompanies(payload);
        setCompanies(normalized);

        if (!normalized.length) return;

        setPrimarySymbol((prev) => prev || normalized[0].symbol);
        setSecondarySymbol((prev) => {
          if (prev) return prev;
          const fallback = normalized.find(
            (row) => row.symbol !== normalized[0].symbol,
          );
          return fallback ? fallback.symbol : normalized[0].symbol;
        });
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Failed to load company list');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadCompanies();

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!primarySymbol && !secondarySymbol) return;
    let active = true;

    const symbols = [primarySymbol, secondarySymbol].filter(Boolean);
    const uniqueSymbols = Array.from(new Set(symbols));

    const loadPrices = async () => {
      setLoading(true);
      setError('');
      try {
        const responses = await Promise.all(
          uniqueSymbols.map((symbol) => fetchStockData(symbol, selectedDays)),
        );
        if (!active) return;

        const next = {};
        uniqueSymbols.forEach((symbol, idx) => {
          next[symbol] = normalizePriceRows(responses[idx]);
        });
        setPricesBySymbol(next);
      } catch (loadError) {
        if (active) {
          setPricesBySymbol({});
          setError(loadError.message || 'Failed to load historical prices');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPrices();

    return () => {
      active = false;
    };
  }, [primarySymbol, secondarySymbol, selectedDays]);

  const numericAmount = React.useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [amount]);

  const primaryRows = pricesBySymbol[primarySymbol] || [];
  const secondaryRows = pricesBySymbol[secondarySymbol] || [];

  const runStrategy = React.useCallback(
    (rows, strategy, peerRows = []) => {
      if (strategy === 'sip')
        return calculateSip(rows, numericAmount, lookbackMonths);
      if (strategy === 'value_averaging') {
        return calculateValueAveraging(rows, numericAmount, lookbackMonths);
      }
      if (strategy === 'dip_buying') {
        return calculateDipBuying(rows, numericAmount, lookbackMonths);
      }
      if (strategy === 'moving_average') {
        return calculateMovingAverageFilter(
          rows,
          numericAmount,
          lookbackMonths,
        );
      }
      if (strategy === 'volatility_allocation') {
        return calculateVolatilityAllocation(
          rows,
          numericAmount,
          lookbackMonths,
        );
      }
      if (strategy === 'profit_booking') {
        return calculateProfitBooking(rows, numericAmount, lookbackMonths);
      }
      if (strategy === 'rebalancing_50_50') {
        return calculateRebalancing5050(
          rows,
          peerRows,
          numericAmount,
          lookbackMonths,
        );
      }
      return calculateLumpsum(rows, numericAmount, lookbackMonths);
    },
    [lookbackMonths, numericAmount],
  );

  const independentPrimaryResult = React.useMemo(
    () => runStrategy(primaryRows, primaryStrategy, secondaryRows),
    [runStrategy, primaryRows, primaryStrategy, secondaryRows],
  );

  const independentSecondaryResult = React.useMemo(
    () => runStrategy(secondaryRows, secondaryStrategy, primaryRows),
    [runStrategy, secondaryRows, secondaryStrategy, primaryRows],
  );

  const portfolioRebalancedResult = React.useMemo(
    () =>
      calculateRebalancing5050(
        primaryRows,
        secondaryRows,
        numericAmount,
        lookbackMonths,
      ),
    [primaryRows, secondaryRows, numericAmount, lookbackMonths],
  );

  const portfolioStaticResult = React.useMemo(
    () =>
      calculateStatic5050(
        primaryRows,
        secondaryRows,
        numericAmount,
        lookbackMonths,
      ),
    [primaryRows, secondaryRows, numericAmount, lookbackMonths],
  );

  const primaryResult =
    simulationMode === 'portfolio_rebalance'
      ? portfolioRebalancedResult
      : independentPrimaryResult;

  const secondaryResult =
    simulationMode === 'portfolio_rebalance'
      ? portfolioStaticResult
      : independentSecondaryResult;

  React.useEffect(() => {
    if (simulationMode === 'portfolio_rebalance') {
      setMlRecommendation(null);
      setMlError('ML recommendation is available in independent mode.');
      return;
    }

    const hasInputs =
      Boolean(primarySymbol) &&
      Boolean(secondarySymbol) &&
      Boolean(primaryStrategy) &&
      Boolean(secondaryStrategy) &&
      numericAmount > 0;

    if (!hasInputs) {
      setMlRecommendation(null);
      setMlError('');
      return;
    }

    let active = true;

    const loadRecommendation = async () => {
      setMlLoading(true);
      setMlError('');
      try {
        const payload = await fetchStrategyRecommendation({
          primarySymbol,
          secondarySymbol,
          primaryStrategy,
          secondaryStrategy,
          amount: numericAmount,
          lookbackMonths,
        });
        if (!active) return;
        setMlRecommendation(payload);
      } catch (loadError) {
        if (!active) return;
        setMlRecommendation(null);
        setMlError(
          loadError.message || 'ML recommendation is temporarily unavailable.',
        );
      } finally {
        if (active) {
          setMlLoading(false);
        }
      }
    };

    loadRecommendation();

    return () => {
      active = false;
    };
  }, [
    simulationMode,
    primarySymbol,
    secondarySymbol,
    primaryStrategy,
    secondaryStrategy,
    numericAmount,
    lookbackMonths,
  ]);

  React.useEffect(() => {
    if (simulationMode !== 'independent') {
      setRecommendationHistory([]);
      return;
    }

    let active = true;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const payload = await fetchStrategyRecommendationHistory({
          limit: 6,
          symbol: primarySymbol || undefined,
          sinceDays: 90,
        });
        if (!active) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setRecommendationHistory(items);
      } catch {
        if (!active) return;
        setRecommendationHistory([]);
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      active = false;
    };
  }, [
    simulationMode,
    primarySymbol,
    secondarySymbol,
    primaryStrategy,
    secondaryStrategy,
  ]);

  const primaryAnnualizedReturnPct = React.useMemo(
    () => computeAnnualizedReturnPct(primaryResult, lookbackMonths),
    [primaryResult, lookbackMonths],
  );

  const secondaryAnnualizedReturnPct = React.useMemo(
    () => computeAnnualizedReturnPct(secondaryResult, lookbackMonths),
    [secondaryResult, lookbackMonths],
  );

  const primaryMaxDrawdownPct = React.useMemo(
    () => computeMaxDrawdownPct(primaryRows, lookbackMonths),
    [primaryRows, lookbackMonths],
  );

  const secondaryMaxDrawdownPct = React.useMemo(
    () => computeMaxDrawdownPct(secondaryRows, lookbackMonths),
    [secondaryRows, lookbackMonths],
  );

  const primaryMonthlyWinRatePct = React.useMemo(
    () => computeMonthlyWinRatePct(primaryRows, lookbackMonths),
    [primaryRows, lookbackMonths],
  );

  const secondaryMonthlyWinRatePct = React.useMemo(
    () => computeMonthlyWinRatePct(secondaryRows, lookbackMonths),
    [secondaryRows, lookbackMonths],
  );

  const performanceDiffPct = React.useMemo(() => {
    if (!primaryResult || !secondaryResult || !numericAmount) return null;
    return (
      ((primaryResult.currentValue - secondaryResult.currentValue) /
        numericAmount) *
      100
    );
  }, [primaryResult, secondaryResult, numericAmount]);

  const primaryVolatilityPct = React.useMemo(
    () => computeVolatilityPct(primaryRows, lookbackMonths),
    [primaryRows, lookbackMonths],
  );

  const secondaryVolatilityPct = React.useMemo(
    () => computeVolatilityPct(secondaryRows, lookbackMonths),
    [secondaryRows, lookbackMonths],
  );

  const primaryAvgDailyReturnPct = React.useMemo(
    () => computeAverageDailyReturnPct(primaryRows, lookbackMonths),
    [primaryRows, lookbackMonths],
  );

  const secondaryAvgDailyReturnPct = React.useMemo(
    () => computeAverageDailyReturnPct(secondaryRows, lookbackMonths),
    [secondaryRows, lookbackMonths],
  );

  const avgMarketReturnPct = React.useMemo(() => {
    const values = [
      primaryAvgDailyReturnPct,
      secondaryAvgDailyReturnPct,
    ].filter((value) => value !== null);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [primaryAvgDailyReturnPct, secondaryAvgDailyReturnPct]);

  const marketCondition = React.useMemo(
    () => marketConditionFromAvg(avgMarketReturnPct),
    [avgMarketReturnPct],
  );

  const fallbackStrategyInsight = React.useMemo(() => {
    if (simulationMode === 'portfolio_rebalance') {
      if (!primaryResult || !secondaryResult) {
        return 'Run both stocks to evaluate portfolio rebalancing impact.';
      }
      const diff = primaryResult.currentValue - secondaryResult.currentValue;
      if (marketCondition.tag === 'Bearish Phase') {
        return diff >= 0
          ? 'Rebalancing improved downside handling in the bearish window by harvesting dispersion across both stocks.'
          : 'Buy-and-hold performed better despite a bearish tape, suggesting trend persistence over mean-reversion.';
      }
      return diff >= 0
        ? 'Rebalancing added value by systematically locking gains and re-allocating to laggards.'
        : 'Buy-and-hold captured stronger trend continuation than monthly rebalance in this sample.';
    }

    return buildStrategyInsight({
      marketConditionTag: marketCondition.tag,
      primaryResult,
      secondaryResult,
      primaryStrategy,
      secondaryStrategy,
    });
  }, [
    simulationMode,
    marketCondition.tag,
    primaryResult,
    secondaryResult,
    primaryStrategy,
    secondaryStrategy,
  ]);

  const avgVolatilityPct = React.useMemo(() => {
    const values = [primaryVolatilityPct, secondaryVolatilityPct].filter(
      (value) => value !== null,
    );
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [primaryVolatilityPct, secondaryVolatilityPct]);

  const fallbackRecommendation = React.useMemo(() => {
    if (simulationMode === 'portfolio_rebalance') {
      if (!primaryResult || !secondaryResult) {
        return {
          strategy: 'Awaiting Data',
          reason:
            'Need both stock histories to evaluate portfolio rebalancing.',
        };
      }
      const rebalanceBetter =
        primaryResult.currentValue >= secondaryResult.currentValue;
      return {
        strategy: rebalanceBetter ? '50-50 Rebalancing' : '50-50 Buy & Hold',
        reason: rebalanceBetter
          ? 'Periodic rebalancing improved risk-adjusted consistency in this lookback.'
          : 'Trend persistence favored static allocation over monthly rebalancing for this window.',
      };
    }

    return buildRecommendation({
      marketConditionTag: marketCondition.tag,
      avgVolatilityPct,
      primaryResult,
      secondaryResult,
      primaryStrategy,
      secondaryStrategy,
    });
  }, [
    simulationMode,
    marketCondition.tag,
    avgVolatilityPct,
    primaryResult,
    secondaryResult,
    primaryStrategy,
    secondaryStrategy,
  ]);

  const displayedMarketCondition = React.useMemo(
    () =>
      mlRecommendation?.market_condition
        ? marketConditionFromTag(mlRecommendation.market_condition)
        : marketCondition,
    [mlRecommendation, marketCondition],
  );

  const strategyInsight = React.useMemo(
    () => mlRecommendation?.strategy_insight || fallbackStrategyInsight,
    [mlRecommendation, fallbackStrategyInsight],
  );

  const recommendation = React.useMemo(() => {
    if (mlRecommendation?.recommended_strategy) {
      return {
        strategy: mlRecommendation.recommended_strategy,
        reason: mlRecommendation.recommendation_reason,
      };
    }
    return fallbackRecommendation;
  }, [mlRecommendation, fallbackRecommendation]);

  const confidenceLabel = mlRecommendation?.confidence_label || 'Local';
  const topDrivers = Array.isArray(mlRecommendation?.top_drivers)
    ? mlRecommendation.top_drivers
    : [];
  const topDriverNarratives = React.useMemo(
    () => topDrivers.map((driver) => explainDriver(driver)),
    [topDrivers],
  );

  const rebalancedPortfolioSeries = React.useMemo(
    () =>
      buildPortfolioValueSeries(
        primaryRows,
        secondaryRows,
        numericAmount,
        lookbackMonths,
        true,
      ),
    [primaryRows, secondaryRows, numericAmount, lookbackMonths],
  );

  const staticPortfolioSeries = React.useMemo(
    () =>
      buildPortfolioValueSeries(
        primaryRows,
        secondaryRows,
        numericAmount,
        lookbackMonths,
        false,
      ),
    [primaryRows, secondaryRows, numericAmount, lookbackMonths],
  );

  const rebalancedPortfolioVolatilityPct = React.useMemo(
    () => calculateSeriesVolatilityPct(rebalancedPortfolioSeries),
    [rebalancedPortfolioSeries],
  );

  const staticPortfolioVolatilityPct = React.useMemo(
    () => calculateSeriesVolatilityPct(staticPortfolioSeries),
    [staticPortfolioSeries],
  );

  const rebalancedPortfolioDrawdownPct = React.useMemo(
    () => calculateSeriesMaxDrawdownPct(rebalancedPortfolioSeries),
    [rebalancedPortfolioSeries],
  );

  const staticPortfolioDrawdownPct = React.useMemo(
    () => calculateSeriesMaxDrawdownPct(staticPortfolioSeries),
    [staticPortfolioSeries],
  );

  const portfolioTrajectorySeries = React.useMemo(() => {
    if (simulationMode !== 'portfolio_rebalance') return [];

    const rebalancedData = rebalancedPortfolioSeries.map((value, idx) => ({
      x: idx,
      y: Number(value.toFixed(2)),
    }));
    const staticData = staticPortfolioSeries.map((value, idx) => ({
      x: idx,
      y: Number(value.toFixed(2)),
    }));

    return [
      { name: 'Rebalanced', data: rebalancedData },
      { name: 'Static', data: staticData },
    ];
  }, [simulationMode, rebalancedPortfolioSeries, staticPortfolioSeries]);

  const portfolioTrajectoryOptions = React.useMemo(
    () => ({
      chart: {
        type: 'line',
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      stroke: {
        curve: 'smooth',
        width: 3,
      },
      xaxis: {
        title: { text: 'Months' },
      },
      yaxis: {
        title: { text: 'Portfolio Value (INR)' },
        labels: {
          formatter: (value) => `${Math.round(value)}`,
        },
      },
      grid: {
        borderColor: '#E2E8F0',
        strokeDashArray: 4,
      },
      colors: ['#3182CE', '#DD6B20'],
      legend: {
        position: 'top',
      },
    }),
    [],
  );

  const riskReturnSeries = React.useMemo(() => {
    const points = [];
    if (primaryResult && primaryVolatilityPct !== null) {
      points.push({
        x: Number(primaryVolatilityPct),
        y: Number(primaryResult.pnlPct),
        name:
          simulationMode === 'portfolio_rebalance'
            ? '50-50 Rebalancing Portfolio'
            : `${primarySymbol} • ${STRATEGY_LABELS[primaryStrategy] || primaryStrategy}`,
      });
    }
    if (secondaryResult && secondaryVolatilityPct !== null) {
      points.push({
        x: Number(secondaryVolatilityPct),
        y: Number(secondaryResult.pnlPct),
        name:
          simulationMode === 'portfolio_rebalance'
            ? '50-50 Static Buy & Hold'
            : `${secondarySymbol} • ${STRATEGY_LABELS[secondaryStrategy] || secondaryStrategy}`,
      });
    }

    if (points.length === 2) {
      const sameX = Math.abs(points[0].x - points[1].x) < 0.01;
      const sameY = Math.abs(points[0].y - points[1].y) < 0.01;
      if (sameX && sameY) {
        points[0].x -= 0.03;
        points[1].x += 0.03;
      }
    }

    return points.map((point) => ({ name: point.name, data: [point] }));
  }, [
    primaryResult,
    secondaryResult,
    primaryVolatilityPct,
    secondaryVolatilityPct,
    primarySymbol,
    secondarySymbol,
    simulationMode,
    primaryStrategy,
    secondaryStrategy,
  ]);

  const riskReturnBounds = React.useMemo(() => {
    const allPoints = riskReturnSeries.flatMap((series) => series.data || []);
    if (!allPoints.length) return null;

    const xs = allPoints.map((point) => point.x);
    const ys = allPoints.map((point) => point.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const xPad = Math.max(0.1, (maxX - minX) * 0.4);
    const yPad = Math.max(0.4, (maxY - minY) * 0.35);

    return {
      minX: Number((minX - xPad).toFixed(2)),
      maxX: Number((maxX + xPad).toFixed(2)),
      minY: Number((minY - yPad).toFixed(2)),
      maxY: Number((maxY + yPad).toFixed(2)),
    };
  }, [riskReturnSeries]);

  const riskReturnSummary = React.useMemo(() => {
    const rows = riskReturnSeries.map((series) => {
      const point = series.data?.[0];
      if (!point) return null;
      const score = point.x ? point.y / point.x : point.y;
      return {
        name: series.name,
        risk: point.x,
        returnPct: point.y,
        score,
      };
    });

    return rows
      .filter(Boolean)
      .sort((left, right) => Number(right.score) - Number(left.score));
  }, [riskReturnSeries]);

  const riskReturnOptions = React.useMemo(
    () => ({
      chart: {
        type: 'scatter',
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      grid: {
        borderColor: '#E2E8F0',
        strokeDashArray: 5,
      },
      xaxis: {
        min: riskReturnBounds?.minX,
        max: riskReturnBounds?.maxX,
        tickAmount: 6,
        decimalsInFloat: 2,
        labels: {
          formatter: (value) => `${Number(value).toFixed(2)}%`,
        },
        title: {
          text: 'Risk (Daily Volatility %)',
        },
      },
      yaxis: {
        min: riskReturnBounds?.minY,
        max: riskReturnBounds?.maxY,
        tickAmount: 6,
        decimalsInFloat: 2,
        labels: {
          formatter: (value) => `${Number(value).toFixed(2)}%`,
        },
        title: {
          text: 'Return (P&L %)',
        },
      },
      markers: {
        size: 11,
      },
      dataLabels: {
        enabled: true,
        formatter: (_, opts) => {
          const label = opts.w.config.series?.[opts.seriesIndex]?.name || '';
          return label.length > 22 ? `${label.slice(0, 22)}...` : label;
        },
        offsetY: -14,
        style: {
          fontSize: '10px',
        },
      },
      legend: {
        show: true,
        position: 'top',
      },
      colors: ['#3182CE', '#DD6B20', '#2F855A', '#D53F8C'],
      tooltip: {
        custom: ({ dataPointIndex, w }) => {
          const seriesIndex = w.globals?.seriesIndex ?? 0;
          const point =
            w.config.series?.[seriesIndex]?.data?.[dataPointIndex] || null;
          const name = w.config.series?.[seriesIndex]?.name || 'Strategy';
          if (!point) return '';
          return `<div style=\"padding:8px 10px;font-size:12px;\"><strong>${name}</strong><br/>Risk: ${Number(point.x).toFixed(2)}%<br/>Return: ${Number(point.y).toFixed(2)}%</div>`;
        },
      },
    }),
    [riskReturnBounds],
  );

  const betterResultLabel = React.useMemo(() => {
    if (!primaryResult || !secondaryResult) return '';
    const diff = primaryResult.currentValue - secondaryResult.currentValue;
    if (simulationMode === 'portfolio_rebalance') {
      if (Math.abs(diff) < 1)
        return 'Rebalanced and static portfolio outcomes are nearly identical.';
      if (diff > 0) {
        return `50-50 Rebalancing leads static allocation by ${inrFormatter.format(diff)}.`;
      }
      return `50-50 Buy & Hold leads rebalancing by ${inrFormatter.format(Math.abs(diff))}.`;
    }
    if (Math.abs(diff) < 1) return 'Both outcomes are nearly identical.';
    if (diff > 0) {
      return `${primarySymbol} (${STRATEGY_LABELS[primaryStrategy] || primaryStrategy}) leads by ${inrFormatter.format(diff)}.`;
    }
    return `${secondarySymbol} (${STRATEGY_LABELS[secondaryStrategy] || secondaryStrategy}) leads by ${inrFormatter.format(Math.abs(diff))}.`;
  }, [
    primaryResult,
    secondaryResult,
    primarySymbol,
    secondarySymbol,
    simulationMode,
    primaryStrategy,
    secondaryStrategy,
  ]);

  return (
    <Box pt={{ base: '64px', md: '76px' }}>
      <Card
        p={{ base: '20px', md: '24px' }}
        mb="24px"
        bgGradient="linear(135deg, #ffffff 0%, #eef4ff 70%, #e7f6ff 100%)"
        border="1px solid"
        borderColor="blackAlpha.100"
        boxShadow="0 16px 40px rgba(30, 64, 175, 0.08)"
        overflow="hidden"
      >
        <Flex
          justify="space-between"
          align={{ base: 'flex-start', md: 'center' }}
          direction={{ base: 'column', md: 'row' }}
          gap="12px"
          position="relative"
          zIndex="1"
        >
          <Box>
            <Text fontSize="sm" color={mutedColor}>
              Simulate how your investment could have performed with stock and
              strategy comparisons.
            </Text>
          </Box>
          <Badge colorScheme="blue" borderRadius="full" px="10px" py="5px">
            Interactive Backtest
          </Badge>
        </Flex>
        <Box
          position="absolute"
          width="180px"
          height="180px"
          borderRadius="999px"
          bg="blue.100"
          right="-50px"
          top="-60px"
          opacity="0.7"
        />
      </Card>

      <Card p="20px" mb="20px">
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="16px">
          <FormControl>
            <FormLabel>Simulation Mode</FormLabel>
            <Select
              value={simulationMode}
              onChange={(event) => setSimulationMode(event.target.value)}
            >
              {SIMULATION_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel>Investment Amount (INR)</FormLabel>
            <Input
              type="number"
              value={amount}
              min="1"
              step="500"
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Lookback Window</FormLabel>
            <Select
              value={String(lookbackMonths)}
              onChange={(event) =>
                setLookbackMonths(Number(event.target.value))
              }
            >
              {LOOKBACK_OPTIONS.map((option) => (
                <option key={option.months} value={option.months}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormControl>
        </SimpleGrid>

        <Grid
          templateColumns={{ base: '1fr', xl: 'repeat(2, 1fr)' }}
          gap="16px"
          mt="16px"
        >
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="12px">
            <FormControl>
              <FormLabel>Primary Stock</FormLabel>
              <Select
                value={primarySymbol}
                onChange={(event) => setPrimarySymbol(event.target.value)}
              >
                {companies.map((company) => (
                  <option key={company.symbol} value={company.symbol}>
                    {company.symbol} - {company.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            {simulationMode === 'independent' ? (
              <FormControl>
                <FormLabel>Strategy</FormLabel>
                <Select
                  value={primaryStrategy}
                  onChange={(event) => setPrimaryStrategy(event.target.value)}
                >
                  {STRATEGY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Box p="10px" borderRadius="10px" bg="blackAlpha.50">
                <Text fontSize="xs" color={mutedColor}>
                  Portfolio mode uses both selected stocks in one 50-50
                  portfolio.
                </Text>
              </Box>
            )}
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap="12px">
            <FormControl>
              <FormLabel>Comparison Stock</FormLabel>
              <Select
                value={secondarySymbol}
                onChange={(event) => setSecondarySymbol(event.target.value)}
              >
                {companies.map((company) => (
                  <option key={company.symbol} value={company.symbol}>
                    {company.symbol} - {company.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            {simulationMode === 'independent' ? (
              <FormControl>
                <FormLabel>Strategy</FormLabel>
                <Select
                  value={secondaryStrategy}
                  onChange={(event) => setSecondaryStrategy(event.target.value)}
                >
                  {STRATEGY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Box p="10px" borderRadius="10px" bg="blackAlpha.50">
                <Text fontSize="xs" color={mutedColor}>
                  Comparison baseline is static 50-50 buy and hold allocation.
                </Text>
              </Box>
            )}
          </SimpleGrid>
        </Grid>

        {error ? (
          <Text mt="14px" color="red.400" fontSize="sm">
            {error}
          </Text>
        ) : null}
      </Card>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px">
        <Skeleton isLoaded={!loading} borderRadius="20px">
          <SimulationCard
            title={
              simulationMode === 'portfolio_rebalance'
                ? `${primarySymbol || 'Primary'} + ${secondarySymbol || 'Comparison'} • 50-50 Rebalancing`
                : `${primarySymbol || 'Primary'} • ${STRATEGY_LABELS[primaryStrategy] || primaryStrategy}`
            }
            subtitle={`If you invested ${inrFormatter.format(numericAmount || 0)} over the selected window.`}
            result={primaryResult}
            annualizedReturnPct={primaryAnnualizedReturnPct}
            maxDrawdownPct={primaryMaxDrawdownPct}
            monthlyWinRatePct={primaryMonthlyWinRatePct}
          />
        </Skeleton>

        <Skeleton isLoaded={!loading} borderRadius="20px">
          <SimulationCard
            title={
              simulationMode === 'portfolio_rebalance'
                ? `${primarySymbol || 'Primary'} + ${secondarySymbol || 'Comparison'} • 50-50 Buy & Hold`
                : `${secondarySymbol || 'Comparison'} • ${STRATEGY_LABELS[secondaryStrategy] || secondaryStrategy}`
            }
            subtitle={`Side-by-side scenario for smarter allocation decisions.`}
            result={secondaryResult}
            annualizedReturnPct={secondaryAnnualizedReturnPct}
            maxDrawdownPct={secondaryMaxDrawdownPct}
            monthlyWinRatePct={secondaryMonthlyWinRatePct}
          />
        </Skeleton>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 3 }} gap="20px" mt="20px">
        <Card p="20px">
          <Text fontSize="sm" fontWeight="700" color="teal.500" mb="6px">
            Delta vs Comparison
          </Text>
          <Text fontSize="2xl" fontWeight="800" color="secondaryGray.900">
            {performanceDiffPct === null
              ? '--'
              : `${performanceDiffPct >= 0 ? '+' : ''}${pctFormatter.format(performanceDiffPct)}%`}
          </Text>
          <Text fontSize="sm" color={mutedColor} mt="6px">
            Relative outcome difference against the selected comparison setup.
          </Text>
        </Card>

        <Card p="20px">
          <Text fontSize="sm" fontWeight="700" color="orange.500" mb="6px">
            Risk Snapshot
          </Text>
          <Text fontSize="2xl" fontWeight="800" color="secondaryGray.900">
            {primaryMaxDrawdownPct === null && secondaryMaxDrawdownPct === null
              ? '--'
              : `${pctFormatter.format(Math.min(primaryMaxDrawdownPct ?? 0, secondaryMaxDrawdownPct ?? 0))}%`}
          </Text>
          <Text fontSize="sm" color={mutedColor} mt="6px">
            Worst peak-to-trough drawdown observed across both selected stocks.
          </Text>
        </Card>

        <Card p="20px">
          <Text fontSize="sm" fontWeight="700" color="purple.500" mb="6px">
            Consistency Score
          </Text>
          <Text fontSize="2xl" fontWeight="800" color="secondaryGray.900">
            {primaryMonthlyWinRatePct === null &&
            secondaryMonthlyWinRatePct === null
              ? '--'
              : `${pctFormatter.format(Math.max(primaryMonthlyWinRatePct ?? 0, secondaryMonthlyWinRatePct ?? 0))}%`}
          </Text>
          <Text fontSize="sm" color={mutedColor} mt="6px">
            Best positive-month hit rate among the compared scenarios.
          </Text>
        </Card>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="20px" mt="20px">
        <Card p="20px">
          <HStack spacing="10px" mb="8px" align="center">
            <Text fontSize="lg" fontWeight="700" color="secondaryGray.900">
              Market Condition
            </Text>
            <Badge
              colorScheme={displayedMarketCondition.colorScheme}
              borderRadius="full"
              px="10px"
              py="4px"
            >
              {displayedMarketCondition.tag}
            </Badge>
          </HStack>
          <Text fontSize="sm" color={mutedColor}>
            Strategy Insight: {strategyInsight}
          </Text>
        </Card>

        <Card p="20px">
          <Text fontSize="lg" fontWeight="700" color="secondaryGray.900">
            Strategy Intelligence Insight
          </Text>
          <Text mt="8px" fontSize="sm" color={mutedColor}>
            {strategyInsight}
          </Text>
          <Text mt="8px" fontSize="xs" color={mutedColor}>
            Context signal: Avg daily market return{' '}
            {avgMarketReturnPct === null
              ? '--'
              : `${pctFormatter.format(avgMarketReturnPct)}%`}{' '}
            | Avg volatility{' '}
            {avgVolatilityPct === null
              ? '--'
              : `${pctFormatter.format(avgVolatilityPct)}%`}
            .
          </Text>
          {mlRecommendation?.model ? (
            <Text mt="8px" fontSize="xs" color={mutedColor}>
              Model: {mlRecommendation.model} | Confidence:{' '}
              {pctFormatter.format(mlRecommendation.confidence_pct || 0)}% (
              {confidenceLabel})
            </Text>
          ) : null}
          {topDrivers.length ? (
            <HStack spacing="8px" mt="8px" wrap="wrap">
              {topDrivers.map((driver) => (
                <Badge
                  key={driver.feature}
                  colorScheme={
                    driver.direction === 'defensive' ? 'blue' : 'orange'
                  }
                  borderRadius="full"
                  px="8px"
                  py="3px"
                >
                  {driver.feature}: {driver.contribution > 0 ? '+' : ''}
                  {driver.contribution}
                </Badge>
              ))}
            </HStack>
          ) : null}
          {topDriverNarratives.length ? (
            <Stack spacing="4px" mt="8px">
              {topDriverNarratives.map((line) => (
                <Text key={line} fontSize="xs" color={mutedColor}>
                  • {line}
                </Text>
              ))}
            </Stack>
          ) : null}
          {mlError ? (
            <Text mt="8px" fontSize="xs" color="orange.400">
              {mlError}
            </Text>
          ) : null}
        </Card>
      </SimpleGrid>

      {simulationMode === 'portfolio_rebalance' ? (
        <Card p="20px" mt="20px">
          <Text
            fontSize="lg"
            fontWeight="700"
            color="secondaryGray.900"
            mb="4px"
          >
            Portfolio Risk Decomposition
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="14px">
            <Box p="12px" borderRadius="12px" bg="blackAlpha.50">
              <Text fontSize="sm" fontWeight="700" color="blue.500">
                50-50 Rebalancing
              </Text>
              <Text fontSize="xs" color={mutedColor} mt="4px">
                Volatility:{' '}
                {rebalancedPortfolioVolatilityPct === null
                  ? '--'
                  : `${pctFormatter.format(rebalancedPortfolioVolatilityPct)}%`}
              </Text>
              <Text fontSize="xs" color={mutedColor} mt="2px">
                Max Drawdown:{' '}
                {rebalancedPortfolioDrawdownPct === null
                  ? '--'
                  : `${pctFormatter.format(rebalancedPortfolioDrawdownPct)}%`}
              </Text>
            </Box>
            <Box p="12px" borderRadius="12px" bg="blackAlpha.50">
              <Text fontSize="sm" fontWeight="700" color="orange.500">
                50-50 Buy & Hold
              </Text>
              <Text fontSize="xs" color={mutedColor} mt="4px">
                Volatility:{' '}
                {staticPortfolioVolatilityPct === null
                  ? '--'
                  : `${pctFormatter.format(staticPortfolioVolatilityPct)}%`}
              </Text>
              <Text fontSize="xs" color={mutedColor} mt="2px">
                Max Drawdown:{' '}
                {staticPortfolioDrawdownPct === null
                  ? '--'
                  : `${pctFormatter.format(staticPortfolioDrawdownPct)}%`}
              </Text>
            </Box>
          </SimpleGrid>
          {portfolioTrajectorySeries.length ? (
            <Box mt="14px" h={{ base: '220px', md: '250px' }}>
              <ReactApexChart
                options={portfolioTrajectoryOptions}
                series={portfolioTrajectorySeries}
                type="line"
                width="100%"
                height="100%"
              />
            </Box>
          ) : null}
        </Card>
      ) : null}

      <Card p="20px" mt="20px">
        <Text fontSize="lg" fontWeight="700" color="secondaryGray.900" mb="4px">
          Risk vs Return Map
        </Text>
        <Text fontSize="sm" color={mutedColor} mb="10px">
          Each dot is one strategy setup. Lower risk and higher return is
          better; use the summary below for quick ranking.
        </Text>
        {riskReturnSeries.length ? (
          <Box h={{ base: '280px', md: '320px' }}>
            <ReactApexChart
              options={riskReturnOptions}
              series={riskReturnSeries}
              type="scatter"
              width="100%"
              height="100%"
            />
          </Box>
        ) : (
          <Text fontSize="sm" color={mutedColor}>
            Need valid strategy outcomes to plot risk vs return.
          </Text>
        )}
        {riskReturnSummary.length ? (
          <Stack spacing="6px" mt="12px">
            {riskReturnSummary.map((row, idx) => (
              <HStack
                key={`${row.name}-${idx}`}
                justify="space-between"
                p="8px"
                borderRadius="10px"
                bg="blackAlpha.50"
              >
                <Text fontSize="xs" color="secondaryGray.900" fontWeight="700">
                  #{idx + 1} {row.name}
                </Text>
                <Text fontSize="xs" color={mutedColor}>
                  Risk {pctFormatter.format(row.risk)}% | Return{' '}
                  {pctFormatter.format(row.returnPct)}%
                </Text>
              </HStack>
            ))}
          </Stack>
        ) : null}
      </Card>

      <Card p="20px" mt="20px">
        <Text fontSize="lg" fontWeight="700" color="secondaryGray.900">
          Strategy Verdict
        </Text>
        <Text mt="8px" color={mutedColor}>
          {betterResultLabel ||
            'Pick symbols and strategies to compare outcomes.'}
        </Text>
        <Box
          mt="14px"
          borderTop="1px solid"
          borderColor="blackAlpha.100"
          pt="12px"
        >
          <Text fontSize="md" fontWeight="700" color="green.500">
            Recommended Strategy: {recommendation.strategy}
          </Text>
          <Text fontSize="sm" color={mutedColor} mt="4px">
            Reason: {recommendation.reason}
          </Text>
          {Array.isArray(mlRecommendation?.strategy_ranking) &&
          mlRecommendation.strategy_ranking.length ? (
            <Stack spacing="5px" mt="10px">
              <Text fontSize="xs" color={mutedColor}>
                Hybrid ranking:
              </Text>
              {mlRecommendation.strategy_ranking.slice(0, 3).map((row) => (
                <Text key={row.strategy} fontSize="xs" color={mutedColor}>
                  {row.label}: score {pctFormatter.format(row.score)} | return{' '}
                  {pctFormatter.format(row.result?.pnl_pct || 0)}%
                </Text>
              ))}
            </Stack>
          ) : null}
          <Text fontSize="xs" color={mutedColor} mt="6px">
            {mlLoading
              ? 'Refreshing ML recommendation...'
              : mlRecommendation
                ? 'Using backend custom model recommendation.'
                : 'Using local fallback recommendation engine.'}
          </Text>
        </Box>
      </Card>

      {simulationMode === 'independent' ? (
        <Card p="20px" mt="20px">
          <Text
            fontSize="lg"
            fontWeight="700"
            color="secondaryGray.900"
            mb="6px"
          >
            Recent Recommendation History
          </Text>
          {historyLoading ? (
            <Text fontSize="sm" color={mutedColor}>
              Loading history...
            </Text>
          ) : recommendationHistory.length ? (
            <Box
              maxH={{ base: '260px', md: '320px' }}
              overflowY="auto"
              pr="4px"
            >
              <Stack spacing="8px">
                {recommendationHistory.map((row) => (
                  <Box
                    key={`${row.timestamp}-${row.primary_symbol}-${row.secondary_symbol}`}
                    p="10px"
                    borderRadius="10px"
                    bg="blackAlpha.50"
                  >
                    <Text fontSize="xs" color={mutedColor}>
                      {row.timestamp} | {row.primary_symbol} vs{' '}
                      {row.secondary_symbol}
                    </Text>
                    <Text
                      fontSize="sm"
                      fontWeight="700"
                      color="secondaryGray.900"
                    >
                      {row.recommended_strategy} ({row.confidence_label})
                    </Text>
                    <Text fontSize="xs" color={mutedColor}>
                      Market: {row.market_condition} | Confidence:{' '}
                      {pctFormatter.format(row.confidence_pct || 0)}%
                    </Text>
                  </Box>
                ))}
              </Stack>
            </Box>
          ) : (
            <Text fontSize="sm" color={mutedColor}>
              No history yet for this filter context.
            </Text>
          )}
        </Card>
      ) : null}
    </Box>
  );
}

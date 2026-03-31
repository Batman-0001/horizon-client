import {
  fetchCompanies,
  fetchMarketHighlights,
  fetchMlForecast,
  fetchStockData,
  fetchStockSummary,
  getCachedCompanies,
  getCachedMarketHighlights,
  getCachedMlForecast,
  getCachedStockData,
  getCachedStockSummary,
} from 'api/stockApi';
import { useEffect, useMemo, useState } from 'react';
import {
  computeClientMetrics,
  createCompareChartConfig,
  createForecastSeries,
  createPriceChartOptions,
  movingAverage,
  normalizeCompanies,
  normalizePriceRows,
  normalizeTopMovers,
  readDashboardPrefs,
  safeNumber,
  saveDashboardPrefs,
} from '../utils';

export default function useStockDashboardData() {
  const initialPrefs = readDashboardPrefs();
  const initialSymbol = initialPrefs.symbol;
  const initialCompareSymbol = initialPrefs.compareSymbol;
  const initialDays = initialPrefs.days;
  const initialForecastHorizon = initialPrefs.forecastHorizon;
  const initialPrices = initialSymbol
    ? normalizePriceRows(getCachedStockData(initialSymbol, Number(initialDays)))
    : [];
  const initialComparePrices = initialCompareSymbol
    ? normalizePriceRows(
        getCachedStockData(initialCompareSymbol, Number(initialDays)),
      )
    : [];
  const initialSummary = initialSymbol
    ? getCachedStockSummary(initialSymbol)
    : null;
  const initialForecast = initialSymbol
    ? getCachedMlForecast(initialSymbol, Number(initialForecastHorizon))
    : null;

  const [companies, setCompanies] = useState(() =>
    normalizeCompanies(getCachedCompanies()),
  );
  const [symbol, setSymbol] = useState(initialSymbol);
  const [compareSymbol, setCompareSymbol] = useState(initialCompareSymbol);
  const [days, setDays] = useState(initialDays);
  const [forecastHorizon, setForecastHorizon] = useState(
    initialForecastHorizon,
  );
  const [prices, setPrices] = useState(initialPrices);
  const [comparePrices, setComparePrices] = useState(initialComparePrices);
  const [summary, setSummary] = useState(initialSummary);
  const [topMovers, setTopMovers] = useState(() =>
    normalizeTopMovers(getCachedMarketHighlights()),
  );
  const [forecast, setForecast] = useState(initialForecast);
  const [loading, setLoading] = useState(initialPrices.length === 0);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    saveDashboardPrefs({ symbol, compareSymbol, days, forecastHorizon });
  }, [symbol, compareSymbol, days, forecastHorizon]);

  useEffect(() => {
    if (!companies.length) return;
    const symbols = new Set(companies.map((company) => company.symbol));

    if (!symbol || !symbols.has(symbol)) {
      setSymbol(companies[0].symbol);
      return;
    }

    if (
      !compareSymbol ||
      compareSymbol === symbol ||
      !symbols.has(compareSymbol)
    ) {
      const fallback = companies.find((company) => company.symbol !== symbol);
      setCompareSymbol(fallback ? fallback.symbol : '');
    }
  }, [companies, symbol, compareSymbol]);

  useEffect(() => {
    let active = true;

    const loadCompanies = async () => {
      try {
        const companiesPayload = await fetchCompanies();
        if (!active) return;
        setCompanies(normalizeCompanies(companiesPayload));
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    };

    loadCompanies();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!symbol) return;
    let active = true;

    const loadStockData = async () => {
      const cachedPrices = normalizePriceRows(
        getCachedStockData(symbol, Number(days)),
      );
      const cachedSummary = getCachedStockSummary(symbol);

      if (cachedPrices.length) setPrices(cachedPrices);
      if (cachedSummary) setSummary(cachedSummary);

      setLoading(cachedPrices.length === 0);
      setError('');

      const summaryPromise = fetchStockSummary(symbol)
        .then((summaryPayload) => {
          if (!active) return;
          setSummary(summaryPayload);
        })
        .catch((loadError) => {
          if (active) setError((prev) => prev || loadError.message);
        });

      try {
        const pricePayload = await fetchStockData(symbol, Number(days));
        if (!active) return;
        setPrices(normalizePriceRows(pricePayload));
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
          setPrices([]);
          setSummary(null);
        }
      } finally {
        if (active) setLoading(false);
      }

      await summaryPromise;
    };

    loadStockData();
    return () => {
      active = false;
    };
  }, [symbol, days]);

  useEffect(() => {
    if (!compareSymbol || compareSymbol === symbol) {
      setComparePrices([]);
      return;
    }

    let active = true;
    const loadCompare = async () => {
      const cachedCompareRows = normalizePriceRows(
        getCachedStockData(compareSymbol, Number(days)),
      );
      if (cachedCompareRows.length) setComparePrices(cachedCompareRows);

      try {
        const payload = await fetchStockData(compareSymbol, Number(days));
        if (!active) return;
        setComparePrices(normalizePriceRows(payload));
      } catch (loadError) {
        if (active) {
          setComparePrices([]);
          setError(loadError.message);
        }
      }
    };

    loadCompare();
    return () => {
      active = false;
    };
  }, [compareSymbol, symbol, days]);

  useEffect(() => {
    let active = true;

    const loadMovers = async () => {
      try {
        const payload = await fetchMarketHighlights();
        if (!active) return;
        setTopMovers(normalizeTopMovers(payload));
      } catch {
        if (active) setTopMovers([]);
      }
    };

    loadMovers();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!symbol) {
      setForecast(null);
      return;
    }

    let active = true;
    const loadForecast = async () => {
      const cachedForecast = getCachedMlForecast(
        symbol,
        Number(forecastHorizon),
      );
      if (cachedForecast) setForecast(cachedForecast);

      setForecastLoading(!cachedForecast);
      try {
        const payload = await fetchMlForecast(symbol, Number(forecastHorizon));
        if (!active) return;
        setForecast(payload);
      } catch {
        if (active) setForecast(null);
      } finally {
        if (active) setForecastLoading(false);
      }
    };

    loadForecast();
    return () => {
      active = false;
    };
  }, [symbol, forecastHorizon]);

  const closeSeries = useMemo(() => prices.map((row) => row.close), [prices]);
  const ma7Series = useMemo(() => movingAverage(closeSeries, 7), [closeSeries]);
  const clientMetrics = useMemo(() => computeClientMetrics(prices), [prices]);

  const priceChartOptions = useMemo(
    () => createPriceChartOptions(prices),
    [prices],
  );

  const priceSeries = useMemo(
    () => [
      { name: `${symbol} Close`, data: closeSeries },
      { name: '7D Moving Avg', data: ma7Series },
    ],
    [symbol, closeSeries, ma7Series],
  );

  const compareChartConfig = useMemo(
    () =>
      createCompareChartConfig(prices, comparePrices, symbol, compareSymbol),
    [prices, comparePrices, symbol, compareSymbol],
  );

  const latestClose = prices[prices.length - 1]?.close ?? null;
  const avgClose = safeNumber(
    summary?.average_close ?? summary?.avg_close ?? null,
  );
  const high52 = safeNumber(summary?.high_52_week ?? summary?.high_52w ?? null);
  const low52 = safeNumber(summary?.low_52_week ?? summary?.low_52w ?? null);

  const forecastSeries = useMemo(
    () => createForecastSeries(forecast, prices),
    [forecast, prices],
  );

  return {
    companies,
    symbol,
    setSymbol,
    compareSymbol,
    setCompareSymbol,
    days,
    setDays,
    forecastHorizon,
    setForecastHorizon,
    topMovers,
    loading,
    forecastLoading,
    error,
    priceChartOptions,
    priceSeries,
    latestClose,
    avgClose,
    high52,
    low52,
    clientMetrics,
    compareChartConfig,
    forecast,
    forecastSeries,
  };
}

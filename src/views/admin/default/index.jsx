import { Box, SimpleGrid, useColorModeValue } from '@chakra-ui/react';
import React from 'react';
import CompaniesPanel from './stockDashboard/components/CompaniesPanel';
import ComparisonAndMovers from './stockDashboard/components/ComparisonAndMovers';
import ForecastPanel from './stockDashboard/components/ForecastPanel';
import MetricsGrid from './stockDashboard/components/MetricsGrid';
import PricePanel from './stockDashboard/components/PricePanel';
import useStockDashboardData from './stockDashboard/hooks/useStockDashboardData';
import {
  getDashboardSearchEventName,
  getDashboardSearchStorageKey,
} from 'variables/searchIdentifiers';

const DASHBOARD_SEARCH_KEY = getDashboardSearchStorageKey();
const DASHBOARD_SEARCH_EVENT = getDashboardSearchEventName();

function readDashboardSearchQuery() {
  if (typeof window === 'undefined' || !window.sessionStorage) return '';

  try {
    return String(window.sessionStorage.getItem(DASHBOARD_SEARCH_KEY) || '');
  } catch {
    return '';
  }
}

export default function StockDashboard() {
  const {
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
  } = useStockDashboardData();
  const [searchQuery, setSearchQuery] = React.useState(() =>
    readDashboardSearchQuery(),
  );

  const textMuted = useColorModeValue('gray.600', 'gray.300');
  const positiveColor = useColorModeValue('green.500', 'green.300');
  const negativeColor = useColorModeValue('red.500', 'red.300');
  const scrollbarTrack = useColorModeValue('gray.100', 'whiteAlpha.200');
  const scrollbarThumb = useColorModeValue('gray.400', 'whiteAlpha.500');

  React.useEffect(() => {
    const handleSearchChange = (event) => {
      setSearchQuery(String(event?.detail || ''));
    };

    const handleStorage = (event) => {
      if (event.key === DASHBOARD_SEARCH_KEY) {
        setSearchQuery(String(event.newValue || ''));
      }
    };

    setSearchQuery(readDashboardSearchQuery());
    window.addEventListener(DASHBOARD_SEARCH_EVENT, handleSearchChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(DASHBOARD_SEARCH_EVENT, handleSearchChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const filteredCompanies = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return companies;

    return companies.filter((company) => {
      const symbolText = String(company?.symbol || '').toLowerCase();
      const nameText = String(company?.name || '').toLowerCase();
      return symbolText.includes(query) || nameText.includes(query);
    });
  }, [companies, searchQuery]);

  return (
    <Box pt={{ base: '120px', md: '80px', xl: '80px' }}>
      <SimpleGrid columns={{ base: 1, xl: 4 }} gap="20px" mb="20px">
        <CompaniesPanel
          companies={filteredCompanies}
          symbol={symbol}
          onSelectSymbol={setSymbol}
          scrollbarTrack={scrollbarTrack}
          scrollbarThumb={scrollbarThumb}
        />

        <PricePanel
          companies={companies}
          symbol={symbol}
          compareSymbol={compareSymbol}
          days={days}
          forecastHorizon={forecastHorizon}
          onChangeDays={setDays}
          onChangeCompareSymbol={setCompareSymbol}
          onChangeForecastHorizon={setForecastHorizon}
          error={error}
          loading={loading}
          priceChartOptions={priceChartOptions}
          priceSeries={priceSeries}
        />
      </SimpleGrid>

      <MetricsGrid
        symbol={symbol}
        latestClose={latestClose}
        high52={high52}
        low52={low52}
        avgClose={avgClose}
        clientMetrics={clientMetrics}
        textMuted={textMuted}
        positiveColor={positiveColor}
        negativeColor={negativeColor}
      />

      <ComparisonAndMovers
        compareChartConfig={compareChartConfig}
        topMovers={topMovers}
        textMuted={textMuted}
        positiveColor={positiveColor}
        negativeColor={negativeColor}
      />

      <ForecastPanel
        forecast={forecast}
        forecastLoading={forecastLoading}
        forecastSeries={forecastSeries}
        textMuted={textMuted}
      />
    </Box>
  );
}

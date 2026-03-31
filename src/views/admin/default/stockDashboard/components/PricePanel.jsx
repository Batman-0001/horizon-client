import {
  Alert,
  AlertIcon,
  Box,
  FormControl,
  FormLabel,
  HStack,
  Select,
  Spinner,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import React from 'react';
import ReactApexChart from 'react-apexcharts';

export default function PricePanel({
  companies,
  symbol,
  compareSymbol,
  days,
  forecastHorizon,
  onChangeDays,
  onChangeCompareSymbol,
  onChangeForecastHorizon,
  error,
  loading,
  priceChartOptions,
  priceSeries,
}) {
  return (
    <Card p="20px" gridColumn={{ base: 'span 1', xl: 'span 3' }}>
      <HStack spacing="12px" flexWrap="wrap" mb="16px">
        <FormControl maxW="180px">
          <FormLabel mb="6px">Window</FormLabel>
          <Select value={days} onChange={(e) => onChangeDays(e.target.value)}>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
          </Select>
        </FormControl>
        <FormControl maxW="220px">
          <FormLabel mb="6px">Compare</FormLabel>
          <Select
            value={compareSymbol}
            onChange={(e) => onChangeCompareSymbol(e.target.value)}
          >
            <option value="">None</option>
            {companies
              .filter((company) => company.symbol !== symbol)
              .map((company) => (
                <option key={company.symbol} value={company.symbol}>
                  {company.symbol}
                </option>
              ))}
          </Select>
        </FormControl>
        <FormControl maxW="220px">
          <FormLabel mb="6px">Forecast Horizon</FormLabel>
          <Select
            value={forecastHorizon}
            onChange={(e) => onChangeForecastHorizon(e.target.value)}
          >
            <option value="7">7 days</option>
            <option value="15">15 days</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
          </Select>
        </FormControl>
      </HStack>

      {error && (
        <Alert status="error" borderRadius="12px" mb="16px">
          <AlertIcon />
          {error}
        </Alert>
      )}

      {loading ? (
        <Box py="40px" textAlign="center">
          <Spinner thickness="3px" speed="0.65s" color="blue.500" size="xl" />
        </Box>
      ) : (
        <Box h="360px">
          <ReactApexChart
            options={priceChartOptions}
            series={priceSeries}
            type="line"
            height="100%"
          />
        </Box>
      )}
    </Card>
  );
}

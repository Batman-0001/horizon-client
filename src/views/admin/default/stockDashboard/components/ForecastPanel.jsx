import {
  Box,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Text,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import React from 'react';
import ReactApexChart from 'react-apexcharts';
import { deriveForecastConfidence, numberFmt } from '../utils';

export default function ForecastPanel({
  forecast,
  forecastLoading,
  forecastSeries,
  textMuted,
}) {
  const confidenceScore = deriveForecastConfidence(forecast);

  return (
    <SimpleGrid columns={{ base: 1 }} gap="20px" mt="20px">
      <Card p="20px">
        <HStack justify="space-between" mb="12px" flexWrap="wrap">
          <Heading size="sm">ML Forecast</Heading>
          {forecast?.model_cache && (
            <Text color={textMuted} fontSize="sm">
              Cache: {forecast.model_cache.hit ? 'hit' : 'miss'}
            </Text>
          )}
        </HStack>

        {forecastLoading ? (
          <Box py="24px" textAlign="center">
            <Spinner thickness="3px" speed="0.65s" color="blue.500" />
          </Box>
        ) : forecastSeries ? (
          <>
            <HStack spacing="16px" mb="10px" flexWrap="wrap">
              <Text color={textMuted}>
                Expected Trend: {forecast?.expected_trend || '--'}
              </Text>
              <Text color={textMuted}>
                Expected Return:{' '}
                {forecast?.expected_total_return === undefined
                  ? '--'
                  : `${numberFmt.format(forecast.expected_total_return * 100)}%`}
              </Text>
              <Text color={textMuted}>
                Expected Close:{' '}
                {forecast?.expected_close === undefined
                  ? '--'
                  : numberFmt.format(forecast.expected_close)}
              </Text>
              <Text color={textMuted}>
                Confidence:{' '}
                {confidenceScore === null ? '--' : `${confidenceScore}%`}
              </Text>
            </HStack>
            <Text color={textMuted} fontSize="sm" mb="12px">
              Confidence blends directional consistency, model RMSE, and
              forecast interval width.
            </Text>
            <Box h="320px">
              <ReactApexChart
                type="line"
                height="100%"
                options={{
                  chart: { toolbar: { show: false } },
                  xaxis: { categories: forecastSeries.categories },
                  stroke: { curve: 'smooth', width: [3, 3] },
                  colors: ['#1A365D', '#D69E2E'],
                  tooltip: { shared: true, theme: 'dark' },
                  legend: { position: 'top' },
                }}
                series={forecastSeries.series}
              />
            </Box>
          </>
        ) : (
          <Text color={textMuted}>
            Forecast is unavailable for this symbol.
          </Text>
        )}
      </Card>
    </SimpleGrid>
  );
}

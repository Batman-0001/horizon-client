import {
  Box,
  Heading,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import React from 'react';
import ReactApexChart from 'react-apexcharts';
import { numberFmt, safeNumber } from '../utils';

function formatCorrelation(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '--';
  }
  return value.toFixed(4);
}

export default function ComparisonAndMovers({
  compareChartConfig,
  topMovers,
  textMuted,
  positiveColor,
  negativeColor,
}) {
  return (
    <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px">
      <Card p="20px">
        <Heading size="sm" mb="12px">
          Relative Performance Comparison
        </Heading>
        {compareChartConfig ? (
          <>
            <Text mb="8px" color={textMuted}>
              Correlation (daily returns):{' '}
              {formatCorrelation(compareChartConfig.correlation)}
            </Text>
            <Text mb="8px" color={textMuted} fontSize="sm">
              Based on {compareChartConfig.correlationSampleSize || 0} aligned
              return points.
            </Text>
            {compareChartConfig.correlationDataWarning ? (
              <Text mb="8px" color={textMuted} fontSize="sm">
                {compareChartConfig.correlationDataWarning}
              </Text>
            ) : null}
            <Box h="300px">
              <ReactApexChart
                options={compareChartConfig.options}
                series={compareChartConfig.series}
                type="line"
                height="100%"
              />
            </Box>
          </>
        ) : (
          <Text color={textMuted}>Select a second company to compare.</Text>
        )}
      </Card>

      <Card p="20px">
        <Heading size="sm" mb="12px">
          Top Gainers / Losers
        </Heading>
        {topMovers.length ? (
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Symbol</Th>
                <Th isNumeric>Daily Return</Th>
              </Tr>
            </Thead>
            <Tbody>
              {topMovers.map((row, idx) => {
                const value = safeNumber(
                  row.daily_return ?? row.return ?? row.change_pct,
                );
                return (
                  <Tr key={`${row.symbol || row.ticker || 'SYM'}-${idx}`}>
                    <Td>{row.symbol || row.ticker || '--'}</Td>
                    <Td
                      isNumeric
                      color={
                        value !== null && value >= 0
                          ? positiveColor
                          : negativeColor
                      }
                    >
                      {value === null
                        ? '--'
                        : `${numberFmt.format(value * 100)}%`}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        ) : (
          <Text color={textMuted}>
            Market highlights are unavailable right now.
          </Text>
        )}
      </Card>
    </SimpleGrid>
  );
}

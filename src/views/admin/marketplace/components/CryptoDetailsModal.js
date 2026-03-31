import React from 'react';
import {
  Box,
  Flex,
  Grid,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import ReactApexChart from 'react-apexcharts';

function formatUsd(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: numeric >= 100 ? 2 : 4,
  }).format(numeric);
}

function formatChange(change) {
  const numeric = Number(change);
  if (!Number.isFinite(numeric)) return '--';
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(2)}%`;
}

function formatTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

export default function CryptoDetailsModal({
  isOpen,
  onClose,
  crypto,
  trend,
  isTrendLoading,
}) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const mutedColor = useColorModeValue(
    'secondaryGray.600',
    'secondaryGray.400',
  );
  const borderColor = useColorModeValue('gray.100', 'whiteAlpha.200');
  const chartLine = useColorModeValue('#5B2FFF', '#7B61FF');

  const chartSeries = React.useMemo(() => {
    if (!Array.isArray(trend) || !trend.length) return [];
    return [
      {
        name: 'Price',
        data: trend
          .map((point) => Number(point.price))
          .filter((value) => Number.isFinite(value)),
      },
    ];
  }, [trend]);

  const chartCategories = React.useMemo(() => {
    if (!Array.isArray(trend) || !trend.length) return [];
    return trend.map((point) => {
      const timestamp = Number(point.timestamp);
      if (!Number.isFinite(timestamp)) return '';
      return new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    });
  }, [trend]);

  const chartOptions = React.useMemo(
    () => ({
      chart: {
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      stroke: { curve: 'smooth', width: 3 },
      dataLabels: { enabled: false },
      tooltip: { theme: 'dark' },
      xaxis: {
        categories: chartCategories,
        labels: {
          style: {
            colors: '#A3AED0',
            fontSize: '11px',
          },
        },
      },
      yaxis: {
        labels: {
          formatter: (value) => formatUsd(value),
        },
      },
      colors: [chartLine],
      grid: {
        borderColor: 'rgba(163, 174, 208, 0.25)',
        strokeDashArray: 4,
      },
    }),
    [chartCategories, chartLine],
  );

  if (!crypto) return null;

  const displayName =
    crypto.coin_label ||
    (Array.isArray(crypto.name) ? crypto.name[0] : crypto.name) ||
    crypto.symbol ||
    'Crypto Details';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', xl: '4xl' }}>
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent>
        <ModalHeader color={textColor}>{displayName}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb="24px">
          <Flex direction="column" gap="18px">
            <Grid
              templateColumns={{ base: '1fr', md: '1fr 1fr 1fr' }}
              gap="12px"
            >
              <Stat
                p="12px"
                border="1px solid"
                borderColor={borderColor}
                borderRadius="12px"
              >
                <StatLabel>Current Price</StatLabel>
                <StatNumber fontSize="lg">
                  {formatUsd(crypto.current_price)}
                </StatNumber>
              </Stat>
              <Stat
                p="12px"
                border="1px solid"
                borderColor={borderColor}
                borderRadius="12px"
              >
                <StatLabel>24h Change</StatLabel>
                <StatNumber fontSize="lg">
                  {formatChange(crypto.price_change_percentage_24h)}
                </StatNumber>
              </Stat>
              <Stat
                p="12px"
                border="1px solid"
                borderColor={borderColor}
                borderRadius="12px"
              >
                <StatLabel>Market Cap Rank</StatLabel>
                <StatNumber fontSize="lg">
                  #{crypto.market_cap_rank || '--'}
                </StatNumber>
              </Stat>
            </Grid>

            <Flex align="center" justify="space-between">
              <Text color={textColor} fontWeight="700" fontSize="lg">
                Price Trend (30d)
              </Text>
              <Text color={mutedColor} fontSize="sm">
                Last updated: {formatTime(crypto.last_updated)}
              </Text>
            </Flex>

            <Box
              border="1px solid"
              borderColor={borderColor}
              borderRadius="14px"
              p="14px"
              minH="320px"
            >
              {isTrendLoading ? (
                <Flex
                  align="center"
                  justify="center"
                  h="280px"
                  direction="column"
                  gap="10px"
                >
                  <Spinner color="brand.500" />
                  <Text color={mutedColor} fontSize="sm">
                    Loading trend data...
                  </Text>
                </Flex>
              ) : chartSeries.length ? (
                <Box h="280px">
                  <ReactApexChart
                    options={chartOptions}
                    series={chartSeries}
                    type="line"
                    width="100%"
                    height="100%"
                  />
                </Box>
              ) : (
                <Flex align="center" justify="center" h="280px">
                  <Text color={mutedColor}>
                    Trend data is currently unavailable.
                  </Text>
                </Flex>
              )}
            </Box>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

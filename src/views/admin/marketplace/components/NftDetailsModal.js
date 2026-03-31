import React from 'react';
import {
  Box,
  Flex,
  Grid,
  Image,
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

function formatVolume(volume, nativeSymbol) {
  if (volume && typeof volume === 'object') {
    const usd = Number(volume.usd);
    if (Number.isFinite(usd)) return formatUsd(usd);

    const native = Number(volume.native_currency);
    if (Number.isFinite(native)) {
      return `${native.toFixed(4)} ${(nativeSymbol || 'NATIVE').toUpperCase()}`;
    }
  }

  const numeric = Number(volume);
  if (Number.isFinite(numeric)) return formatUsd(numeric);
  return 'N/A';
}

function formatChange(change) {
  const numeric = Number(change);
  if (!Number.isFinite(numeric)) return '--';
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(2)}%`;
}

function formatTrendAxisValue(value, currencySymbol) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';

  const symbol = String(currencySymbol || '').toUpperCase();
  if (symbol === 'USD' || symbol === 'USDT' || symbol === 'USDC') {
    return formatUsd(numeric);
  }

  return `${numeric.toFixed(3)} ${symbol || 'NATIVE'}`;
}

export default function NftDetailsModal({
  isOpen,
  onClose,
  nft,
  trend,
  isTrendLoading,
}) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const mutedColor = useColorModeValue(
    'secondaryGray.600',
    'secondaryGray.400',
  );
  const borderColor = useColorModeValue('gray.100', 'whiteAlpha.200');
  const chartLine = useColorModeValue('#2B6CB0', '#63B3ED');

  if (!nft) return null;

  const floorPrice = nft.currentbid || nft.floor_price_label || '--';
  const trendSymbol = String(nft.native_currency_symbol || 'USD').toUpperCase();
  const chartSeries = React.useMemo(() => {
    if (!Array.isArray(trend) || !trend.length) return [];
    return [
      {
        name: 'Floor Price',
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
          formatter: (value) => formatTrendAxisValue(value, trendSymbol),
        },
      },
      colors: [chartLine],
      grid: {
        borderColor: 'rgba(163, 174, 208, 0.25)',
        strokeDashArray: 4,
      },
    }),
    [chartCategories, chartLine, trendSymbol],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', md: 'xl' }}>
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent>
        <ModalHeader color={textColor}>{nft.name || 'NFT Details'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb="24px">
          <Grid templateColumns={{ base: '1fr', md: '220px 1fr' }} gap="20px">
            <Image
              src={nft.image || nft.thumb}
              alt={nft.name || 'NFT image'}
              borderRadius="18px"
              w="100%"
              h={{ base: '260px', md: '220px' }}
              objectFit="cover"
              border="1px solid"
              borderColor={borderColor}
            />
            <Flex direction="column" gap="14px">
              <Text color={textColor} fontWeight="700" fontSize="xl">
                {nft.name || 'Unknown NFT'}
              </Text>
              <Text color={mutedColor} fontSize="sm">
                Collection symbol: {(nft.symbol || 'N/A').toUpperCase()}
              </Text>
              <Text color={mutedColor} fontSize="sm">
                ID: {nft.id || 'N/A'}
              </Text>
              <Box pt="6px">
                <Grid
                  templateColumns={{ base: '1fr', sm: '1fr 1fr' }}
                  gap="12px"
                >
                  <Stat
                    p="12px"
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="12px"
                  >
                    <StatLabel>Floor Price</StatLabel>
                    <StatNumber fontSize="lg">{floorPrice}</StatNumber>
                  </Stat>
                  <Stat
                    p="12px"
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="12px"
                  >
                    <StatLabel>24h Volume</StatLabel>
                    <StatNumber fontSize="lg">
                      {formatVolume(nft.h24_volume, nft.native_currency_symbol)}
                    </StatNumber>
                  </Stat>
                  <Stat
                    p="12px"
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="12px"
                  >
                    <StatLabel>24h Floor Change</StatLabel>
                    <StatNumber fontSize="lg">
                      {formatChange(nft.floor_price_24h_percentage_change)}
                    </StatNumber>
                  </Stat>
                  <Stat
                    p="12px"
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="12px"
                  >
                    <StatLabel>Native Currency</StatLabel>
                    <StatNumber fontSize="lg">
                      {(nft.native_currency_symbol || 'N/A').toUpperCase()}
                    </StatNumber>
                  </Stat>
                </Grid>
              </Box>
            </Flex>
          </Grid>
          <Box
            mt="18px"
            border="1px solid"
            borderColor={borderColor}
            borderRadius="14px"
            p="14px"
            minH="300px"
          >
            <Flex align="center" justify="space-between" mb="10px">
              <Text color={textColor} fontWeight="700" fontSize="md">
                Floor Trend (30d)
              </Text>
              <Text color={mutedColor} fontSize="sm">
                {trendSymbol}
              </Text>
            </Flex>
            {isTrendLoading ? (
              <Flex
                align="center"
                justify="center"
                h="230px"
                direction="column"
                gap="10px"
              >
                <Spinner color="brand.500" />
                <Text color={mutedColor} fontSize="sm">
                  Loading NFT trend...
                </Text>
              </Flex>
            ) : chartSeries.length ? (
              <Box h="230px">
                <ReactApexChart
                  options={chartOptions}
                  series={chartSeries}
                  type="line"
                  width="100%"
                  height="100%"
                />
              </Box>
            ) : (
              <Flex align="center" justify="center" h="230px">
                <Text color={mutedColor}>
                  Trend data is currently unavailable.
                </Text>
              </Flex>
            )}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

import React from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  SimpleGrid,
  Skeleton,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import Chart from 'react-apexcharts';
import Card from 'components/card/Card';
import {
  fetchEventImpactAnalytics,
  getCachedEventImpactAnalytics,
} from 'api/stockApi';

const LOOKBACK_DAYS = 365;
const WINDOW_DAYS = 3;

const SECTOR_COLORS = {
  IT: '#4318FF',
  Banking: '#FF6B6B',
  Energy: '#00C2A8',
  Other: '#A3AED0',
};

function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeImpact(impact, valueForFallback) {
  if (
    impact &&
    typeof impact.label === 'string' &&
    typeof impact.color_scheme === 'string'
  ) {
    return {
      label: impact.label,
      colorScheme: impact.color_scheme,
    };
  }

  const magnitude = Math.abs(safeNumber(valueForFallback));
  if (magnitude >= 4) return { label: 'High Impact', colorScheme: 'red' };
  if (magnitude >= 2) return { label: 'Medium', colorScheme: 'yellow' };
  return { label: 'Low', colorScheme: 'green' };
}

function getImpactBadgeStyles(label) {
  if (label === 'High Impact') {
    return { bg: '#FFECEF', color: '#9F1239' };
  }
  if (label === 'Medium') {
    return { bg: '#ECEFFF', color: '#3730A3' };
  }
  return { bg: '#E8F5FF', color: '#1D4ED8' };
}

function normalizeEventPayload(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  return events
    .map((event) => {
      const sectorReactions = Array.isArray(event?.sector_reactions)
        ? event.sector_reactions.map((row) => ({
            sector: row.sector || 'Other',
            avgWindowReturnPct: safeNumber(row.avg_window_return_pct),
            avgAbnormalReturnPct: safeNumber(row.avg_abnormal_return_pct),
            contributionSharePct: safeNumber(row.contribution_share_pct),
            positiveRatioPct: safeNumber(row.positive_ratio_pct),
          }))
        : [];

      const stockReactions = Array.isArray(event?.stock_reactions)
        ? event.stock_reactions.map((row) => {
            const abnormalReturnPct = safeNumber(row.abnormal_return_pct);
            return {
              symbol: row.display_symbol || row.symbol,
              symbolCode: row.symbol,
              sector: row.sector || 'Other',
              beforePrice: safeNumber(row.before_price, null),
              afterPrice: safeNumber(row.after_price, null),
              eventDayReturnPct: safeNumber(row.event_day_return_pct, null),
              windowReturnPct: safeNumber(row.window_return_pct),
              abnormalReturnPct,
              volumeSpikeRatio: safeNumber(row.volume_spike_ratio, null),
              impact: normalizeImpact(row.impact, abnormalReturnPct),
            };
          })
        : [];

      const impactScore = safeNumber(event?.impact_score);

      return {
        id: event?.id || `evt-${event?.date || Math.random()}`,
        event: event?.event || 'Market Event',
        date: event?.date || '--',
        impactScore,
        eventScore: safeNumber(event?.event_score),
        eventIntensity: safeNumber(event?.event_intensity),
        marketMovePct: safeNumber(event?.market_move_pct),
        dispersionPct: safeNumber(event?.dispersion_pct),
        advDecSpreadPct: safeNumber(event?.adv_dec_spread_pct),
        impact: normalizeImpact(event?.impact, impactScore),
        autoLabels: {
          regime: event?.auto_labels?.regime || 'Macro Shock',
          rallyStrength: event?.auto_labels?.rally_strength || 'Absent',
          panicLevel: event?.auto_labels?.panic_level || 'Calm',
          volatilityRegime: event?.auto_labels?.volatility_regime || 'Normal',
          confidence: event?.auto_labels?.confidence || 'Low',
          scores: {
            rally: safeNumber(event?.auto_labels?.scores?.rally),
            panic: safeNumber(event?.auto_labels?.scores?.panic),
            confidence: safeNumber(event?.auto_labels?.scores?.confidence),
          },
        },
        breadth: {
          advancers: safeNumber(event?.breadth?.advancers),
          decliners: safeNumber(event?.breadth?.decliners),
          flat: safeNumber(event?.breadth?.flat),
          strongMovers: safeNumber(event?.breadth?.strong_movers),
        },
        sectorReactions,
        stockReactions,
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function eventAnalysisSignature(analysis) {
  return (analysis || [])
    .map((event) => {
      const sectorSig = (event.sectorReactions || [])
        .map((row) => `${row.sector}:${row.contributionSharePct.toFixed(2)}`)
        .join('|');
      return `${event.id}:${event.impactScore.toFixed(2)}:${sectorSig}`;
    })
    .join('::');
}

export default function EventImpactLab() {
  const initialAnalysisRef = React.useRef(
    normalizeEventPayload(
      getCachedEventImpactAnalytics(LOOKBACK_DAYS, WINDOW_DAYS),
    ),
  );
  const [loading, setLoading] = React.useState(
    initialAnalysisRef.current.length === 0,
  );
  const [error, setError] = React.useState('');
  const [eventAnalysis, setEventAnalysis] = React.useState(
    initialAnalysisRef.current,
  );
  const analysisSignatureRef = React.useRef(
    eventAnalysisSignature(initialAnalysisRef.current),
  );
  const [activeEventId, setActiveEventId] = React.useState(
    initialAnalysisRef.current[0]?.id || '',
  );

  const titleColor = useColorModeValue('secondaryGray.900', 'white');
  const mutedColor = useColorModeValue(
    'secondaryGray.600',
    'secondaryGray.400',
  );
  const borderColor = useColorModeValue('gray.100', 'whiteAlpha.100');
  const timelineActiveBg = useColorModeValue('#E8EEFF', 'brand.400');
  const timelineActiveText = useColorModeValue('#1F3FA6', 'white');
  const timelineActiveBorder = useColorModeValue('#B7C6F8', 'brand.300');
  const timelineHoverBg = useColorModeValue('#F1F5FF', 'whiteAlpha.100');

  React.useEffect(() => {
    let isMounted = true;

    const loadImpactAnalysis = async () => {
      const hasCachedData = initialAnalysisRef.current.length > 0;
      if (!hasCachedData) {
        setLoading(true);
      }
      setError('');

      try {
        const payload = await fetchEventImpactAnalytics(
          LOOKBACK_DAYS,
          WINDOW_DAYS,
        );
        const analysis = normalizeEventPayload(payload);
        if (!analysis.length) {
          throw new Error('No analytics events returned by backend');
        }
        if (isMounted) {
          const nextSignature = eventAnalysisSignature(analysis);
          if (nextSignature !== analysisSignatureRef.current) {
            setEventAnalysis(analysis);
            analysisSignatureRef.current = nextSignature;
          }
          setActiveEventId((prev) => prev || analysis[0].id);
        }
      } catch (loadError) {
        if (isMounted) {
          const hasDataOnScreen = analysisSignatureRef.current.length > 0;
          if (!hasDataOnScreen) {
            setError(loadError.message || 'Could not load event analytics');
            setEventAnalysis([]);
            setActiveEventId('');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadImpactAnalysis();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeEvent = React.useMemo(
    () =>
      eventAnalysis.find((event) => event.id === activeEventId) ||
      eventAnalysis[0] ||
      null,
    [eventAnalysis, activeEventId],
  );

  const strongestSector = React.useMemo(() => {
    if (!activeEvent?.sectorReactions?.length) return null;
    return [...activeEvent.sectorReactions].sort(
      (a, b) =>
        Math.abs(b.avgAbnormalReturnPct) - Math.abs(a.avgAbnormalReturnPct),
    )[0];
  }, [activeEvent]);

  const stockBarOptions = React.useMemo(() => {
    const rows = activeEvent?.stockReactions || [];
    return {
      chart: { toolbar: { show: false } },
      colors: rows.map((row) =>
        row.abnormalReturnPct >= 0 ? '#00C2A8' : '#FF6B6B',
      ),
      plotOptions: {
        bar: {
          borderRadius: 8,
          distributed: true,
          columnWidth: '42%',
        },
      },
      xaxis: {
        categories: rows.map((row) => row.symbol),
        labels: { style: { colors: '#A3AED0' } },
      },
      yaxis: {
        labels: {
          formatter: (value) => `${value.toFixed(1)}%`,
          style: { colors: '#A3AED0' },
        },
      },
      dataLabels: { enabled: false },
      grid: { borderColor: 'rgba(163, 174, 208, 0.2)' },
      tooltip: {
        y: {
          formatter: (value, { dataPointIndex }) => {
            const row = rows[dataPointIndex];
            if (!row) return `${value.toFixed(2)}%`;
            return `abnormal ${value.toFixed(2)}% | raw ${row.windowReturnPct.toFixed(2)}%`;
          },
        },
      },
      legend: { show: false },
    };
  }, [activeEvent]);

  const stockBarSeries = React.useMemo(
    () => [
      {
        name: 'Abnormal Return',
        data: (activeEvent?.stockReactions || []).map((row) =>
          Number(row.abnormalReturnPct.toFixed(2)),
        ),
      },
    ],
    [activeEvent],
  );

  const sectorPieOptions = React.useMemo(
    () => ({
      chart: { type: 'pie', toolbar: { show: false } },
      labels: (activeEvent?.sectorReactions || []).length
        ? (activeEvent?.sectorReactions || []).map((item) => item.sector)
        : ['No Data'],
      colors: (activeEvent?.sectorReactions || []).map(
        (item) => SECTOR_COLORS[item.sector] || '#4318FF',
      ),
      legend: {
        position: 'bottom',
        labels: { colors: '#A3AED0' },
      },
      dataLabels: { enabled: false },
      tooltip: {
        y: {
          formatter: (_, { seriesIndex }) => {
            const row = activeEvent?.sectorReactions?.[seriesIndex];
            if (!row) return '--';
            return `share ${row.contributionSharePct.toFixed(1)}% | avg abnormal ${row.avgAbnormalReturnPct >= 0 ? '+' : ''}${row.avgAbnormalReturnPct.toFixed(2)}%`;
          },
        },
      },
    }),
    [activeEvent],
  );

  const sectorPieSeries = React.useMemo(() => {
    const values = (activeEvent?.sectorReactions || []).map((item) =>
      Math.max(0, item.contributionSharePct),
    );
    return values.length ? values : [1];
  }, [activeEvent]);

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Card p="24px" mb="20px">
        <Text color={mutedColor} mt="6px">
          Events are detected from real market stress days using move, breadth,
          and dispersion.
        </Text>
        <Text color={mutedColor} fontSize="sm" mt="2px">
          Impact uses abnormal returns over a 3-trading-day window after each
          detected event.
        </Text>
      </Card>

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px" mb="20px">
        <Card p="20px">
          <Text color={titleColor} fontSize="xl" fontWeight="700" mb="12px">
            Visual Timeline
          </Text>
          <Skeleton isLoaded={!loading} borderRadius="12px">
            <Box>
              {(eventAnalysis || []).map((event, idx) => {
                const active = activeEventId === event.id;
                return (
                  <Flex
                    key={event.id}
                    mb={idx === eventAnalysis.length - 1 ? '0' : '10px'}
                  >
                    <Button
                      onClick={() => setActiveEventId(event.id)}
                      w="100%"
                      justifyContent="flex-start"
                      variant={active ? 'solid' : 'outline'}
                      bg={active ? timelineActiveBg : 'transparent'}
                      color={active ? timelineActiveText : titleColor}
                      borderColor={active ? timelineActiveBorder : 'gray.300'}
                      _hover={{
                        bg: active ? timelineActiveBg : timelineHoverBg,
                      }}
                      borderRadius="12px"
                      py="22px"
                    >
                      <Box textAlign="left">
                        <Text fontWeight="700">{event.event}</Text>
                        <Text fontSize="xs" opacity="0.8">
                          {event.date}
                        </Text>
                      </Box>
                    </Button>
                  </Flex>
                );
              })}
            </Box>
          </Skeleton>
        </Card>

        <Card p="20px">
          <Text color={titleColor} fontSize="xl" fontWeight="700" mb="12px">
            Impact Score
          </Text>
          <Skeleton isLoaded={!loading} borderRadius="12px">
            <Box>
              <Text color={mutedColor} fontSize="sm">
                {activeEvent?.event || 'Event'}
              </Text>
              <Text color={titleColor} fontSize="4xl" fontWeight="800" mt="6px">
                {(activeEvent?.impactScore || 0).toFixed(2)}%
              </Text>
              <Text color={mutedColor} fontSize="xs" mt="4px">
                detection score:{' '}
                {activeEvent ? activeEvent.eventScore.toFixed(2) : '--'}
              </Text>
              <Text color={mutedColor} fontSize="xs" mt="4px">
                market move:{' '}
                {activeEvent
                  ? `${activeEvent.marketMovePct >= 0 ? '+' : ''}${activeEvent.marketMovePct.toFixed(2)}%`
                  : '--'}
              </Text>
              <Flex mt="8px" gap="8px" wrap="wrap">
                <Badge bg="#EEF2FF" color="#3730A3" borderRadius="6px">
                  {activeEvent?.autoLabels?.regime || 'N/A'}
                </Badge>
                <Badge bg="#E6F7F2" color="#0F766E" borderRadius="6px">
                  Rally {activeEvent?.autoLabels?.rallyStrength || 'N/A'}
                </Badge>
                <Badge bg="#FFEDEE" color="#9F1239" borderRadius="6px">
                  Panic {activeEvent?.autoLabels?.panicLevel || 'N/A'}
                </Badge>
              </Flex>
              {activeEvent?.impact ? (
                <Badge
                  bg={getImpactBadgeStyles(activeEvent.impact.label).bg}
                  color={getImpactBadgeStyles(activeEvent.impact.label).color}
                  mt="8px"
                  fontSize="0.82rem"
                  px="10px"
                  py="4px"
                >
                  {activeEvent.impact.label}
                </Badge>
              ) : null}
            </Box>
          </Skeleton>
        </Card>

        <Card p="20px">
          <Text color={titleColor} fontSize="xl" fontWeight="700" mb="12px">
            Strongest Sector Move
          </Text>
          <Skeleton isLoaded={!loading} borderRadius="12px">
            <Box>
              <Text color={titleColor} fontSize="2xl" fontWeight="800">
                {strongestSector?.sector || '--'}
              </Text>
              <Text color={mutedColor} mt="6px" fontSize="lg" fontWeight="700">
                {strongestSector
                  ? `${strongestSector.avgAbnormalReturnPct >= 0 ? '+' : ''}${strongestSector.avgAbnormalReturnPct.toFixed(2)}%`
                  : '--'}
              </Text>
              {activeEvent ? (
                <Text color={mutedColor} fontSize="xs" mt="4px">
                  breadth A/D: {activeEvent.breadth.advancers}/
                  {activeEvent.breadth.decliners} | strong movers:{' '}
                  {activeEvent.breadth.strongMovers}
                </Text>
              ) : null}
              {activeEvent ? (
                <Text color={mutedColor} fontSize="xs" mt="3px">
                  breadth spread: {activeEvent.advDecSpreadPct >= 0 ? '+' : ''}
                  {activeEvent.advDecSpreadPct.toFixed(1)}%
                </Text>
              ) : null}
            </Box>
          </Skeleton>
        </Card>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px" mb="20px">
        <Card p="22px">
          <Text color={titleColor} fontSize="xl" fontWeight="700" mb="14px">
            Stock Abnormal Return By Event
          </Text>
          <Skeleton isLoaded={!loading} borderRadius="12px">
            <Box h="320px">
              <Chart
                options={stockBarOptions}
                series={stockBarSeries}
                type="bar"
                height="100%"
              />
            </Box>
          </Skeleton>
        </Card>

        <Card p="22px">
          <Text color={titleColor} fontSize="xl" fontWeight="700" mb="14px">
            Sector Contribution to Event Shock
          </Text>
          <Skeleton isLoaded={!loading} borderRadius="12px">
            <Box h="320px">
              <Chart
                options={sectorPieOptions}
                series={sectorPieSeries}
                type="pie"
                height="100%"
              />
            </Box>
          </Skeleton>
        </Card>
      </SimpleGrid>

      <Card p="22px">
        <Flex justify="space-between" align="center" mb="12px">
          <Text color={titleColor} fontSize="xl" fontWeight="700">
            Event Breakdown: {activeEvent?.event || '--'}
          </Text>
          {error ? <Badge colorScheme="orange">Live API Error</Badge> : null}
        </Flex>

        <Box
          maxH="340px"
          overflowY="auto"
          pr="4px"
          sx={{
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(160, 174, 192, 0.5)',
              borderRadius: '999px',
            },
          }}
        >
          {(activeEvent?.stockReactions || []).map((row) => (
            <Flex
              key={`${activeEvent.id}-${row.symbol}`}
              border="1px solid"
              borderColor={borderColor}
              borderRadius="14px"
              p="12px"
              mb="10px"
              justify="space-between"
              align={{ base: 'flex-start', md: 'center' }}
              direction={{ base: 'column', md: 'row' }}
              gap="8px"
            >
              <Box>
                <Text color={titleColor} fontWeight="800">
                  {row.symbol}
                </Text>
                <Text color={mutedColor} fontSize="sm">
                  {row.sector}
                </Text>
                {Number.isFinite(row.beforePrice) &&
                Number.isFinite(row.afterPrice) ? (
                  <Text color={mutedColor} fontSize="xs" mt="2px">
                    before: {row.beforePrice.toFixed(2)} | after:{' '}
                    {row.afterPrice.toFixed(2)}
                  </Text>
                ) : null}
                {Number.isFinite(row.eventDayReturnPct) ? (
                  <Text color={mutedColor} fontSize="xs" mt="2px">
                    event day: {row.eventDayReturnPct >= 0 ? '+' : ''}
                    {row.eventDayReturnPct.toFixed(2)}% | 3d window:{' '}
                    {row.windowReturnPct >= 0 ? '+' : ''}
                    {row.windowReturnPct.toFixed(2)}%
                  </Text>
                ) : null}
              </Box>
              <Flex align="center" gap="10px">
                <Text color={titleColor} fontWeight="700">
                  {row.abnormalReturnPct >= 0 ? '+' : ''}
                  {row.abnormalReturnPct.toFixed(2)}%
                </Text>
                <Badge
                  bg={getImpactBadgeStyles(row.impact.label).bg}
                  color={getImpactBadgeStyles(row.impact.label).color}
                >
                  {row.impact.label}
                </Badge>
              </Flex>
            </Flex>
          ))}
        </Box>
      </Card>
    </Box>
  );
}

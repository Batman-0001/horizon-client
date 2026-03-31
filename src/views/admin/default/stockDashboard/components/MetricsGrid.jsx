import {
  SimpleGrid,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import React from 'react';
import {
  getMomentumExplainability,
  getVolatilityExplainability,
  numberFmt,
  scoreLabel,
} from '../utils';

export default function MetricsGrid({
  symbol,
  latestClose,
  high52,
  low52,
  avgClose,
  clientMetrics,
  textMuted,
  positiveColor,
  negativeColor,
}) {
  return (
    <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="20px" mb="20px">
      <Card p="20px">
        <Stat>
          <StatLabel>Latest Close</StatLabel>
          <StatNumber>
            {latestClose === null ? '--' : numberFmt.format(latestClose)}
          </StatNumber>
          <StatHelpText color={textMuted}>
            {symbol || 'Select a symbol'}
          </StatHelpText>
        </Stat>
      </Card>
      <Card p="20px">
        <Stat>
          <StatLabel>52-Week Range</StatLabel>
          <StatNumber>
            {high52 === null || low52 === null
              ? '--'
              : `${numberFmt.format(low52)} - ${numberFmt.format(high52)}`}
          </StatNumber>
          <StatHelpText color={textMuted}>
            Avg Close: {avgClose === null ? '--' : numberFmt.format(avgClose)}
          </StatHelpText>
        </Stat>
      </Card>
      <Card p="20px">
        <Stat>
          <StatLabel>Volatility (7D)</StatLabel>
          <StatNumber>
            {clientMetrics.volatility7d === null
              ? '--'
              : `${numberFmt.format(clientMetrics.volatility7d * 100)}%`}
          </StatNumber>
          <StatHelpText color={textMuted}>
            {getVolatilityExplainability(clientMetrics.volatility7d)}
          </StatHelpText>
        </Stat>
      </Card>
      <Card p="20px">
        <Stat>
          <StatLabel>Momentum (7D)</StatLabel>
          <StatNumber
            color={
              clientMetrics.momentum7d === null
                ? undefined
                : clientMetrics.momentum7d >= 0
                  ? positiveColor
                  : negativeColor
            }
          >
            {clientMetrics.momentum7d === null
              ? '--'
              : numberFmt.format(clientMetrics.momentum7d)}
          </StatNumber>
          <StatHelpText color={textMuted}>
            {getMomentumExplainability(clientMetrics.momentum7d)}
          </StatHelpText>
        </Stat>
      </Card>
      <Card p="20px">
        <Stat>
          <StatLabel>Drawdown</StatLabel>
          <StatNumber color={negativeColor}>
            {clientMetrics.drawdown === null
              ? '--'
              : `${numberFmt.format(clientMetrics.drawdown * 100)}%`}
          </StatNumber>
          <StatHelpText color={textMuted}>
            Distance from recent peak
          </StatHelpText>
        </Stat>
      </Card>
      <Card p="20px">
        <Stat>
          <StatLabel>Risk-Adjusted Score</StatLabel>
          <StatNumber>
            {clientMetrics.score === null
              ? '--'
              : numberFmt.format(clientMetrics.score)}
          </StatNumber>
          <StatHelpText color={textMuted}>
            {scoreLabel(clientMetrics.score)}
          </StatHelpText>
        </Stat>
      </Card>
    </SimpleGrid>
  );
}

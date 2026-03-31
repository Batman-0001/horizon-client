import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import Card from 'components/card/Card';
import React from 'react';

export default function CompaniesPanel({
  companies,
  symbol,
  onSelectSymbol,
  scrollbarTrack,
  scrollbarThumb,
}) {
  return (
    <Card p="20px">
      <Heading size="md" mb="12px">
        Companies
      </Heading>
      <Box
        maxH={{ base: '420px', xl: '560px' }}
        overflowY="auto"
        pr="4px"
        sx={{
          scrollbarWidth: 'thin',
          scrollbarColor: `${scrollbarThumb} ${scrollbarTrack}`,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            bg: scrollbarTrack,
            borderRadius: '8px',
          },
          '&::-webkit-scrollbar-thumb': {
            bg: scrollbarThumb,
            borderRadius: '8px',
          },
        }}
      >
        <VStack align="stretch" spacing="8px">
          {companies.length ? (
            companies.map((company) => (
              <Button
                key={company.symbol}
                justifyContent="flex-start"
                variant={company.symbol === symbol ? 'solid' : 'outline'}
                colorScheme="blue"
                onClick={() => onSelectSymbol(company.symbol)}
              >
                {company.symbol}
              </Button>
            ))
          ) : (
            <Text fontSize="sm" color="gray.500">
              No matching companies.
            </Text>
          )}
        </VStack>
      </Box>
    </Card>
  );
}

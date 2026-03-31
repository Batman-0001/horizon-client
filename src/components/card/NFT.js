// Chakra imports
import {
  AvatarGroup,
  Avatar,
  Box,
  Flex,
  Image,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
// Custom components
import Card from 'components/card/Card.js';
// Assets
import React from 'react';

export default function NFT(props) {
  const { image, name, author, bidders, currentbid, onClick } = props;
  const textColor = useColorModeValue('navy.700', 'white');
  const textColorBid = useColorModeValue('brand.500', 'white');
  return (
    <Card
      p="20px"
      cursor={onClick ? 'pointer' : 'default'}
      onClick={onClick}
      transition="all 0.2s linear"
      _hover={
        onClick ? { transform: 'translateY(-2px)', boxShadow: 'xl' } : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <Flex direction={{ base: 'column' }} justify="center">
        <Box mb={{ base: '20px', '2xl': '20px' }} position="relative">
          <Image
            src={image}
            w={{ base: '100%', '3xl': '100%' }}
            h={{ base: '100%', '3xl': '100%' }}
            borderRadius="20px"
          />
        </Box>
        <Flex flexDirection="column" justify="space-between" h="100%">
          <Flex
            justify="space-between"
            direction={{
              base: 'row',
              md: 'column',
              lg: 'row',
              xl: 'column',
              '2xl': 'row',
            }}
            mb="auto"
          >
            <Flex direction="column">
              <Text
                color={textColor}
                fontSize={{
                  base: 'xl',
                  md: 'lg',
                  lg: 'lg',
                  xl: 'lg',
                  '2xl': 'md',
                  '3xl': 'lg',
                }}
                mb="5px"
                fontWeight="bold"
                me="14px"
              >
                {name}
              </Text>
              <Text
                color="secondaryGray.600"
                fontSize={{
                  base: 'sm',
                }}
                fontWeight="400"
                me="14px"
              >
                {author}
              </Text>
            </Flex>
            <AvatarGroup
              max={3}
              color={textColorBid}
              size="sm"
              mt={{
                base: '0px',
                md: '10px',
                lg: '0px',
                xl: '10px',
                '2xl': '0px',
              }}
              fontSize="12px"
            >
              {bidders.map((avt, key) => (
                <Avatar key={key} src={avt} />
              ))}
            </AvatarGroup>
          </Flex>
          <Flex
            align="start"
            justify="flex-start"
            direction={{
              base: 'row',
              md: 'column',
              lg: 'row',
              xl: 'column',
              '2xl': 'row',
            }}
            mt="25px"
          >
            <Text fontWeight="700" fontSize="sm" color={textColorBid}>
              Current Bid: {currentbid}
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
}

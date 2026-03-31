import React from 'react';

// Chakra imports
import { Flex, Text, useColorModeValue } from '@chakra-ui/react';

// Custom components
import { HSeparator } from 'components/separator/Separator';

export function SidebarBrand() {
  //   Chakra color mode
  let logoColor = useColorModeValue('navy.700', 'white');

  return (
    <Flex align="center" direction="column">
      <Text
        my="32px"
        color={logoColor}
        fontSize="33px"
        fontWeight="700"
        letterSpacing="0.6px"
      >
        HORIZON
      </Text>
      <HSeparator mb="20px" />
    </Flex>
  );
}

export default SidebarBrand;

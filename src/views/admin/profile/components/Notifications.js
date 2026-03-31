// Chakra imports
import { Flex, Text, useColorModeValue } from '@chakra-ui/react';
import Card from 'components/card/Card.js';
// Custom components
import SwitchField from 'components/fields/SwitchField';
import Menu from 'components/menu/MainMenu';

export default function Notifications(props) {
  const { items, onToggle, ...rest } = props;
  // Chakra Color Mode
  const textColorPrimary = useColorModeValue('secondaryGray.900', 'white');
  return (
    <Card mb="20px" mt="40px" mx="auto" maxW="410px" {...rest}>
      <Flex align="center" w="100%" justify="space-between" mb="30px">
        <Text
          color={textColorPrimary}
          fontWeight="bold"
          fontSize="2xl"
          mb="4px"
        >
          Notifications
        </Text>
        <Menu />
      </Flex>
      {(Array.isArray(items) ? items : []).map((item, index) => (
        <SwitchField
          key={item.id}
          isChecked={item.enabled}
          onChange={() => (onToggle ? onToggle(item.id) : null)}
          fontSize="sm"
          mb={index < items.length - 1 ? '20px' : '0px'}
          id={item.id}
          label={item.label}
        />
      ))}
    </Card>
  );
}

// Chakra imports
import { Text, useColorModeValue } from '@chakra-ui/react';
// Custom components
import Card from 'components/card/Card.js';
import React from 'react';
import Project from 'views/admin/profile/components/Project';

export default function Projects(props) {
  const { items, title, description } = props;
  // Chakra Color Mode
  const textColorPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textColorSecondary = 'gray.400';
  const cardShadow = useColorModeValue(
    '0px 18px 40px rgba(112, 144, 176, 0.12)',
    'unset',
  );
  return (
    <Card mb={{ base: '0px', '2xl': '20px' }}>
      <Text
        color={textColorPrimary}
        fontWeight="bold"
        fontSize="2xl"
        mt="10px"
        mb="4px"
      >
        {title || 'All projects'}
      </Text>
      <Text color={textColorSecondary} fontSize="md" me="26px" mb="40px">
        {description ||
          'Here you can find more details about your projects and market assets.'}
      </Text>
      {(Array.isArray(items) ? items : []).map((item, index) => (
        <Project
          key={item.id || `${item.title}-${index}`}
          boxShadow={cardShadow}
          mb={index < items.length - 1 ? '20px' : '0px'}
          image={item.image}
          ranking={item.ranking}
          link={item.link}
          title={item.title}
        />
      ))}
      {Array.isArray(items) && items.length === 0 ? (
        <Text color={textColorSecondary} fontSize="sm">
          No live projects available right now.
        </Text>
      ) : null}
    </Card>
  );
}

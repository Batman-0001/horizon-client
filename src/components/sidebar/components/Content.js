// chakra imports
import {
  Box,
  Flex,
  Icon,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
//   Custom components
import Brand from 'components/sidebar/components/Brand';
import Links from 'components/sidebar/components/Links';
import React from 'react';
import { MdLogout } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { clearAuthSession, hasAuthToken } from 'api/authApi';

// FUNCTIONS

function SidebarContent(props) {
  const { routes } = props;
  const navigate = useNavigate();
  const isLoggedIn = hasAuthToken();
  const textColor = useColorModeValue('secondaryGray.500', 'white');
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');

  const handleLogout = () => {
    clearAuthSession();
    navigate('/auth/sign-in', { replace: true });
  };
  // SIDEBAR
  return (
    <Flex
      direction="column"
      height="100%"
      pt="25px"
      px="16px"
      borderRadius="30px"
    >
      <Brand />
      <Stack direction="column" mb="auto" mt="8px">
        <Box ps="20px" pe={{ md: '16px', '2xl': '1px' }}>
          <Links routes={routes} />
        </Box>
      </Stack>
      {isLoggedIn ? (
        <Box ps="20px" pe={{ md: '16px', '2xl': '1px' }} pb="20px">
          <Flex
            align="center"
            gap="12px"
            color={textColor}
            py="8px"
            px="10px"
            borderRadius="10px"
            cursor="pointer"
            _hover={{ bg: hoverBg }}
            onClick={handleLogout}
          >
            <Icon as={MdLogout} w="20px" h="20px" />
            <Text fontWeight="500">Logout</Text>
          </Flex>
        </Box>
      ) : null}
    </Flex>
  );
}

export default SidebarContent;

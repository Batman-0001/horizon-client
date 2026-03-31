import { mode } from '@chakra-ui/theme-tools';
export const progressStyles = {
  components: {
    Progress: {
      baseStyle: {
        track: {
          borderRadius: '999px',
          overflow: 'hidden',
          _focus: {
            boxShadow: 'none',
          },
        },
      },

      variants: {
        table: (props) => ({
          filledTrack: {
            bg: 'brand.500',
            borderRadius: '999px',
            fontSize: 'sm',
          },
          track: {
            borderRadius: '999px',
            bg: mode('blue.50', 'whiteAlpha.50')(props),
            h: '8px',
            overflow: 'hidden',
          },
        }),
      },
    },
  },
};

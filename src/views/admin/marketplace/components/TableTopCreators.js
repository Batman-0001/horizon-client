/* eslint-disable */

import {
  Avatar,
  Box,
  Flex,
  Progress,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import * as React from 'react';

const columnHelper = createColumnHelper();

export default function TopCreatorTable(props) {
  const { tableData, onRowClick } = props;
  const [sorting, setSorting] = React.useState([]);
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const textColorSecondary = useColorModeValue('secondaryGray.600', 'white');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const rowHoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const columns = React.useMemo(
    () => [
      columnHelper.accessor('name', {
        id: 'name',
        header: () => (
          <Text
            justifyContent="space-between"
            align="center"
            fontSize={{ sm: '10px', lg: '12px' }}
            color="gray.400"
          >
            NAME
          </Text>
        ),
        cell: (info) => (
          <Flex align="center">
            <Avatar src={info.getValue()[1]} w="30px" h="30px" me="8px" />
            <Text color={textColor} fontSize="sm" fontWeight="600">
              {info.getValue()[0]}
            </Text>
          </Flex>
        ),
      }),
      columnHelper.accessor('artworks', {
        id: 'artworks',
        header: () => (
          <Text
            justifyContent="space-between"
            align="center"
            fontSize={{ sm: '10px', lg: '12px' }}
            color="gray.400"
          >
            ARTWORKS
          </Text>
        ),
        cell: (info) => (
          <Text color={textColorSecondary} fontSize="sm" fontWeight="500">
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor('rating', {
        id: 'rating',
        header: () => (
          <Text
            justifyContent="space-between"
            align="center"
            fontSize={{ sm: '10px', lg: '12px' }}
            color="gray.400"
          >
            RATING
          </Text>
        ),
        cell: (info) => (
          <Flex align="center">
            <Progress
              variant="table"
              colorScheme="brandScheme"
              h="8px"
              w="108px"
              value={info.getValue()}
            />
          </Flex>
        ),
      }),
    ],
    [textColor, textColorSecondary],
  );
  const data = React.useMemo(
    () => (Array.isArray(tableData) ? tableData : []),
    [tableData],
  );
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: false,
  });
  return (
    <Flex
      direction="column"
      w="100%"
      overflowX={{ sm: 'scroll', lg: 'hidden' }}
    >
      <Flex
        align={{ sm: 'flex-start', lg: 'center' }}
        justify="space-between"
        w="100%"
        px="22px"
        pb="20px"
        mb="10px"
        boxShadow="0px 40px 58px -20px rgba(112, 144, 176, 0.26)"
      >
        <Text color={textColor} fontSize="xl" fontWeight="600">
          Top Crypto Currencies
        </Text>
      </Flex>
      <Box
        maxH={{ base: '420px', md: '520px' }}
        overflowY="auto"
        overflowX="hidden"
        pr="4px"
        sx={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'transparent transparent',
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(160, 174, 192, 0.35)',
            borderRadius: '999px',
          },
          '&:hover::-webkit-scrollbar-thumb': {
            background: 'rgba(160, 174, 192, 0.55)',
          },
          '&:hover': {
            scrollbarColor: 'rgba(160, 174, 192, 0.55) transparent',
          },
        }}
      >
        <Table variant="simple" color="gray.500" mt="12px">
          <Thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <Tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <Th
                      key={header.id}
                      colSpan={header.colSpan}
                      pe="10px"
                      borderColor={borderColor}
                      cursor="pointer"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <Flex
                        justifyContent="space-between"
                        align="center"
                        fontSize={{ sm: '10px', lg: '12px' }}
                        color="gray.400"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {{
                          asc: '',
                          desc: '',
                        }[header.column.getIsSorted()] ?? null}
                      </Flex>
                    </Th>
                  );
                })}
              </Tr>
            ))}
          </Thead>
          <Tbody>
            {table.getRowModel().rows.map((row) => {
              return (
                <Tr
                  key={row.id}
                  cursor={onRowClick ? 'pointer' : 'default'}
                  onClick={
                    onRowClick ? () => onRowClick(row.original) : undefined
                  }
                  _hover={onRowClick ? { bg: rowHoverBg } : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <Td
                        key={cell.id}
                        fontSize={{ sm: '14px' }}
                        minW={{ sm: '150px', md: '200px', lg: 'auto' }}
                        borderColor="transparent"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </Td>
                    );
                  })}
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>
    </Flex>
  );
}

// Chakra imports
import { Button, Flex, Input, useColorModeValue } from '@chakra-ui/react';
// Assets
import React from 'react';
import { useDropzone } from 'react-dropzone';

function Dropzone(props) {
  const { content, onFilesDrop, disabled, ...rest } = props;
  const { getRootProps, getInputProps } = useDropzone({
    multiple: false,
    maxFiles: 1,
    disabled,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
    },
    onDropAccepted: (acceptedFiles) => {
      if (typeof onFilesDrop === 'function') {
        onFilesDrop(acceptedFiles);
      }
    },
  });
  const bg = useColorModeValue('gray.100', 'navy.700');
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100');
  return (
    <Flex
      align="center"
      justify="center"
      bg={bg}
      border="1px dashed"
      borderColor={borderColor}
      borderRadius="16px"
      w="100%"
      h="max-content"
      minH="100%"
      cursor="pointer"
      opacity={disabled ? 0.65 : 1}
      {...getRootProps({ className: 'dropzone' })}
      {...rest}
    >
      <Input variant="main" {...getInputProps()} />
      <Button variant="no-effects">{content}</Button>
    </Flex>
  );
}

export default Dropzone;

import React, { useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormLabel,
  Grid,
  Input,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import { getStoredUser, updatePassword, updateProfile } from 'api/authApi';

function ProfileSettings() {
  const textColorPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textColorSecondary = useColorModeValue(
    'secondaryGray.600',
    'whiteAlpha.700',
  );

  const initialUser = useMemo(() => getStoredUser(), []);
  const [fullName, setFullName] = useState(initialUser?.full_name || '');
  const [email, setEmail] = useState(initialUser?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [passwordMessage, setPasswordMessage] = useState({
    type: '',
    text: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileMessage({ type: '', text: '' });

    const nextName = fullName.trim();
    const nextEmail = email.trim();
    if (!nextName || !nextEmail) {
      setProfileMessage({
        type: 'error',
        text: 'Name and email are required.',
      });
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({ fullName: nextName, email: nextEmail });
      setProfileMessage({
        type: 'success',
        text: 'Profile updated successfully.',
      });
    } catch (error) {
      setProfileMessage({
        type: 'error',
        text: error.message || 'Unable to update profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({
        type: 'error',
        text: 'All password fields are required.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: 'error',
        text: 'New password and confirmation do not match.',
      });
      return;
    }

    setSavingPassword(true);
    try {
      await updatePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({
        type: 'success',
        text: 'Password changed successfully.',
      });
    } catch (error) {
      setPasswordMessage({
        type: 'error',
        text: error.message || 'Unable to change password.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Text color={textColorPrimary} fontSize="34px" fontWeight="700" mb="4px">
        Profile Settings
      </Text>
      <Text color={textColorSecondary} fontSize="md" mb="24px">
        Update your account details and password.
      </Text>

      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap="20px">
        <Card p="24px">
          <Text
            color={textColorPrimary}
            fontSize="xl"
            fontWeight="700"
            mb="18px"
          >
            Account Details
          </Text>
          <Box as="form" onSubmit={handleProfileSubmit}>
            <FormControl mb="14px" isRequired>
              <FormLabel color={textColorSecondary}>Full Name</FormLabel>
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
              />
            </FormControl>
            <FormControl mb="18px" isRequired>
              <FormLabel color={textColorSecondary}>Email</FormLabel>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
              />
            </FormControl>
            {profileMessage.text ? (
              <Alert
                status={profileMessage.type === 'error' ? 'error' : 'success'}
                mb="14px"
                borderRadius="10px"
              >
                <AlertIcon />
                {profileMessage.text}
              </Alert>
            ) : null}
            <Button type="submit" variant="brand" isLoading={savingProfile}>
              Save Account Details
            </Button>
          </Box>
        </Card>

        <Card p="24px">
          <Text
            color={textColorPrimary}
            fontSize="xl"
            fontWeight="700"
            mb="18px"
          >
            Change Password
          </Text>
          <Box as="form" onSubmit={handlePasswordSubmit}>
            <FormControl mb="14px" isRequired>
              <FormLabel color={textColorSecondary}>Current Password</FormLabel>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Enter your current password"
              />
            </FormControl>
            <FormControl mb="14px" isRequired>
              <FormLabel color={textColorSecondary}>New Password</FormLabel>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter your new password"
              />
            </FormControl>
            <FormControl mb="18px" isRequired>
              <FormLabel color={textColorSecondary}>
                Confirm New Password
              </FormLabel>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm your new password"
              />
            </FormControl>
            {passwordMessage.text ? (
              <Alert
                status={passwordMessage.type === 'error' ? 'error' : 'success'}
                mb="14px"
                borderRadius="10px"
              >
                <AlertIcon />
                {passwordMessage.text}
              </Alert>
            ) : null}
            <Button type="submit" variant="brand" isLoading={savingPassword}>
              Update Password
            </Button>
          </Box>
        </Card>
      </Grid>
    </Box>
  );
}

export default ProfileSettings;

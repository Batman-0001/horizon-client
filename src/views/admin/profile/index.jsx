import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Grid,
  Skeleton,
} from '@chakra-ui/react';

// Custom components
import Banner from 'views/admin/profile/components/Banner';
import General from 'views/admin/profile/components/General';
import Projects from 'views/admin/profile/components/Projects';
import Storage from 'views/admin/profile/components/Storage';
import Upload from 'views/admin/profile/components/Upload';

// Assets
import banner from 'assets/img/auth/banner.png';
import avatar from 'assets/img/avatars/avatar4.png';
import React, { useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  getStoredUser,
  updateProfile,
  uploadProfileImageToCloudinary,
} from 'api/authApi';
import {
  fetchCompanies,
  fetchMarketHighlights,
  fetchStrategyRecommendationHistory,
} from 'api/stockApi';
import { fetchTopCryptoMarket } from 'api/marketApi';

const UPLOAD_HISTORY_KEY_PREFIX = 'jarnox-profile-uploads:';
const WORKSPACE_TOTAL_MB = 100;

function formatCompactNumber(value) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function inferRoleFromEmail(email) {
  if (!email || !email.includes('@')) return 'Market Analyst';
  const domain = email.split('@')[1] || '';
  if (domain.includes('gmail') || domain.includes('outlook')) {
    return 'Independent Trader';
  }
  return 'Portfolio Analyst';
}

function buildGeneralSummary({ user, marketHighlights, historyCount }) {
  const sentiment = marketHighlights?.market_sentiment || 'neutral';
  const trending = marketHighlights?.trending?.[0]?.symbol || null;
  const fullName = user?.full_name || 'Trader';
  if (trending) {
    return `${fullName}, market sentiment is currently ${sentiment} and ${trending} is leading recent activity. You have ${historyCount} saved strategy runs to review and compare.`;
  }
  return `${fullName}, your account is synced and ready. Keep building conviction by reviewing your latest strategy runs and tracking the strongest movers.`;
}

function buildGeneralInfo({ user, companiesCount, historyCount, vsCurrency }) {
  const email = user?.email || 'Not set';
  const username = email.includes('@') ? email.split('@')[0] : 'Not set';
  const domain = email.includes('@') ? email.split('@')[1] : 'Not set';
  return [
    { title: 'Email', value: email },
    { title: 'Username', value: username },
    { title: 'Email Domain', value: domain },
    { title: 'Tracked Equities', value: String(companiesCount) },
    { title: 'Saved Strategy Runs', value: String(historyCount) },
    { title: 'Preferred Currency', value: (vsCurrency || 'usd').toUpperCase() },
  ];
}

function buildProjectItems(cryptoItems = []) {
  return cryptoItems.slice(0, 3).map((coin, index) => {
    const symbol = (coin?.symbol || '').toUpperCase();
    const rank = coin?.market_cap_rank || index + 1;
    return {
      id: coin?.id || `${symbol}-${index}`,
      image: coin?.image || avatar,
      ranking: String(rank),
      title: `${coin?.name || 'Crypto Asset'} (${symbol || 'N/A'})`,
      link: `/admin/data-tables?symbol=${encodeURIComponent(symbol || '')}`,
    };
  });
}

function normalizeUploadHistoryItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .filter((item) => item && Number(item.bytes) > 0)
    .map((item) => ({
      id: item.id,
      name: item.name || 'profile-image',
      bytes: Number(item.bytes),
      uploadedAt: item.uploadedAt || new Date().toISOString(),
      secureUrl: item.secureUrl || '',
    }));
}

function toRoundedMb(bytes) {
  return Number(((Number(bytes) || 0) / (1024 * 1024)).toFixed(1));
}

export default function Overview() {
  const storedUser = useMemo(() => getStoredUser(), []);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState('');
  const [user, setUser] = useState(storedUser);
  const [bannerStats, setBannerStats] = useState({
    posts: 0,
    followers: 0,
    following: 0,
  });
  const [storageStats, setStorageStats] = useState({
    used: 5,
    total: 20,
  });
  const [generalSummary, setGeneralSummary] = useState('');
  const [generalInfoItems, setGeneralInfoItems] = useState([]);
  const [projectItems, setProjectItems] = useState([]);
  const [completion, setCompletion] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState([]);
  const [uploadsHydrated, setUploadsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setLoading(true);
      setWarning('');

      const [
        currentUserResult,
        companiesResult,
        historyResult,
        cryptoResult,
        highlightsResult,
      ] = await Promise.allSettled([
        getCurrentUser(),
        fetchCompanies(),
        fetchStrategyRecommendationHistory({ limit: 12 }),
        fetchTopCryptoMarket(6),
        fetchMarketHighlights(),
      ]);

      if (!isMounted) return;

      const nextUser =
        currentUserResult.status === 'fulfilled' && currentUserResult.value
          ? currentUserResult.value
          : storedUser;
      setUser(nextUser);

      const companies =
        companiesResult.status === 'fulfilled'
          ? companiesResult.value?.companies || []
          : [];
      const historyItems =
        historyResult.status === 'fulfilled'
          ? historyResult.value?.items || []
          : [];
      const cryptoItems =
        cryptoResult.status === 'fulfilled'
          ? cryptoResult.value?.items || []
          : [];
      const highlights =
        highlightsResult.status === 'fulfilled' ? highlightsResult.value : null;

      const posts = historyItems.length;
      const followers = cryptoItems.length;
      const following = companies.length;

      setBannerStats({ posts, followers, following });

      setGeneralSummary(
        buildGeneralSummary({
          user: nextUser,
          marketHighlights: highlights,
          historyCount: posts,
        }),
      );
      setGeneralInfoItems(
        buildGeneralInfo({
          user: nextUser,
          companiesCount: following,
          historyCount: posts,
          vsCurrency:
            cryptoResult.status === 'fulfilled'
              ? cryptoResult.value?.vs_currency
              : 'usd',
        }),
      );
      setProjectItems(buildProjectItems(cryptoItems));

      const completionChecks = [
        Boolean(nextUser?.full_name),
        Boolean(nextUser?.email),
        Boolean(nextUser?.avatar_url),
        following > 0,
        followers > 0,
        posts > 0,
      ];
      const completed = completionChecks.filter(Boolean).length;
      setCompletion(Math.round((completed / completionChecks.length) * 100));

      const failedRequests = [
        currentUserResult,
        companiesResult,
        historyResult,
        cryptoResult,
        highlightsResult,
      ].filter((result) => result.status === 'rejected');

      if (failedRequests.length > 0) {
        setWarning(
          'Some profile widgets could not be refreshed. Showing available data.',
        );
      }

      setLoading(false);
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [storedUser]);

  const uploadHistoryStorageKey = useMemo(
    () => `${UPLOAD_HISTORY_KEY_PREFIX}${user?.email || 'guest'}`,
    [user?.email],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setUploadsHydrated(false);
    try {
      const raw = window.localStorage.getItem(uploadHistoryStorageKey);
      if (!raw) {
        setUploadedAssets([]);
        setUploadsHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw);
      setUploadedAssets(normalizeUploadHistoryItems(parsed));
      setUploadsHydrated(true);
    } catch {
      setUploadedAssets([]);
      setUploadsHydrated(true);
    }
  }, [uploadHistoryStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!uploadsHydrated) return;
    window.localStorage.setItem(
      uploadHistoryStorageKey,
      JSON.stringify(uploadedAssets),
    );
  }, [uploadHistoryStorageKey, uploadedAssets, uploadsHydrated]);

  useEffect(() => {
    const totalBytes = uploadedAssets.reduce(
      (sum, fileItem) => sum + Number(fileItem.bytes || 0),
      0,
    );
    const usedMb = toRoundedMb(totalBytes);
    setStorageStats({
      used: Math.min(usedMb, WORKSPACE_TOTAL_MB),
      total: WORKSPACE_TOTAL_MB,
    });
  }, [uploadedAssets]);

  useEffect(() => {
    if (!uploadError || typeof window === 'undefined') return;
    const timer = window.setTimeout(() => setUploadError(''), 6000);
    return () => window.clearTimeout(timer);
  }, [uploadError]);

  useEffect(() => {
    if (!uploadMessage || typeof window === 'undefined') return;
    const timer = window.setTimeout(() => setUploadMessage(''), 5000);
    return () => window.clearTimeout(timer);
  }, [uploadMessage]);

  const handleAvatarUpload = async (acceptedFiles) => {
    const file = Array.isArray(acceptedFiles) ? acceptedFiles[0] : null;
    if (!file) {
      setUploadError('Please select an image file first.');
      return;
    }

    const displayName = user?.full_name || storedUser?.full_name;
    const email = user?.email || storedUser?.email;
    if (!displayName || !email) {
      setUploadError('Profile session is missing. Please sign in again.');
      return;
    }

    setUploadError('');
    setUploadMessage('');
    setIsUploadingAvatar(true);

    try {
      const cloudinaryResult = await uploadProfileImageToCloudinary(file);
      const updatedUser = await updateProfile({
        fullName: displayName,
        email,
        avatarUrl: cloudinaryResult.secureUrl,
      });

      setUser((prev) => ({
        ...(prev || {}),
        ...(updatedUser || {}),
        avatar_url: updatedUser?.avatar_url || cloudinaryResult.secureUrl,
      }));

      setUploadedAssets((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        next.push({
          id: cloudinaryResult.publicId || `${Date.now()}-${file.name}`,
          name: file.name,
          bytes: Number(cloudinaryResult.bytes || file.size || 0),
          uploadedAt: new Date().toISOString(),
          secureUrl: cloudinaryResult.secureUrl,
        });
        return next;
      });
      setUploadMessage('Profile image uploaded successfully.');
    } catch (error) {
      setUploadError(error.message || 'Failed to upload profile image.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const fullName = user?.full_name || 'User';
  const profileAvatar = user?.avatar_url || avatar;
  const usedStorageDescription =
    uploadedAssets.length > 0
      ? `${uploadedAssets.length} uploaded image${uploadedAssets.length > 1 ? 's' : ''} stored in your workspace.`
      : 'Upload profile images to start using workspace storage.';

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      {warning ? (
        <Alert status="warning" mb="20px" borderRadius="12px">
          <AlertIcon />
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ) : null}
      {/* Main Fields */}
      <Grid
        templateColumns={{
          base: '1fr',
          lg: '1.34fr 1fr 1.62fr',
        }}
        templateRows={{
          base: 'repeat(3, 1fr)',
          lg: '1fr',
        }}
        gap={{ base: '20px', xl: '20px' }}
      >
        <Banner
          gridArea="1 / 1 / 2 / 2"
          banner={banner}
          avatar={profileAvatar}
          name={fullName}
          job={inferRoleFromEmail(user?.email)}
          posts={formatCompactNumber(bannerStats.posts)}
          followers={formatCompactNumber(bannerStats.followers)}
          following={formatCompactNumber(bannerStats.following)}
        />
        <Storage
          gridArea={{ base: '2 / 1 / 3 / 2', lg: '1 / 2 / 2 / 3' }}
          used={storageStats.used}
          total={storageStats.total}
          title="Workspace capacity"
          description={usedStorageDescription}
          leftLabel="Used"
          rightLabel="Total"
          unit="MB"
        />
        <Upload
          gridArea={{
            base: '3 / 1 / 4 / 2',
            lg: '1 / 3 / 2 / 4',
          }}
          minH={{ base: 'auto', lg: '420px', '2xl': '365px' }}
          pe="20px"
          pb={{ base: '100px', lg: '20px' }}
          title="Profile completion"
          description="Connect account details and market activity to unlock richer insights."
          buttonLabel={
            isUploadingAvatar
              ? 'Uploading...'
              : loading
                ? 'Syncing...'
                : `${completion}% complete`
          }
          onFilesDrop={handleAvatarUpload}
          isUploading={isUploadingAvatar}
          uploadMessage={uploadMessage}
          uploadError={uploadError}
        />
      </Grid>
      <Grid
        mb="20px"
        templateColumns={{
          base: '1fr',
          lg: 'repeat(2, 1fr)',
          '2xl': 'repeat(2, 1fr)',
        }}
        templateRows={{
          base: 'repeat(2, 1fr)',
          lg: '1fr',
          '2xl': '1fr',
        }}
        gap={{ base: '20px', xl: '20px' }}
      >
        <Projects
          gridArea={{ base: '1 / 1 / 2 / 2', lg: '1 / 1 / 2 / 2' }}
          items={projectItems}
          title="Top crypto projects"
          description="Live assets from the current market feed."
        />
        <General
          gridArea={{ base: '2 / 1 / 3 / 2', lg: '1 / 2 / 2 / 3' }}
          minH="365px"
          pe="20px"
          summary={generalSummary}
          infoItems={generalInfoItems}
        />
      </Grid>
      {loading ? <Skeleton mt="12px" h="12px" borderRadius="12px" /> : null}
    </Box>
  );
}

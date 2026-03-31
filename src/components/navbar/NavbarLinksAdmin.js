// Chakra Imports
import {
  Box,
  Avatar,
  Button,
  Flex,
  Spinner,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useColorModeValue,
  useColorMode,
  useDisclosure,
} from '@chakra-ui/react';
// Custom Components
import { SearchBar } from 'components/navbar/searchBar/SearchBar';
import { SidebarResponsive } from 'components/sidebar/Sidebar';
import PropTypes from 'prop-types';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clearAuthSession, getCurrentUser, getStoredUser } from 'api/authApi';
import {
  fetchAlertPreferences,
  fetchCompanies,
  fetchNotifications,
  getCachedCompanies,
  markNotificationsRead,
  updateAlertPreferences,
} from 'api/stockApi';
import { fetchTopCryptoMarket, fetchTopNftMarket } from 'api/marketApi';
import {
  getDashboardSearchEventName,
  getDashboardSearchStorageKey,
  getMarketplaceSearchEventName,
  getMarketplaceSearchStorageKey,
} from 'variables/searchIdentifiers';
// Assets
import { MdNotificationsNone, MdInfoOutline } from 'react-icons/md';
import { IoMdMoon, IoMdSunny } from 'react-icons/io';
import routes from 'routes';

const NOTIFICATION_POLL_MS = 60 * 1000;
const PREF_SYNC_MS = 45 * 1000;
const DASHBOARD_PREFS_KEY = 'jarnox-stock-dashboard:prefs';

const SEARCH_RESULT_LIMIT = 8;
const SEARCH_HIDE_DELAY_MS = 120;
const TOP_CRYPTO_SEARCH_LIMIT = 50;
const TOP_NFT_SEARCH_LIMIT = 50;

const SEARCHABLE_ADMIN_ROUTES = routes
  .filter((route) => route.layout === '/admin' && !route.hidden)
  .map((route) => ({
    id: `route-${route.path}`,
    type: 'route',
    title: route.name,
    subtitle: 'Page',
    path: `${route.layout}${route.path}`,
    searchText: `${route.name} ${route.path}`.toLowerCase(),
  }));

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeCompanyIndex(payload) {
  const rows = Array.isArray(payload?.companies) ? payload.companies : [];
  return rows
    .map((item, idx) => {
      const symbol = String(item?.symbol || '')
        .trim()
        .toUpperCase();
      if (!symbol) return null;
      const name = String(item?.name || '').trim();
      return {
        id: `company-${symbol}-${idx}`,
        type: 'company',
        symbol,
        name,
        title: symbol,
        subtitle: name || 'Stock',
        searchText: `${symbol} ${name}`.toLowerCase(),
      };
    })
    .filter(Boolean);
}

function normalizeCryptoIndex(payload) {
  const rows = Array.isArray(payload?.items) ? payload.items : [];
  return rows
    .map((item, idx) => {
      const id = String(item?.id || '')
        .trim()
        .toLowerCase();
      const symbol = String(item?.symbol || '')
        .trim()
        .toUpperCase();
      const name = String(item?.name || '').trim();
      if (!id && !symbol && !name) return null;

      const title = symbol || name || id.toUpperCase();
      return {
        id: `crypto-${id || symbol || idx}`,
        type: 'crypto',
        coinId: id,
        symbol,
        name,
        title,
        subtitle: name ? `Crypto • ${name}` : 'Crypto',
        searchText: `${symbol} ${name} ${id}`.toLowerCase(),
      };
    })
    .filter(Boolean);
}

function normalizeNftIndex(payload) {
  const rows = Array.isArray(payload?.items) ? payload.items : [];
  return rows
    .map((item, idx) => {
      const id = String(item?.id || '')
        .trim()
        .toLowerCase();
      const symbol = String(item?.symbol || '')
        .trim()
        .toUpperCase();
      const name = String(item?.name || '').trim();
      if (!id && !symbol && !name) return null;

      const title = name || symbol || id;
      const collection = symbol || 'COLLECTION';
      return {
        id: `nft-${id || symbol || idx}`,
        type: 'nft',
        nftId: id,
        symbol,
        name,
        title,
        subtitle: `NFT • ${collection}`,
        searchText: `${name} ${symbol} ${id}`.toLowerCase(),
      };
    })
    .filter(Boolean);
}

function readDashboardSearchQuery(storageKey) {
  if (typeof window === 'undefined' || !window.sessionStorage) return '';

  try {
    return String(window.sessionStorage.getItem(storageKey) || '');
  } catch {
    return '';
  }
}

function readDashboardSymbols() {
  if (typeof window === 'undefined' || !window.sessionStorage) return [];

  try {
    const raw = window.sessionStorage.getItem(DASHBOARD_PREFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const symbols = [parsed?.symbol, parsed?.compareSymbol]
      .map((value) =>
        String(value || '')
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean);
    return Array.from(new Set(symbols));
  } catch {
    return [];
  }
}

function formatRelativeTime(timestampValue) {
  if (!timestampValue) return 'recently';

  const timestamp = new Date(timestampValue).getTime();
  if (!Number.isFinite(timestamp)) return 'recently';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return 'just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function toNotificationEntry(entry, index) {
  const confidence = Number(entry?.confidence_pct ?? 0);
  const symbol = String(entry?.symbol || '').toUpperCase() || 'Selected stock';
  const category = String(entry?.category || '').toLowerCase();
  const title = String(entry?.title || '').trim();
  const description = String(entry?.description || '').trim();
  const isBuyOpportunity =
    entry?.is_buy_opportunity === true ||
    category === 'strong_buy' ||
    category === 'buy_watch';

  return {
    id: String(entry?.id || `${entry?.timestamp || 'ts'}-${symbol}-${index}`),
    title:
      title ||
      (isBuyOpportunity
        ? `Buy Opportunity: ${symbol}`
        : `Market Update: ${symbol}`),
    description:
      description ||
      `Automated engine confidence ${confidence.toFixed(1)}% for ${symbol}.`,
    timestamp: entry?.timestamp,
    isBuyOpportunity,
    isRead: entry?.is_read === true,
  };
}

export default function HeaderLinks(props) {
  const { secondary } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardSearchStorageKey = React.useMemo(
    () => getDashboardSearchStorageKey(),
    [],
  );
  const marketplaceSearchStorageKey = React.useMemo(
    () => getMarketplaceSearchStorageKey(),
    [],
  );
  const dashboardSearchEventName = React.useMemo(
    () => getDashboardSearchEventName(),
    [],
  );
  const marketplaceSearchEventName = React.useMemo(
    () => getMarketplaceSearchEventName(),
    [],
  );
  const [user, setUser] = React.useState(() => getStoredUser());
  const [searchQuery, setSearchQuery] = React.useState(() =>
    readDashboardSearchQuery(dashboardSearchStorageKey),
  );
  const [companySearchIndex, setCompanySearchIndex] = React.useState(() =>
    normalizeCompanyIndex(getCachedCompanies() || {}),
  );
  const [cryptoSearchIndex, setCryptoSearchIndex] = React.useState([]);
  const [nftSearchIndex, setNftSearchIndex] = React.useState([]);
  const [searchResults, setSearchResults] = React.useState([]);
  const [isSearchActive, setIsSearchActive] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const [notificationError, setNotificationError] = React.useState('');
  const [isNotificationsLoading, setIsNotificationsLoading] =
    React.useState(true);
  const [profileSymbols, setProfileSymbols] = React.useState([]);
  const [currentGuideStep, setCurrentGuideStep] = React.useState(0);
  const {
    isOpen: isGuideMenuOpen,
    onOpen: onGuideMenuOpen,
    onClose: onGuideMenuClose,
  } = useDisclosure();
  const searchBlurTimeoutRef = React.useRef(null);

  const buildSearchResults = React.useCallback(
    (query) => {
      const normalized = normalizeSearchText(query);
      if (!normalized) return [];

      const routeMatches = SEARCHABLE_ADMIN_ROUTES.filter((item) =>
        item.searchText.includes(normalized),
      );

      const companyMatches = companySearchIndex.filter((item) =>
        item.searchText.includes(normalized),
      );

      const cryptoMatches = cryptoSearchIndex.filter((item) =>
        item.searchText.includes(normalized),
      );

      const nftMatches = nftSearchIndex.filter((item) =>
        item.searchText.includes(normalized),
      );

      return [
        ...routeMatches,
        ...companyMatches,
        ...cryptoMatches,
        ...nftMatches,
      ].slice(0, SEARCH_RESULT_LIMIT);
    },
    [companySearchIndex, cryptoSearchIndex, nftSearchIndex],
  );

  const openSearchResult = React.useCallback(
    (result, fallbackQuery = '') => {
      if (!result) return;

      if (result.type === 'route' && result.path) {
        navigate(result.path);
        return;
      }

      if (result.type === 'crypto' || result.type === 'nft') {
        const marketQuery = {
          query: String(
            result.name || result.symbol || fallbackQuery || searchQuery || '',
          ).trim(),
          type: result.type,
          symbol: String(result.symbol || '').trim(),
          id: String(result.coinId || result.nftId || '').trim(),
        };

        try {
          window.sessionStorage.setItem(
            marketplaceSearchStorageKey,
            JSON.stringify(marketQuery),
          );
        } catch {
          // Ignore storage write failures.
        }

        window.dispatchEvent(
          new CustomEvent(marketplaceSearchEventName, {
            detail: marketQuery,
          }),
        );

        navigate('/admin/nft-marketplace');
        return;
      }

      const queryToStore = String(
        result.symbol || fallbackQuery || searchQuery,
      ).trim();

      try {
        window.sessionStorage.setItem(dashboardSearchStorageKey, queryToStore);
      } catch {
        // Ignore storage write failures.
      }

      window.dispatchEvent(
        new CustomEvent(dashboardSearchEventName, {
          detail: queryToStore,
        }),
      );

      navigate('/admin/default');
    },
    [
      dashboardSearchEventName,
      dashboardSearchStorageKey,
      marketplaceSearchEventName,
      marketplaceSearchStorageKey,
      navigate,
      searchQuery,
    ],
  );

  React.useEffect(() => {
    setSearchResults(buildSearchResults(searchQuery));
  }, [buildSearchResults, searchQuery]);

  React.useEffect(() => {
    let isMounted = true;

    const loadCompanies = async () => {
      try {
        const payload = await fetchCompanies();
        if (isMounted) {
          setCompanySearchIndex(normalizeCompanyIndex(payload || {}));
        }
      } catch {
        // Search still works for routes and cached companies.
      }
    };

    loadCompanies();

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    const loadMarketSearchIndexes = async () => {
      try {
        const [cryptoPayload, nftPayload] = await Promise.all([
          fetchTopCryptoMarket(TOP_CRYPTO_SEARCH_LIMIT),
          fetchTopNftMarket(TOP_NFT_SEARCH_LIMIT),
        ]);

        if (!isMounted) return;

        setCryptoSearchIndex(normalizeCryptoIndex(cryptoPayload || {}));
        setNftSearchIndex(normalizeNftIndex(nftPayload || {}));
      } catch {
        // Keep search working for routes and stocks even if market APIs fail.
      }
    };

    loadMarketSearchIndexes();

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (isMounted && currentUser) {
          setUser(currentUser);
        }
      } catch {
        // Ignore fetch failures here; menu can still render from local session.
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    const syncPreferences = async () => {
      const symbols = readDashboardSymbols();
      if (symbols.length === 0) return;

      try {
        const profile = await fetchAlertPreferences();
        const currentSymbols = Array.isArray(profile?.symbols)
          ? profile.symbols.map((item) => String(item).toUpperCase())
          : [];
        const currentSet = new Set(currentSymbols);
        const nextSet = new Set(symbols);
        const isEqual =
          currentSet.size === nextSet.size &&
          symbols.every((symbol) => currentSet.has(symbol));

        if (!isEqual) {
          await updateAlertPreferences({ symbols });
          if (isMounted) {
            setProfileSymbols(symbols);
          }
        } else if (isMounted) {
          setProfileSymbols(currentSymbols);
        }
      } catch {
        // Keep notifications operational even if preference sync fails.
      }
    };

    const loadNotifications = async (showLoader = false) => {
      if (showLoader && isMounted) {
        setIsNotificationsLoading(true);
      }

      try {
        const payload = await fetchNotifications({
          limit: 20,
          sinceHours: 24 * 7,
        });
        const symbols = Array.isArray(payload?.profile?.symbols)
          ? payload.profile.symbols.map((item) => String(item).toUpperCase())
          : [];
        const items = Array.isArray(payload?.items)
          ? payload.items.map(toNotificationEntry)
          : [];

        if (isMounted) {
          setProfileSymbols(symbols);
          setNotifications(items);
          setNotificationError('');
        }
      } catch {
        if (isMounted) {
          setNotificationError('Could not load stock alerts right now.');
        }
      } finally {
        if (isMounted) {
          setIsNotificationsLoading(false);
        }
      }
    };

    syncPreferences();
    loadNotifications(true);
    const prefSyncInterval = window.setInterval(() => {
      syncPreferences();
    }, PREF_SYNC_MS);
    const intervalId = window.setInterval(() => {
      loadNotifications(false);
    }, NOTIFICATION_POLL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(prefSyncInterval);
      window.clearInterval(intervalId);
    };
  }, []);

  const { colorMode, toggleColorMode } = useColorMode();
  // Chakra Color Mode
  const navbarIcon = useColorModeValue('gray.400', 'white');
  let menuBg = useColorModeValue('white', 'navy.800');
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const textColorBrand = useColorModeValue('brand.700', 'brand.400');
  const borderColor = useColorModeValue('#E6ECFA', 'rgba(135, 140, 189, 0.3)');
  const shadow = useColorModeValue(
    '14px 17px 40px 4px rgba(112, 144, 176, 0.18)',
    '14px 17px 40px 4px rgba(112, 144, 176, 0.06)',
  );
  const notificationCardBg = useColorModeValue('gray.50', 'navy.700');
  const unreadCardBg = useColorModeValue('blue.50', 'rgba(76, 144, 255, 0.16)');
  const displayName = user?.full_name || 'User';
  const quickGuideSteps = [
    {
      title: 'Pick a Company',
      description:
        'Use the company panel to choose a stock and set your date window.',
      path: '/admin/default',
      cta: 'Open Dashboard',
    },
    {
      title: 'Read Market Events',
      description:
        'Check Market Event Intelligence for recent events and potential impact.',
      path: '/admin/data-tables',
      cta: 'View Events',
    },
    {
      title: 'Test Your Strategy',
      description:
        'Run scenarios in Strategy Backtester and compare outcomes before acting.',
      path: '/admin/what-if-simulator',
      cta: 'Run Backtest',
    },
    {
      title: 'Review Your Profile',
      description:
        'Update preferences and account details to personalize your workflow.',
      path: '/admin/profile-settings',
      cta: 'Profile Settings',
    },
  ];

  const activeGuideStep = quickGuideSteps[currentGuideStep];
  const isLastGuideStep = currentGuideStep === quickGuideSteps.length - 1;
  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  const handleMarkAllRead = async () => {
    const unreadIds = notifications
      .filter((notification) => !notification.isRead)
      .map((notification) => notification.id);
    if (unreadIds.length === 0) {
      return;
    }

    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, isRead: true })),
    );

    try {
      await markNotificationsRead({ notificationIds: unreadIds });
    } catch {
      // Keep optimistic state; polling will reconcile server state.
    }
  };

  const handleNotificationClick = async (notificationId) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification,
      ),
    );

    try {
      await markNotificationsRead({ notificationIds: [notificationId] });
    } catch {
      // Keep optimistic state; polling will reconcile server state.
    }
    navigate('/admin/what-if-simulator');
  };

  const handleGuideNext = () => {
    if (isLastGuideStep) {
      onGuideMenuClose();
      setCurrentGuideStep(0);
      return;
    }
    setCurrentGuideStep((prevStep) => prevStep + 1);
  };

  const handleGuideBack = () => {
    setCurrentGuideStep((prevStep) => Math.max(0, prevStep - 1));
  };

  const handleLogout = () => {
    clearAuthSession();
    navigate('/auth/sign-in', { replace: true });
  };

  const isDashboardRoute = location.pathname.includes('/admin/default');

  React.useEffect(() => {
    if (isDashboardRoute) {
      setSearchQuery(readDashboardSearchQuery(dashboardSearchStorageKey));
    }
  }, [dashboardSearchStorageKey, isDashboardRoute]);

  React.useEffect(() => {
    return () => {
      if (searchBlurTimeoutRef.current) {
        window.clearTimeout(searchBlurTimeoutRef.current);
      }
    };
  }, []);

  const handleSearchChange = (event) => {
    const nextQuery = event.target.value;
    setSearchQuery(nextQuery);

    if (typeof window === 'undefined') return;

    try {
      window.sessionStorage.setItem(dashboardSearchStorageKey, nextQuery);
    } catch {
      // Ignore storage write failures.
    }

    window.dispatchEvent(
      new CustomEvent(dashboardSearchEventName, {
        detail: nextQuery,
      }),
    );
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      setIsSearchActive(false);
      return;
    }

    if (event.key !== 'Enter') return;
    event.preventDefault();

    const firstResult = searchResults[0];
    if (firstResult) {
      openSearchResult(firstResult, searchQuery);
      setIsSearchActive(false);
      return;
    }

    const fallbackQuery = String(searchQuery || '').trim();
    if (!fallbackQuery) return;

    openSearchResult(
      {
        type: 'company',
        symbol: fallbackQuery,
      },
      fallbackQuery,
    );
    setIsSearchActive(false);
  };

  const handleSearchFocus = () => {
    if (searchBlurTimeoutRef.current) {
      window.clearTimeout(searchBlurTimeoutRef.current);
      searchBlurTimeoutRef.current = null;
    }
    setIsSearchActive(true);
  };

  const handleSearchBlur = () => {
    searchBlurTimeoutRef.current = window.setTimeout(() => {
      setIsSearchActive(false);
    }, SEARCH_HIDE_DELAY_MS);
  };

  return (
    <Flex
      w={{ sm: '100%', md: 'auto' }}
      alignItems="center"
      flexDirection="row"
      bg={menuBg}
      flexWrap={secondary ? { base: 'wrap', md: 'nowrap' } : 'unset'}
      p="10px"
      borderRadius="30px"
      boxShadow={shadow}
    >
      <Box
        position="relative"
        mb={() => {
          if (secondary) {
            return { base: '10px', md: 'unset' };
          }
          return 'unset';
        }}
        me="10px"
      >
        <SearchBar
          borderRadius="30px"
          placeholder="Search pages, stocks, crypto, NFTs..."
          inputProps={{
            value: searchQuery,
            onChange: handleSearchChange,
            onKeyDown: handleSearchKeyDown,
            onFocus: handleSearchFocus,
            onBlur: handleSearchBlur,
          }}
        />
        {isSearchActive && String(searchQuery || '').trim() ? (
          <Box
            position="absolute"
            top="calc(100% + 8px)"
            left="0"
            right="0"
            bg={menuBg}
            borderRadius="16px"
            border="1px solid"
            borderColor={borderColor}
            boxShadow={shadow}
            zIndex="20"
            overflow="hidden"
          >
            {searchResults.length === 0 ? (
              <Text px="12px" py="10px" fontSize="sm" color={navbarIcon}>
                No matches. Press Enter to search this symbol on dashboard.
              </Text>
            ) : (
              searchResults.map((result) => (
                <Flex
                  key={result.id}
                  px="12px"
                  py="10px"
                  align="center"
                  justify="space-between"
                  gap="12px"
                  cursor="pointer"
                  _hover={{ bg: notificationCardBg }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    openSearchResult(result, searchQuery);
                    setSearchQuery(
                      result.symbol || result.title || searchQuery,
                    );
                    setIsSearchActive(false);
                  }}
                >
                  <Text fontSize="sm" fontWeight="600" color={textColor}>
                    {result.title}
                  </Text>
                  <Text fontSize="xs" color={navbarIcon}>
                    {result.subtitle}
                  </Text>
                </Flex>
              ))
            )}
          </Box>
        ) : null}
      </Box>
      <SidebarResponsive routes={routes} />
      <Menu>
        <MenuButton p="0px">
          <Icon
            mt="6px"
            as={MdNotificationsNone}
            color={navbarIcon}
            w="18px"
            h="18px"
            me="10px"
          />
        </MenuButton>
        <MenuList
          boxShadow={shadow}
          p="20px"
          borderRadius="20px"
          bg={menuBg}
          border="none"
          mt="22px"
          me={{ base: '30px', md: 'unset' }}
          minW={{ base: 'unset', md: '400px', xl: '450px' }}
          maxW={{ base: '360px', md: 'unset' }}
        >
          <Flex w="100%" mb="20px">
            <Text fontSize="md" fontWeight="600" color={textColor}>
              Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
            </Text>
            <Text
              fontSize="sm"
              fontWeight="500"
              color={textColorBrand}
              ms="auto"
              cursor={notifications.length ? 'pointer' : 'not-allowed'}
              opacity={notifications.length ? 1 : 0.5}
              onClick={handleMarkAllRead}
            >
              Mark all read
            </Text>
          </Flex>
          {profileSymbols.length > 0 ? (
            <Text fontSize="xs" color={navbarIcon} mb="10px">
              Personalized for: {profileSymbols.join(', ')}
            </Text>
          ) : null}
          <Flex flexDirection="column" gap="10px">
            {isNotificationsLoading && notifications.length === 0 ? (
              <Flex align="center" justify="center" py="18px" gap="10px">
                <Spinner size="sm" color="brand.500" />
                <Text fontSize="sm" color={navbarIcon}>
                  Checking stock opportunities...
                </Text>
              </Flex>
            ) : null}

            {!isNotificationsLoading && notificationError ? (
              <Text fontSize="sm" color="red.400">
                {notificationError}
              </Text>
            ) : null}

            {!isNotificationsLoading &&
            !notificationError &&
            notifications.length === 0 ? (
              <Text fontSize="sm" color={navbarIcon}>
                No automated stock alerts generated yet.
              </Text>
            ) : null}

            {notifications.map((notification) => {
              const isUnread = !notification.isRead;
              return (
                <MenuItem
                  key={notification.id}
                  _hover={{ bg: 'none' }}
                  _focus={{ bg: 'none' }}
                  px="0"
                  borderRadius="10px"
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  <Flex
                    w="100%"
                    p="12px"
                    borderRadius="12px"
                    border="1px solid"
                    borderColor={borderColor}
                    bg={isUnread ? unreadCardBg : notificationCardBg}
                    align="flex-start"
                    gap="10px"
                  >
                    <Flex
                      minW="10px"
                      h="10px"
                      borderRadius="full"
                      mt="6px"
                      bg={
                        notification.isBuyOpportunity
                          ? 'green.400'
                          : 'orange.400'
                      }
                    />
                    <Flex direction="column" gap="2px" w="100%">
                      <Flex justify="space-between" align="start" gap="8px">
                        <Text fontSize="sm" fontWeight="700" color={textColor}>
                          {notification.title}
                        </Text>
                        <Text
                          fontSize="xs"
                          color={navbarIcon}
                          whiteSpace="nowrap"
                        >
                          {formatRelativeTime(notification.timestamp)}
                        </Text>
                      </Flex>
                      <Text fontSize="xs" color={navbarIcon}>
                        {notification.description}
                      </Text>
                    </Flex>
                  </Flex>
                </MenuItem>
              );
            })}
          </Flex>
        </MenuList>
      </Menu>

      <Menu
        isOpen={isGuideMenuOpen}
        onOpen={() => {
          setCurrentGuideStep(0);
          onGuideMenuOpen();
        }}
        onClose={onGuideMenuClose}
      >
        <MenuButton p="0px">
          <Icon
            mt="6px"
            as={MdInfoOutline}
            color={navbarIcon}
            w="18px"
            h="18px"
            me="10px"
          />
        </MenuButton>
        <MenuList
          boxShadow={shadow}
          p="20px"
          me={{ base: '30px', md: 'unset' }}
          borderRadius="20px"
          bg={menuBg}
          border="none"
          mt="22px"
          minW={{ base: 'unset', md: '420px' }}
          maxW={{ base: '360px', md: '460px' }}
        >
          <Flex direction="column" gap="14px">
            <Text fontSize="lg" fontWeight="700" color={textColor}>
              Quick Guide
            </Text>
            <Text fontSize="sm" color={navbarIcon}>
              Step {currentGuideStep + 1} of {quickGuideSteps.length}
            </Text>
            <Flex
              p="12px"
              borderRadius="14px"
              border="1px solid"
              borderColor={borderColor}
              align="start"
              gap="10px"
            >
              <Flex
                minW="26px"
                h="26px"
                borderRadius="full"
                bg="brand.500"
                color="white"
                justify="center"
                align="center"
                fontSize="sm"
                fontWeight="700"
              >
                {currentGuideStep + 1}
              </Flex>
              <Flex direction="column" gap="6px" w="100%">
                <Text fontSize="sm" fontWeight="700" color={textColor}>
                  {activeGuideStep.title}
                </Text>
                <Text fontSize="xs" color={navbarIcon}>
                  {activeGuideStep.description}
                </Text>
                <Button
                  size="sm"
                  alignSelf="flex-start"
                  variant="outline"
                  onClick={() => navigate(activeGuideStep.path)}
                >
                  {activeGuideStep.cta}
                </Button>
              </Flex>
            </Flex>
            <Flex justify="space-between" align="center" pt="2px">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleGuideBack}
                isDisabled={currentGuideStep === 0}
              >
                Previous
              </Button>
              <Button size="sm" colorScheme="blue" onClick={handleGuideNext}>
                {isLastGuideStep ? 'Done' : 'Next'}
              </Button>
            </Flex>
          </Flex>
        </MenuList>
      </Menu>

      <Button
        variant="no-hover"
        bg="transparent"
        p="0px"
        minW="unset"
        minH="unset"
        h="18px"
        w="max-content"
        onClick={toggleColorMode}
      >
        <Icon
          me="10px"
          h="18px"
          w="18px"
          color={navbarIcon}
          as={colorMode === 'light' ? IoMdMoon : IoMdSunny}
        />
      </Button>
      <Menu>
        <MenuButton p="0px">
          <Avatar
            _hover={{ cursor: 'pointer' }}
            color="white"
            name={displayName}
            bg="#11047A"
            size="sm"
            w="40px"
            h="40px"
          />
        </MenuButton>
        <MenuList
          boxShadow={shadow}
          p="0px"
          mt="10px"
          borderRadius="20px"
          bg={menuBg}
          border="none"
        >
          <Flex w="100%" mb="0px">
            <Text
              ps="20px"
              pt="16px"
              pb="10px"
              w="100%"
              borderBottom="1px solid"
              borderColor={borderColor}
              fontSize="sm"
              fontWeight="700"
              color={textColor}
            >
              👋&nbsp; Hey, {displayName}
            </Text>
          </Flex>
          <Flex flexDirection="column" p="10px">
            <MenuItem
              onClick={() => navigate('/admin/profile-settings')}
              _hover={{ bg: 'none' }}
              _focus={{ bg: 'none' }}
              borderRadius="8px"
              px="14px"
            >
              <Text fontSize="sm">Profile Settings</Text>
            </MenuItem>
            <MenuItem
              _hover={{ bg: 'none' }}
              _focus={{ bg: 'none' }}
              borderRadius="8px"
              px="14px"
            >
              <Text fontSize="sm">Newsletter Settings</Text>
            </MenuItem>
            <MenuItem
              onClick={handleLogout}
              _hover={{ bg: 'none' }}
              _focus={{ bg: 'none' }}
              color="red.400"
              borderRadius="8px"
              px="14px"
            >
              <Text fontSize="sm">Log out</Text>
            </MenuItem>
          </Flex>
        </MenuList>
      </Menu>
    </Flex>
  );
}

HeaderLinks.propTypes = {
  variant: PropTypes.string,
  fixed: PropTypes.bool,
  secondary: PropTypes.bool,
  onOpen: PropTypes.func,
};

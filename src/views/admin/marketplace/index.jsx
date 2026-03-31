import React from 'react';

// Chakra imports
import {
  Box,
  Button,
  Flex,
  Grid,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  useColorModeValue,
  SimpleGrid,
} from '@chakra-ui/react';

// Custom components
import Banner from 'views/admin/marketplace/components/Banner';
import TableTopCreators from 'views/admin/marketplace/components/TableTopCreators';
import HistoryItem from 'views/admin/marketplace/components/HistoryItem';
import NftDetailsModal from 'views/admin/marketplace/components/NftDetailsModal';
import CryptoDetailsModal from 'views/admin/marketplace/components/CryptoDetailsModal';
import NFT from 'components/card/NFT';
import Card from 'components/card/Card.js';
import {
  fetchCryptoHistory,
  fetchAllNftMarket,
  fetchNftHistory,
  fetchTopCryptoMarket,
  fetchTopNftMarket,
} from 'api/marketApi';
import {
  getMarketplaceSearchEventName,
  getMarketplaceSearchStorageKey,
} from 'variables/searchIdentifiers';

// Assets
import Nft1 from 'assets/img/nfts/Nft1.png';
import Nft2 from 'assets/img/nfts/Nft2.png';
import Nft3 from 'assets/img/nfts/Nft3.png';
import Nft4 from 'assets/img/nfts/Nft4.png';
import Nft5 from 'assets/img/nfts/Nft5.png';
import Nft6 from 'assets/img/nfts/Nft6.png';
import Avatar1 from 'assets/img/avatars/avatar1.png';
import Avatar2 from 'assets/img/avatars/avatar2.png';
import Avatar3 from 'assets/img/avatars/avatar3.png';
import Avatar4 from 'assets/img/avatars/avatar4.png';
import tableDataTopCreators from 'views/admin/marketplace/variables/tableDataTopCreators.json';
import { tableColumnsTopCreators } from 'views/admin/marketplace/variables/tableColumnsTopCreators';

const NFT_IMAGES = [Nft1, Nft2, Nft3, Nft4, Nft5, Nft6];
const MARKETPLACE_SEARCH_KEY = getMarketplaceSearchStorageKey();
const MARKETPLACE_SEARCH_EVENT = getMarketplaceSearchEventName();
const NFT_AUTHORS = [
  'By Esthera Jackson',
  'By Nick Wilson',
  'By Will Smith',
  'By Peter Will',
  'By Mark Benjamin',
  'By Manny Gates',
];
const NFT_TIMESTAMPS = [
  '30s ago',
  '58s ago',
  '1m ago',
  '1m ago',
  '2m ago',
  '3m ago',
];
const TOP_CRYPTO_LIMIT = 20;
const PREVIEW_CARD_COUNT = 3;

function createDynamicNftImage(seed, fallbackImage) {
  if (!seed) return fallbackImage;
  return `https://picsum.photos/seed/${encodeURIComponent(String(seed))}/420/420`;
}

function resolveNftImage(item) {
  return (
    item?.image_original ||
    item?.image_large ||
    item?.image ||
    item?.thumb ||
    null
  );
}

function createDynamicBidders(seed, count = 5) {
  return Array.from({ length: count }, (_, idx) => {
    const avatarSeed = `${String(seed || 'nft')}-bidder-${idx}`;
    return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(avatarSeed)}`;
  });
}

function formatUsd(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: numeric >= 100 ? 2 : 4,
  }).format(numeric);
}

function relativeTime(isoDate) {
  if (!isoDate) return 'just now';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'just now';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function toRating(change24h) {
  const change = Number(change24h);
  if (!Number.isFinite(change)) return 50;
  const normalized = Math.round((change + 20) * 2.5);
  return Math.max(2, Math.min(100, normalized));
}

function formatCompactNumber(value, maxFractionDigits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: maxFractionDigits,
  }).format(numeric);
}

function normalizeSymbol(value, fallback = 'Collection') {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().toUpperCase();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).toUpperCase();
  }
  return fallback.toUpperCase();
}

function formatNftVolume(volume, nativeSymbol) {
  if (volume && typeof volume === 'object') {
    const usd = Number(volume.usd);
    if (Number.isFinite(usd)) {
      return formatUsd(usd);
    }

    const native = Number(volume.native_currency);
    if (Number.isFinite(native)) {
      return `${formatCompactNumber(native, 4) || native.toFixed(4)} ${normalizeSymbol(nativeSymbol, 'NATIVE')}`;
    }
  }

  const numeric = Number(volume);
  if (Number.isFinite(numeric)) {
    return formatUsd(numeric);
  }

  return 'N/A';
}

function formatFloorPrice(item) {
  if (
    typeof item.floor_price_label === 'string' &&
    item.floor_price_label.trim()
  ) {
    return item.floor_price_label.trim();
  }

  const native = Number(item.floor_price_in_native_currency);
  if (Number.isFinite(native)) {
    return `${native.toFixed(4)} ${normalizeSymbol(item.native_currency_symbol, 'NATIVE')}`;
  }

  return '--';
}

function parseNftVolumeValue(volume) {
  if (volume && typeof volume === 'object') {
    const usd = Number(volume.usd);
    if (Number.isFinite(usd)) return usd;

    const native = Number(volume.native_currency);
    if (Number.isFinite(native)) return native;
  }

  if (typeof volume === 'string') {
    const parsed = Number.parseFloat(volume.replace(/,/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }

  const numeric = Number(volume);
  return Number.isFinite(numeric) ? numeric : 0;
}

function rankNftsByTrend(items) {
  if (!Array.isArray(items)) return [];

  return [...items].sort((left, right) => {
    const rightVolume = parseNftVolumeValue(right?.h24_volume);
    const leftVolume = parseNftVolumeValue(left?.h24_volume);
    if (rightVolume !== leftVolume) {
      return rightVolume - leftVolume;
    }

    const rightChange = Number(right?.floor_price_24h_percentage_change);
    const leftChange = Number(left?.floor_price_24h_percentage_change);
    const safeRight = Number.isFinite(rightChange) ? rightChange : -Infinity;
    const safeLeft = Number.isFinite(leftChange) ? leftChange : -Infinity;
    return safeRight - safeLeft;
  });
}

function mergeNftItems(primaryItems, secondaryItems) {
  const merged = new Map();
  [...primaryItems, ...secondaryItems].forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const idKey = typeof item.id === 'string' && item.id ? item.id : null;
    const fallbackKey = `${item.name || 'nft'}-${item.symbol || 'symbol'}-${idx}`;
    const key = idKey || fallbackKey;
    if (!merged.has(key)) {
      merged.set(key, item);
    }
  });
  return Array.from(merged.values());
}

function buildNftCards(nfts) {
  if (!Array.isArray(nfts) || !nfts.length) {
    return NFT_IMAGES.map((image, idx) => {
      const fallbackName = [
        'Abstract Colors',
        'ETH AI Brain',
        'Mesh Gradients',
        'Swipe Circles',
        'Colorful Heaven',
        '3D Cubes Art',
      ][idx];
      return {
        name: fallbackName,
        author: NFT_AUTHORS[idx],
        image: createDynamicNftImage(fallbackName, image),
        currentbid: '0.91 ETH',
        bidders: createDynamicBidders(fallbackName),
        source: null,
      };
    });
  }

  return nfts.map((item, idx) => {
    const image = NFT_IMAGES[idx % NFT_IMAGES.length];
    const symbol = normalizeSymbol(item.symbol, 'NFT');
    const seed = item.id || item.name || symbol || idx;
    const originalImage = resolveNftImage(item);
    return {
      id: item.id,
      name: item.name || symbol,
      symbol,
      author: `Floor 24h Vol: ${formatNftVolume(item.h24_volume, item.native_currency_symbol)}`,
      image: originalImage || createDynamicNftImage(seed, image),
      currentbid: formatFloorPrice(item) || `-- ${symbol}`,
      bidders: createDynamicBidders(seed),
      floor_price_label: item.floor_price_label,
      floor_price_in_native_currency: item.floor_price_in_native_currency,
      native_currency_symbol: item.native_currency_symbol,
      h24_volume: item.h24_volume,
      floor_price_24h_percentage_change: item.floor_price_24h_percentage_change,
      source: item,
    };
  });
}

function NftSectionModal({ isOpen, onClose, title, items, onCardClick }) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const mutedColor = useColorModeValue(
    'secondaryGray.600',
    'secondaryGray.400',
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', xl: '6xl' }}>
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent>
        <ModalHeader color={textColor}>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb="24px">
          <Text color={mutedColor} fontSize="sm" mb="16px">
            {items.length} items
          </Text>
          {items.length ? (
            <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="20px">
              {items.map((item, idx) => (
                <NFT
                  key={`${title}-modal-${item.id || item.name || idx}`}
                  name={item.name}
                  author={item.author}
                  bidders={item.bidders}
                  image={item.image}
                  currentbid={item.currentbid}
                  onClick={() => {
                    onClose();
                    onCardClick(item);
                  }}
                />
              ))}
            </SimpleGrid>
          ) : (
            <Text color={mutedColor}>No items found for this section.</Text>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function buildNftHistory(nfts) {
  return nfts.map((item, idx) => ({
    id: item.id,
    name: item.name || `NFT ${idx + 1}`,
    symbol: normalizeSymbol(
      item.symbol,
      item.native_currency_symbol || 'Collection',
    ),
    author: `By ${normalizeSymbol(item.symbol, item.native_currency_symbol || 'Collection')}`,
    date: item.last_updated
      ? relativeTime(item.last_updated)
      : NFT_TIMESTAMPS[idx % NFT_TIMESTAMPS.length],
    image: resolveNftImage(item) || NFT_IMAGES[idx % NFT_IMAGES.length],
    price: formatFloorPrice(item),
    floor_price_label: item.floor_price_label,
    floor_price_in_native_currency: item.floor_price_in_native_currency,
    native_currency_symbol: item.native_currency_symbol,
    h24_volume: item.h24_volume,
    floor_price_24h_percentage_change: item.floor_price_24h_percentage_change,
    source: item,
  }));
}

function readMarketplaceSearchIntent() {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;

  try {
    const raw = window.sessionStorage.getItem(MARKETPLACE_SEARCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      query: String(parsed.query || '').trim(),
      type: String(parsed.type || '')
        .trim()
        .toLowerCase(),
      symbol: String(parsed.symbol || '')
        .trim()
        .toUpperCase(),
      id: String(parsed.id || '')
        .trim()
        .toLowerCase(),
    };
  } catch {
    return null;
  }
}

function normalizeIntentSearch(intent) {
  const query = String(intent?.query || '')
    .trim()
    .toLowerCase();
  const symbol = String(intent?.symbol || '')
    .trim()
    .toLowerCase();
  const id = String(intent?.id || '')
    .trim()
    .toLowerCase();
  return { query, symbol, id };
}

export default function Marketplace() {
  // Chakra Color Mode
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const textColorBrand = useColorModeValue('brand.500', 'white');
  const [topCreatorsData, setTopCreatorsData] =
    React.useState(tableDataTopCreators);
  const [nftCards, setNftCards] = React.useState(() => buildNftCards([]));
  const [historyRows, setHistoryRows] = React.useState([
    {
      name: 'Colorful Heaven',
      author: 'By Mark Benjamin',
      date: '30s ago',
      image: Nft5,
      price: '0.91 ETH',
    },
    {
      name: 'Abstract Colors',
      author: 'By Esthera Jackson',
      date: '58s ago',
      image: Nft1,
      price: '0.91 ETH',
    },
    {
      name: 'ETH AI Brain',
      author: 'By Nick Wilson',
      date: '1m ago',
      image: Nft2,
      price: '0.91 ETH',
    },
    {
      name: 'Swipe Circles',
      author: 'By Peter Will',
      date: '1m ago',
      image: Nft4,
      price: '0.91 ETH',
    },
    {
      name: 'Mesh Gradients',
      author: 'By Will Smith',
      date: '2m ago',
      image: Nft3,
      price: '0.91 ETH',
    },
    {
      name: '3D Cubes Art',
      author: 'By Manny Gates',
      date: '3m ago',
      image: Nft6,
      price: '0.91 ETH',
    },
  ]);
  const [isNftModalOpen, setIsNftModalOpen] = React.useState(false);
  const [selectedNft, setSelectedNft] = React.useState(null);
  const [isCryptoModalOpen, setIsCryptoModalOpen] = React.useState(false);
  const [selectedCrypto, setSelectedCrypto] = React.useState(null);
  const [cryptoTrend, setCryptoTrend] = React.useState([]);
  const [isCryptoTrendLoading, setIsCryptoTrendLoading] = React.useState(false);
  const [nftTrend, setNftTrend] = React.useState([]);
  const [isNftTrendLoading, setIsNftTrendLoading] = React.useState(false);
  const [isTrendingMoreOpen, setIsTrendingMoreOpen] = React.useState(false);
  const [isRecentlyMoreOpen, setIsRecentlyMoreOpen] = React.useState(false);
  const [marketSearchIntent, setMarketSearchIntent] = React.useState(() =>
    readMarketplaceSearchIntent(),
  );

  const allTrendingCards = React.useMemo(() => nftCards, [nftCards]);

  const trendingCardsPreview = React.useMemo(
    () => allTrendingCards.slice(0, PREVIEW_CARD_COUNT),
    [allTrendingCards],
  );

  const recentlyAddedCards = React.useMemo(
    () => nftCards.slice(PREVIEW_CARD_COUNT),
    [nftCards],
  );

  const recentlyAddedPreview = React.useMemo(
    () => recentlyAddedCards.slice(0, PREVIEW_CARD_COUNT),
    [recentlyAddedCards],
  );

  const openNftModal = (item) => {
    if (!item) return;
    const base =
      item.source && typeof item.source === 'object' ? item.source : {};
    setSelectedNft({ ...base, ...item });
    setIsNftModalOpen(true);
  };

  const closeNftModal = () => {
    setIsNftModalOpen(false);
  };

  const openCryptoModal = (item) => {
    if (!item) return;
    setSelectedCrypto(item);
    setIsCryptoModalOpen(true);
  };

  const closeCryptoModal = () => {
    setIsCryptoModalOpen(false);
  };

  React.useEffect(() => {
    const syncIntent = (detail) => {
      if (detail && typeof detail === 'object') {
        setMarketSearchIntent({
          query: String(detail.query || '').trim(),
          type: String(detail.type || '')
            .trim()
            .toLowerCase(),
          symbol: String(detail.symbol || '')
            .trim()
            .toUpperCase(),
          id: String(detail.id || '')
            .trim()
            .toLowerCase(),
        });
        return;
      }

      setMarketSearchIntent(readMarketplaceSearchIntent());
    };

    const onIntentChange = (event) => {
      syncIntent(event?.detail);
    };

    const onStorage = (event) => {
      if (!event || event.key === MARKETPLACE_SEARCH_KEY) {
        syncIntent();
      }
    };

    window.addEventListener(MARKETPLACE_SEARCH_EVENT, onIntentChange);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(MARKETPLACE_SEARCH_EVENT, onIntentChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  React.useEffect(() => {
    if (!marketSearchIntent) return;

    const { query, symbol, id } = normalizeIntentSearch(marketSearchIntent);
    if (!query && !symbol && !id) return;

    const matchesText = (...values) =>
      values.some((value) => {
        const text = String(value || '')
          .trim()
          .toLowerCase();
        if (!text) return false;
        if (id && text === id) return true;
        if (symbol && text === symbol) return true;
        return query ? text.includes(query) : false;
      });

    const findCrypto = () =>
      topCreatorsData.find((item) =>
        matchesText(
          item?.id,
          item?.symbol,
          item?.coin_label,
          Array.isArray(item?.name) ? item.name[0] : item?.name,
        ),
      );

    const findNft = () =>
      nftCards.find((item) =>
        matchesText(
          item?.id,
          item?.symbol,
          item?.name,
          item?.source?.id,
          item?.source?.symbol,
          item?.source?.name,
        ),
      );

    let selected = null;
    if (marketSearchIntent.type === 'crypto') {
      selected = findCrypto();
      if (selected) {
        openCryptoModal(selected);
      }
    } else if (marketSearchIntent.type === 'nft') {
      selected = findNft();
      if (selected) {
        openNftModal(selected);
      }
    } else {
      selected = findCrypto();
      if (selected) {
        openCryptoModal(selected);
      } else {
        selected = findNft();
        if (selected) {
          openNftModal(selected);
        }
      }
    }

    if (!selected) return;

    setMarketSearchIntent(null);
    try {
      window.sessionStorage.removeItem(MARKETPLACE_SEARCH_KEY);
    } catch {
      // Ignore storage failures.
    }
  }, [marketSearchIntent, nftCards, topCreatorsData]);

  React.useEffect(() => {
    let active = true;

    const loadCryptoTrend = async () => {
      if (!selectedCrypto?.id || !isCryptoModalOpen) {
        setCryptoTrend([]);
        setIsCryptoTrendLoading(false);
        return;
      }

      setIsCryptoTrendLoading(true);
      try {
        const payload = await fetchCryptoHistory(selectedCrypto.id, 'usd', 30);
        if (!active) return;
        setCryptoTrend(Array.isArray(payload?.prices) ? payload.prices : []);
      } catch {
        if (!active) return;
        setCryptoTrend([]);
      } finally {
        if (active) {
          setIsCryptoTrendLoading(false);
        }
      }
    };

    loadCryptoTrend();

    return () => {
      active = false;
    };
  }, [selectedCrypto?.id, isCryptoModalOpen]);

  React.useEffect(() => {
    let active = true;

    const loadNftTrend = async () => {
      if (!selectedNft?.id || !isNftModalOpen) {
        setNftTrend([]);
        setIsNftTrendLoading(false);
        return;
      }

      setIsNftTrendLoading(true);
      try {
        const preferredCurrency = String(
          selectedNft.native_currency_symbol || 'usd',
        )
          .trim()
          .toLowerCase();
        const payload = await fetchNftHistory(
          selectedNft.id,
          preferredCurrency || 'usd',
          30,
        );
        if (!active) return;
        setNftTrend(Array.isArray(payload?.prices) ? payload.prices : []);
      } catch {
        if (!active) return;
        setNftTrend([]);
      } finally {
        if (active) {
          setIsNftTrendLoading(false);
        }
      }
    };

    loadNftTrend();

    return () => {
      active = false;
    };
  }, [selectedNft?.id, selectedNft?.native_currency_symbol, isNftModalOpen]);

  React.useEffect(() => {
    let active = true;

    const loadCryptoData = async () => {
      let cryptoItems = [];
      try {
        const payload = await fetchTopCryptoMarket(TOP_CRYPTO_LIMIT, 'usd');
        cryptoItems = Array.isArray(payload?.items) ? payload.items : [];
      } catch {
        cryptoItems = [];
      }

      if (!cryptoItems.length) {
        try {
          const fallbackPayload = await fetchTopCryptoMarket(7, 'usd');
          cryptoItems = Array.isArray(fallbackPayload?.items)
            ? fallbackPayload.items
            : [];
        } catch {
          cryptoItems = [];
        }
      }

      if (!active || !cryptoItems.length) return;
      setTopCreatorsData(
        cryptoItems.slice(0, TOP_CRYPTO_LIMIT).map((coin) => ({
          name: [
            `@${String(coin.symbol || coin.name || 'coin').toLowerCase()}`,
            coin.image || Avatar1,
          ],
          artworks: formatUsd(coin.current_price),
          rating: toRating(coin.price_change_percentage_24h),
          id: coin.id,
          symbol: String(coin.symbol || '').toUpperCase(),
          coin_label: coin.name,
          image: coin.image || Avatar1,
          current_price: coin.current_price,
          price_change_percentage_24h: coin.price_change_percentage_24h,
          market_cap_rank: coin.market_cap_rank,
          last_updated: coin.last_updated,
        })),
      );
    };

    const loadNftData = async () => {
      let allNftItems = [];
      let topNftItems = [];

      try {
        const allPayload = await fetchAllNftMarket();
        allNftItems = Array.isArray(allPayload?.items) ? allPayload.items : [];
      } catch {
        allNftItems = [];
      }

      try {
        const payload = await fetchTopNftMarket(20);
        topNftItems = Array.isArray(payload?.items) ? payload.items : [];
      } catch {
        topNftItems = [];
      }

      const mergedItems = mergeNftItems(topNftItems, allNftItems);
      const rankedItems = rankNftsByTrend(mergedItems);

      if (!active || !rankedItems.length) return;
      setNftCards(buildNftCards(rankedItems));
      const history = buildNftHistory(rankedItems);
      if (history.length) {
        setHistoryRows(history);
      }
    };

    const loadLiveMarketData = async () => {
      await Promise.allSettled([loadCryptoData(), loadNftData()]);
    };

    loadLiveMarketData();
    const intervalId = window.setInterval(loadLiveMarketData, 10 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <Box pt={{ base: '180px', md: '80px', xl: '80px' }}>
      {/* Main Fields */}
      <Grid
        mb="20px"
        gridTemplateColumns={{ xl: 'repeat(3, 1fr)', '2xl': '1fr 0.46fr' }}
        gap={{ base: '20px', xl: '20px' }}
        display={{ base: 'block', xl: 'grid' }}
      >
        <Flex
          flexDirection="column"
          gridArea={{ xl: '1 / 1 / 2 / 3', '2xl': '1 / 1 / 2 / 2' }}
        >
          <Banner />
          <Flex direction="column">
            <Flex
              mt="45px"
              mb="20px"
              justifyContent="space-between"
              direction={{ base: 'column', md: 'row' }}
              align={{ base: 'start', md: 'center' }}
            >
              <Text color={textColor} fontSize="2xl" ms="24px" fontWeight="700">
                Trending NFTs
              </Text>
              <Flex
                align="center"
                me="20px"
                ms={{ base: '24px', md: '0px' }}
                mt={{ base: '20px', md: '0px' }}
              >
                <Button
                  variant="action"
                  onClick={() => setIsTrendingMoreOpen(true)}
                  isDisabled={!allTrendingCards.length}
                >
                  See more
                </Button>
              </Flex>
            </Flex>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="20px">
              {trendingCardsPreview.map((item, idx) => (
                <NFT
                  key={`trending-nft-${idx}`}
                  name={item.name}
                  author={item.author}
                  bidders={item.bidders}
                  image={item.image}
                  currentbid={item.currentbid}
                  onClick={() => openNftModal(item)}
                />
              ))}
            </SimpleGrid>
            <Flex
              mt="45px"
              mb="36px"
              align="center"
              justify="space-between"
              ms="24px"
            >
              <Text color={textColor} fontSize="2xl" fontWeight="700">
                Recently Added
              </Text>
              <Button
                variant="action"
                onClick={() => setIsRecentlyMoreOpen(true)}
                isDisabled={!recentlyAddedCards.length}
              >
                See more
              </Button>
            </Flex>
            <SimpleGrid
              columns={{ base: 1, md: 3 }}
              gap="20px"
              mb={{ base: '20px', xl: '0px' }}
            >
              {recentlyAddedPreview.map((item, idx) => (
                <NFT
                  key={`recent-nft-${idx}`}
                  name={item.name}
                  author={item.author}
                  bidders={item.bidders}
                  image={item.image}
                  currentbid={item.currentbid}
                  onClick={() => openNftModal(item)}
                />
              ))}
            </SimpleGrid>
          </Flex>
        </Flex>
        <Flex
          flexDirection="column"
          gridArea={{ xl: '1 / 3 / 2 / 4', '2xl': '1 / 2 / 2 / 3' }}
        >
          <Card px="0px" mb="20px">
            <TableTopCreators
              tableData={topCreatorsData}
              columnsData={tableColumnsTopCreators}
              onRowClick={openCryptoModal}
            />
          </Card>
          <Card p="0px">
            <Flex
              align={{ sm: 'flex-start', lg: 'center' }}
              justify="space-between"
              w="100%"
              px="22px"
              py="18px"
            >
              <Text color={textColor} fontSize="xl" fontWeight="600">
                History
              </Text>
            </Flex>
            <Box
              maxH={{ base: '420px', xl: '540px' }}
              overflowY="auto"
              pb="8px"
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
              {historyRows.map((item, idx) => (
                <HistoryItem
                  key={`history-${idx}`}
                  name={item.name}
                  author={item.author}
                  date={item.date || relativeTime(item.last_updated)}
                  image={item.image}
                  price={item.price}
                  onClick={() => openNftModal(item)}
                />
              ))}
            </Box>
          </Card>
        </Flex>
      </Grid>
      <NftDetailsModal
        isOpen={isNftModalOpen}
        onClose={closeNftModal}
        nft={selectedNft}
        trend={nftTrend}
        isTrendLoading={isNftTrendLoading}
      />
      <CryptoDetailsModal
        isOpen={isCryptoModalOpen}
        onClose={closeCryptoModal}
        crypto={selectedCrypto}
        trend={cryptoTrend}
        isTrendLoading={isCryptoTrendLoading}
      />
      <NftSectionModal
        isOpen={isTrendingMoreOpen}
        onClose={() => setIsTrendingMoreOpen(false)}
        title="Trending NFTs"
        items={allTrendingCards}
        onCardClick={openNftModal}
      />
      <NftSectionModal
        isOpen={isRecentlyMoreOpen}
        onClose={() => setIsRecentlyMoreOpen(false)}
        title="Recently Added"
        items={recentlyAddedCards}
        onCardClick={openNftModal}
      />
      {/* Delete Product */}
    </Box>
  );
}

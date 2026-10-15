import { InstagramPost, UserProfile, DateGroup, MediaItem } from '../types';

function formatTurkishDate(date: Date): { key: string; formatted: string; time: string } {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const key = `${year}-${month}-${day}`;

  const monthsTR = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];
  const daysTR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  const formatted = `${day} ${monthsTR[date.getMonth()]} ${year}, ${daysTR[date.getDay()]}`;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const time = `${hours}:${minutes}`;

  return { key, formatted, time };
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function getInitialsAvatar(name: string, username: string) {
  const clean = (name || username || 'IG').replace(/^@/, '');
  const initials = clean
    .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('') || clean.slice(0, 2).toUpperCase() || 'IG';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f09433"/><stop offset="25%" stop-color="#e6683c"/><stop offset="50%" stop-color="#dc2743"/><stop offset="75%" stop-color="#cc2366"/><stop offset="100%" stop-color="#bc1888"/></linearGradient></defs><rect width="200" height="200" rx="100" fill="url(#g)"/><text x="100" y="116" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="70" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function isMobileOrApkEnvironment(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAndroidOrIos = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isWebView = /; wv\)|Instagram|FBAN|FBAV|Version\/\d+\.\d+.*Chrome\/\d+/i.test(ua) || (window as any).ReactNativeWebView !== undefined;
  const isSmallScreen = window.innerWidth <= 768;
  return isAndroidOrIos || isWebView || isSmallScreen;
}

export interface CachedProfileEntry {
  username: string;
  profile: UserProfile;
  posts: InstagramPost[];
  pageInfo?: any;
  cachedAt: string;
}

const LOCAL_CACHE_PREFIX = 'instaflow_profile_cache_v1_';
const IDB_NAME = 'instaflow_cache_db';
const IDB_STORE = 'profiles';

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'username' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveProfileToLocalCache(
  username: string,
  profile: UserProfile,
  posts: InstagramPost[],
  pageInfo?: any
): Promise<void> {
  const clean = username.replace(/^@/, '').trim().toLowerCase();
  if (!clean || (!profile.isRealInstagramData && posts.length === 0)) return;

  const entry: CachedProfileEntry = {
    username: clean,
    profile,
    posts,
    pageInfo: pageInfo || profile.pageInfo,
    cachedAt: new Date().toISOString(),
  };

  // 1. Save to localStorage for instant synchronous/fast access
  try {
    localStorage.setItem(`${LOCAL_CACHE_PREFIX}${clean}`, JSON.stringify(entry));
  } catch (e) {
    // Quota exceeded: keep only latest profiles in localStorage
  }

  // 2. Save to IndexedDB for large 400+ post archives in Mobile & APK WebView
  try {
    const db = await openCacheDb();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
  } catch {}
}

export async function getProfileFromLocalCache(username: string): Promise<CachedProfileEntry | null> {
  const clean = username.replace(/^@/, '').trim().toLowerCase();
  if (!clean) return null;

  // 1. Check IndexedDB first (can hold full 500+ post sets)
  try {
    const db = await openCacheDb();
    if (db) {
      const idbResult = await new Promise<CachedProfileEntry | null>((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(clean);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (idbResult && idbResult.profile && Array.isArray(idbResult.posts) && idbResult.posts.length > 0) {
        return idbResult;
      }
    }
  } catch {}

  // 2. Fallback to localStorage
  try {
    const raw = localStorage.getItem(`${LOCAL_CACHE_PREFIX}${clean}`);
    if (raw) {
      const parsed = JSON.parse(raw) as CachedProfileEntry;
      if (parsed && parsed.profile && Array.isArray(parsed.posts) && parsed.posts.length > 0) {
        return parsed;
      }
    }
  } catch {}

  return null;
}

export async function clearLocalProfileCache(): Promise<void> {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LOCAL_CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}

  try {
    const db = await openCacheDb();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
  } catch {}
}

export async function verifySessionProfileCheck(
  cookieInput: string,
  targetUsername = 'instagram'
): Promise<{
  valid: boolean;
  statusCode: number;
  message: string;
  user?: string;
  detectedCookies?: string[];
}> {
  const cleaned = (cookieInput || '').trim();
  if (!cleaned) {
    return {
      valid: false,
      statusCode: 401,
      message: 'Oturum bilgisi geçersiz veya süresi dolmuş',
    };
  }

  try {
    const params = new URLSearchParams({
      username: targetUsername || 'instagram',
    });
    const res = await fetch(`/api/user-profile-check?${params.toString()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'x-ig-session-id': cleaned,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403 || res.status === 404 || !res.ok || !data.valid) {
      return {
        valid: false,
        statusCode: data.statusCode || res.status || 401,
        message: 'Oturum bilgisi geçersiz veya süresi dolmuş',
      };
    }
    return {
      valid: true,
      statusCode: 200,
      message: data.message || 'Oturum bilgisi doğrulandı ve aktif.',
      user: data.user,
      detectedCookies: data.detectedCookies,
    };
  } catch {
    return {
      valid: false,
      statusCode: 401,
      message: 'Oturum bilgisi geçersiz veya süresi dolmuş',
    };
  }
}

// Universal Live Instagram Profile and Posts Fetcher (Cookie-Free Mobile/APK + Local Cache + 429 Countdown + Guaranteed Recovery)
export async function fetchUserFeedAsync(
  username: string,
  forceRefresh = false,
  sessionId = '',
  maxRetries = 1,
  signal?: AbortSignal,
  retryAfterCooldown = false
): Promise<{
  profile: UserProfile;
  posts: InstagramPost[];
  isLive: boolean;
  fromLocalCache?: boolean;
  cachedAt?: string;
  pageInfo?: any;
  requireSession?: boolean;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
  error?: string;
}> {
  const cleanUsername = username
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();

  if (!cleanUsername) {
    return {
      profile: {
        username: '',
        fullName: '',
        avatarUrl: '',
        bio: '',
        postsCount: 0,
        followersCount: 0,
        followingCount: 0,
        isVerified: false,
        isPrivate: false,
        isRealInstagramData: false,
      },
      posts: [],
      isLive: false,
      error: 'Lütfen geçerli bir Instagram kullanıcı adı girin.',
    };
  }

  // 1. Check Local IndexedDB / localStorage Cache first when forceRefresh is false
  if (!forceRefresh) {
    const cached = await getProfileFromLocalCache(cleanUsername);
    if (cached && cached.posts.length > 0) {
      return {
        profile: {
          ...cached.profile,
          avatarUrl: cached.profile.avatarUrl || getInitialsAvatar(cached.profile.fullName, cleanUsername),
          pageInfo: cached.pageInfo || cached.profile.pageInfo,
          isRealInstagramData: true,
        },
        posts: cached.posts,
        isLive: false,
        fromLocalCache: true,
        cachedAt: cached.cachedAt,
        pageInfo: cached.pageInfo || cached.profile.pageInfo,
      };
    }
  }

  let lastErrorMessage = '';
  let wasRateLimited = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const queryParams = new URLSearchParams();
      if (forceRefresh && attempt === 0) {
        queryParams.set('force', 'true');
      }
      // Session cookies must only travel in a request header, never in URLs/logs/referrers.
      if (retryAfterCooldown) {
        queryParams.set('retryAfterCooldown', '1');
      }

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const url = `/api/instagram/profile/${encodeURIComponent(cleanUsername)}${queryString}`;
      // Public-profile mode never transmits personal session cookies or IDs.
      const res = await fetch(url, { signal });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.profile) {
        const normalizedProfile: UserProfile = {
          ...data.profile,
          avatarUrl: data.profile.avatarUrl || getInitialsAvatar(data.profile.fullName, cleanUsername),
          pageInfo: data.pageInfo || data.profile.pageInfo,
          isRealInstagramData: true,
        };
        const normalizedPosts: InstagramPost[] = Array.isArray(data.posts) ? data.posts : [];

        // Save to LocalStorage / IndexedDB cache automatically if posts exist
        if (normalizedPosts.length > 0) {
          await saveProfileToLocalCache(cleanUsername, normalizedProfile, normalizedPosts, data.pageInfo || data.profile.pageInfo);
        }

        return {
          profile: normalizedProfile,
          posts: normalizedPosts,
          isLive: !data.isFromCache,
          fromLocalCache: false,
          pageInfo: data.pageInfo || data.profile.pageInfo,
        };
      }

      if (res.status === 429 || data.rateLimited) {
        wasRateLimited = true;
      }

      lastErrorMessage =
        data.error ||
        `Instagram '@${cleanUsername}' sorgusunda hız sınırı (HTTP ${res.status || 429}) oluştu.`;

      // Respect rate limits: never automatically retry HTTP 429.
      if ((res.status === 502 || res.status === 503) && attempt < maxRetries) {
        await delay((attempt + 1) * 900);
        continue;
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        throw err;
      }
      lastErrorMessage = err.message || 'Ağ bağlantı hatası';
      if (attempt < maxRetries) {
        await delay(800);
        continue;
      }
    }
  }

  // Fallback to local cache if live network call hit HTTP 429 rate limit
  const fallbackCached = await getProfileFromLocalCache(cleanUsername);
  if (fallbackCached && fallbackCached.posts.length > 0) {
    return {
      profile: {
        ...fallbackCached.profile,
        avatarUrl: fallbackCached.profile.avatarUrl || getInitialsAvatar(fallbackCached.profile.fullName, cleanUsername),
        pageInfo: fallbackCached.pageInfo || fallbackCached.profile.pageInfo,
        isRealInstagramData: true,
      },
      posts: fallbackCached.posts,
      isLive: false,
      fromLocalCache: true,
      cachedAt: fallbackCached.cachedAt,
      pageInfo: fallbackCached.pageInfo || fallbackCached.profile.pageInfo,
      rateLimited: retryAfterCooldown ? false : wasRateLimited,
      retryAfterSeconds: retryAfterCooldown ? undefined : (wasRateLimited ? 30 : undefined),
      error: wasRateLimited
        ? `Instagram hız sınırı (HTTP 429) nedeniyle @${cleanUsername} verileri yerel önbellekten yüklendi.`
        : undefined,
    };
  }


  return {
    profile: {
      username: cleanUsername,
      fullName: `@${cleanUsername}`,
      avatarUrl: getInitialsAvatar(cleanUsername, cleanUsername),
      bio: '',
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      isVerified: false,
      isPrivate: false,
      isRealInstagramData: false,
    },
    posts: [],
    isLive: false,
    requireSession: false,
    rateLimited: true,
    retryAfterSeconds: 30,
    error:
      lastErrorMessage ||
      `Instagram '@${cleanUsername}' sorgusunda geçici hız sınırı (HTTP 429) oluştu. 30 saniye içinde otomatik tekrar denenecektir.`,
  };
}

export function generateUserFeed(username: string): { profile: UserProfile; posts: InstagramPost[] } {
  const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
  return {
    profile: {
      username: cleanUsername,
      fullName: cleanUsername ? `@${cleanUsername}` : '',
      avatarUrl: cleanUsername ? getInitialsAvatar(cleanUsername, cleanUsername) : '',
      bio: '',
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      isVerified: false,
      isPrivate: false,
      isRealInstagramData: false,
    },
    posts: [],
  };
}

export function groupPostsByDate(posts: InstagramPost[], sortOrder: 'desc' | 'asc' = 'desc'): DateGroup[] {
  const groupsMap: { [dateKey: string]: { displayDate: string; posts: InstagramPost[]; totalMediaCount: number } } = {};

  for (const post of posts) {
    if (!groupsMap[post.dateKey]) {
      groupsMap[post.dateKey] = {
        displayDate: post.dateFormatted,
        posts: [],
        totalMediaCount: 0,
      };
    }
    groupsMap[post.dateKey].posts.push(post);
    groupsMap[post.dateKey].totalMediaCount += post.mediaCount;
  }

  const sortedDateKeys = Object.keys(groupsMap).sort((a, b) => {
    return sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
  });

  return sortedDateKeys.map(key => {
    const group = groupsMap[key];
    group.posts.sort((p1, p2) => {
      const time1 = p1.timeFormatted;
      const time2 = p2.timeFormatted;
      return sortOrder === 'desc' ? time2.localeCompare(time1) : time1.localeCompare(time2);
    });

    return {
      dateKey: key,
      displayDate: group.displayDate,
      posts: group.posts,
      totalMediaCount: group.totalMediaCount,
    };
  });
}

export function parseSinglePostUrl(url: string): InstagramPost | null {
  const cleanUrl = url.trim();
  if (!cleanUrl) return null;

  const shortcodeMatch = cleanUrl.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!shortcodeMatch) return null;

  const isReel = shortcodeMatch[1] === 'reel' || shortcodeMatch[1] === 'reels';
  const shortcode = shortcodeMatch[2];
  const now = new Date();
  const dateInfo = formatTurkishDate(now);

  const directMediaUrl = `https://www.instagram.com/p/${shortcode}/media/?size=l`;
  const proxiedUrl = `/api/proxy-media?url=${encodeURIComponent(directMediaUrl)}`;

  const mediaList: MediaItem[] = [
    {
      id: `${shortcode}_1`,
      type: isReel ? 'video' : 'image',
      url: proxiedUrl,
      originalUrl: directMediaUrl,
      thumbnailUrl: proxiedUrl,
    }
  ];

  return {
    id: `post_${shortcode}`,
    shortcode,
    username: 'instagram',
    userFullName: 'Instagram Gönderisi',
    userAvatar: getInitialsAvatar('IG', 'IG'),
    caption: `Instagram Gönderisi (${shortcode}) — ${cleanUrl}`,
    timestamp: now.toISOString(),
    dateKey: dateInfo.key,
    dateFormatted: dateInfo.formatted,
    timeFormatted: dateInfo.time,
    isCarousel: false,
    mediaCount: 1,
    media: mediaList,
    likesCount: 0,
    commentsCount: 0,
    postUrl: `https://www.instagram.com/p/${shortcode}/`,
    isVideo: isReel,
  };
}

export async function fetchNextUserFeedPageAsync(
  username: string,
  userId: string,
  maxId: string,
  sessionId = '',
  signal?: AbortSignal
): Promise<{ success: boolean; posts: InstagramPost[]; pageInfo?: any; requireSession?: boolean; rateLimited?: boolean; error?: string }> {
  const cleanUsername = username
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();

  try {
    const queryParams = new URLSearchParams({
      userId,
      maxId,
    });
    const url = `/api/instagram/profile/${encodeURIComponent(cleanUsername)}/paginate?${queryParams.toString()}`;
    // Pagination also stays credential-free.
    const res = await fetch(url, { signal });
    const data = await res.json();
    if (res.status === 429) {
      data.rateLimited = true;
    }
    return data;
  } catch (err: any) {
    if (err.name === 'AbortError' || signal?.aborted) {
      throw err;
    }
    return {
      success: false,
      posts: [],
      error: err.message || 'Sayfa yüklenirken hata oluştu'
    };
  }
}

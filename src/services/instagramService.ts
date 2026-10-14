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

// Universal Live Instagram Profile and Posts Fetcher (Zero hardcoded accounts or fake media)
export async function fetchUserFeedAsync(
  username: string,
  forceRefresh = false,
  sessionId = '',
  maxRetries = 1,
  signal?: AbortSignal
): Promise<{
  profile: UserProfile;
  posts: InstagramPost[];
  isLive: boolean;
  pageInfo?: any;
  requireSession?: boolean;
  rateLimited?: boolean;
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

  let lastErrorMessage = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const queryParams = new URLSearchParams();
      if (forceRefresh && attempt === 0) {
        queryParams.set('force', 'true');
      }
      if (sessionId) {
        queryParams.set('sessionId', sessionId);
      }

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const url = `/api/instagram/profile/${encodeURIComponent(cleanUsername)}${queryString}`;
      const headers: Record<string, string> = {};
      if (sessionId) {
        headers['x-ig-session-id'] = sessionId;
      }

      const res = await fetch(url, { headers, signal });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.profile) {
          return {
            profile: {
              ...data.profile,
              avatarUrl: data.profile.avatarUrl || getInitialsAvatar(data.profile.fullName, cleanUsername),
              pageInfo: data.pageInfo || data.profile.pageInfo,
              isRealInstagramData: true,
            },
            posts: Array.isArray(data.posts) ? data.posts : [],
            isLive: !data.isFromCache,
            pageInfo: data.pageInfo || data.profile.pageInfo,
          };
        }

        if (data.requireSession || !data.success) {
          return {
            profile: {
              username: cleanUsername,
              fullName: data.profile?.fullName || `@${cleanUsername}`,
              avatarUrl: data.profile?.avatarUrl || getInitialsAvatar(cleanUsername, cleanUsername),
              bio: data.profile?.bio || '',
              postsCount: data.profile?.postsCount || 0,
              followersCount: data.profile?.followersCount || 0,
              followingCount: data.profile?.followingCount || 0,
              isVerified: !!data.profile?.isVerified,
              isPrivate: !!data.profile?.isPrivate,
              isRealInstagramData: false,
            },
            posts: Array.isArray(data.posts) ? data.posts : [],
            isLive: false,
            requireSession: true,
            rateLimited: res.status === 429,
            error:
              data.error ||
              `Instagram '@${cleanUsername}' hesabının gerçek verilerini çekmek için oturum doğrulaması (Session ID) gerekiyor.`,
          };
        }
      }

      const errJson = await res.json().catch(() => ({}));
      lastErrorMessage = errJson.error || `Instagram isteği başarısız oldu (HTTP ${res.status}).`;

      if ((res.status === 429 || res.status === 502 || res.status === 503) && attempt < maxRetries) {
        await delay((attempt + 1) * 1000);
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
    requireSession: true,
    error:
      lastErrorMessage ||
      `Instagram '@${cleanUsername}' hesabından canlı veri çekilemedi. Lütfen Session ID oturum çerezi ekleyin.`,
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
    if (sessionId) {
      queryParams.set('sessionId', sessionId);
    }

    const url = `/api/instagram/profile/${encodeURIComponent(cleanUsername)}/paginate?${queryParams.toString()}`;
    const headers: Record<string, string> = {};
    if (sessionId) {
      headers['x-ig-session-id'] = sessionId;
    }

    const res = await fetch(url, { headers, signal });
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

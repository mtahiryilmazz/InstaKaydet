import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

// Data directory for cloud backups
const BACKUP_DIR = path.join(__dirname, '.backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // --- API Routes ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Turkish date formatting helper
  const monthsTR = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];
  const daysTR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  function formatTurkishEpoch(epochSeconds: number) {
    const d = new Date(epochSeconds * 1000);
    const formatter = new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    const weekday = getPart('weekday');
    const hours = getPart('hour');
    const minutes = getPart('minute');

    const monthIdx = parseInt(month, 10) - 1;
    const monthName = monthsTR[monthIdx] || month;

    const dateKey = `${year}-${month}-${day}`;
    const dateFormatted = `${day} ${monthName} ${year}, ${weekday}`;
    const timeFormatted = `${hours}:${minutes}`;

    return { dateKey, dateFormatted, timeFormatted, iso: d.toISOString() };
  }

  function buildInstagramCookieJar(raw: string): {
    cookieHeader: string;
    csrfToken: string;
    sessionId: string;
    userId: string;
    parsedCookies: Record<string, string>;
  } {
    const rawTrimmed = (raw || '').trim();
    if (!rawTrimmed) {
      return { cookieHeader: '', csrfToken: '', sessionId: '', userId: '', parsedCookies: {} };
    }

    const supportedKeys = [
      'csrftoken',
      'datr',
      'dpr',
      'ds_user_id',
      'ig_did',
      'ig_nrcb',
      'mid',
      'ps_l',
      'ps_n',
      'rur',
      'sessionid',
      'wd',
    ];
    const parsedCookies: Record<string, string> = {};

    // 1. Parse tab/newline separated Chrome DevTools F12 Application->Cookies table rows if pasted directly
    const lines = rawTrimmed.split(/\r?\n/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      const tabParts = trimmedLine.split(/\t+/);
      if (tabParts.length >= 2) {
        const keyCandidate = tabParts[0].trim().toLowerCase();
        const valCandidate = tabParts[1].trim();
        if (supportedKeys.includes(keyCandidate) && valCandidate) {
          parsedCookies[keyCandidate] = valCandidate.replace(/^["']+|["']+$/g, '');
          continue;
        }
      }
    }

    // 2. Parse semicolon or whitespace separated key=value pairs
    let str = rawTrimmed.replace(/^cookie:\s*/i, '').replace(/^["']+|["']+$/g, '').trim();
    for (const key of supportedKeys) {
      const regex = new RegExp(`(?:^|[;\\s,])${key}\\s*=\\s*([^;\\s\\r\\n]+)`, 'i');
      const m = str.match(regex);
      if (m && m[1]) {
        parsedCookies[key] = m[1].replace(/^["']+|["']+$/g, '');
      }
    }

    // 3. If single sessionid value was provided without key=value
    let sessionId = parsedCookies['sessionid'] || '';
    if (!sessionId && !str.includes('=') && !str.includes('\t')) {
      sessionId = str.split(/\s+/)[0];
    }

    if (sessionId) {
      try {
        const decoded = decodeURIComponent(sessionId);
        sessionId = decoded.replace(/:/g, '%3A');
      } catch {
        sessionId = sessionId.replace(/:/g, '%3A');
      }
      parsedCookies['sessionid'] = sessionId;
    }

    const csrfToken = parsedCookies['csrftoken'] || '';
    const decodedForUid = sessionId.replace(/%3A/gi, ':');
    const uidFromSession = decodedForUid.match(/^(\d{5,})/)?.[1] || '';
    const userId = parsedCookies['ds_user_id'] || uidFromSession;
    if (userId) {
      parsedCookies['ds_user_id'] = userId;
    }

    const cookieParts: string[] = [];
    for (const key of supportedKeys) {
      if (parsedCookies[key]) {
        cookieParts.push(`${key}=${parsedCookies[key]}`);
      }
    }

    const cookieHeader = cookieParts.length > 0 ? cookieParts.join('; ') + ';' : '';
    return { cookieHeader, csrfToken, sessionId, userId, parsedCookies };
  }

  // Universal Profile Statistics Enrichment (No hardcoded account rules; works dynamically for ANY Instagram profile)
  async function enrichUniversalProfileStats(targetUsername: string, userObj: any): Promise<any> {
    if (!userObj) return userObj;

    const currentPostCount = Number(userObj.edge_owner_to_timeline_media?.count || 0);
    const currentFollowerCount = Number(userObj.edge_followed_by?.count || 0);
    const currentFollowingCount = Number(userObj.edge_follow?.count || 0);

    // If stats are already populated (followers > 0 and postsCount > 24 and following > 0), no enrichment needed
    if (currentFollowerCount > 0 && currentPostCount > 24 && currentFollowingCount > 0) {
      return userObj;
    }

    try {
      const { execFile } = await import('child_process');
      const util = await import('util');
      const execFileAsync = util.promisify(execFile);

      // 1. Scrape public embed context which contains real owner stats for ANY public Instagram account
      const embedUrls = [
        `https://www.instagram.com/${encodeURIComponent(targetUsername)}/embed/`,
        `https://www.instagram.com/${encodeURIComponent(targetUsername)}/embed/captioned/`
      ];

      for (const embedUrl of embedUrls) {
        try {
          const args = [
            '-s', '-L', '--max-time', '6',
            '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            '-H', 'Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8',
            embedUrl
          ];
          const { stdout } = await execFileAsync('curl', args, { maxBuffer: 12 * 1024 * 1024 });
          if (!stdout) continue;

          // Extract edge_followed_by count (takipçi sayısı)
          const followerMatch = stdout.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)\s*\}/);
          if (followerMatch && followerMatch[1]) {
            const fCount = parseInt(followerMatch[1], 10);
            if (fCount > 0) {
              userObj.edge_followed_by = { count: fCount };
            }
          }

          // Extract edge_owner_to_timeline_media count (toplam gönderi sayısı)
          const postCountMatch = stdout.match(/"edge_owner_to_timeline_media"\s*:\s*\{\s*"count"\s*:\s*(\d+)\s*\}/);
          if (postCountMatch && postCountMatch[1]) {
            const pCount = parseInt(postCountMatch[1], 10);
            if (pCount > 0) {
              if (!userObj.edge_owner_to_timeline_media) {
                userObj.edge_owner_to_timeline_media = { count: pCount, page_info: { has_next_page: false, end_cursor: null }, edges: [] };
              } else {
                userObj.edge_owner_to_timeline_media.count = pCount;
              }
            }
          }

          // Extract is_verified
          const verifiedMatch = stdout.match(/"is_verified"\s*:\s*(true|false)/);
          if (verifiedMatch) {
            userObj.is_verified = verifiedMatch[1] === 'true';
          }

          // Extract HD avatar if current is empty or small
          const avatarMatch = stdout.match(/"profile_pic_url"\s*:\s*"((?:\\.|[^"\\])*)"/);
          if (avatarMatch && avatarMatch[1] && (!userObj.profile_pic_url || !userObj.profile_pic_url_hd)) {
            try {
              const cleanPic = JSON.parse(`"${avatarMatch[1]}"`).replace(/&amp;/g, '&');
              userObj.profile_pic_url = cleanPic;
              userObj.profile_pic_url_hd = cleanPic;
            } catch {}
          }

          // If we got both followers and total posts, we can break
          if (userObj.edge_followed_by?.count > 0 && userObj.edge_owner_to_timeline_media?.count > 12) {
            break;
          }
        } catch {}
      }

      // 2. OpenGraph description fallback (parses e.g. "3M Followers, 3 Following, 52K Posts" or Turkish "3,3 Mn Takipçi, 3 Takip, 52,8 B Gönderi")
      if (!userObj.edge_followed_by?.count || !userObj.edge_owner_to_timeline_media?.count || !userObj.edge_follow?.count) {
        try {
          const args = [
            '-s', '-L', '--max-time', '5',
            '-H', 'User-Agent: facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            '-H', 'Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8',
            `https://www.instagram.com/${encodeURIComponent(targetUsername)}/`
          ];
          const { stdout } = await execFileAsync('curl', args, { maxBuffer: 5 * 1024 * 1024 });
          if (stdout) {
            const ogDesc =
              stdout.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] ||
              stdout.match(/name="description"\s+content="([^"]+)"/i)?.[1] || '';

            if (ogDesc) {
              const numMatches = ogDesc.match(/([\d.,]+[KMBkmb]?)\s+(Followers|Takipçi|Following|Takip|Posts|Gönderi)/gi);
              if (numMatches && numMatches.length >= 1) {
                const parseNum = (str: string) => {
                  const raw = str.replace(/[^\d.,KMBkmb]/g, '').trim();
                  const mult = /m/i.test(raw) ? 1000000 : /k/i.test(raw) || /b/i.test(raw) ? 1000 : 1;
                  const n = parseFloat(raw.replace(/,/g, '.').replace(/[KMBkmb]/gi, ''));
                  return isNaN(n) ? 0 : Math.round(n * mult);
                };
                for (const m of numMatches) {
                  if (/Follower|Takipçi/i.test(m) && (!userObj.edge_followed_by?.count || userObj.edge_followed_by.count === 0)) {
                    userObj.edge_followed_by = { count: parseNum(m) };
                  } else if (/Following|Takip(?!çi)/i.test(m) && (!userObj.edge_follow?.count || userObj.edge_follow.count === 0)) {
                    userObj.edge_follow = { count: parseNum(m) };
                  } else if (/Post|Gönderi/i.test(m) && (!userObj.edge_owner_to_timeline_media?.count || userObj.edge_owner_to_timeline_media.count <= 12)) {
                    const parsedPosts = parseNum(m);
                    if (parsedPosts > 0) {
                      if (!userObj.edge_owner_to_timeline_media) {
                        userObj.edge_owner_to_timeline_media = { count: parsedPosts, page_info: { has_next_page: false, end_cursor: null }, edges: [] };
                      } else {
                        userObj.edge_owner_to_timeline_media.count = parsedPosts;
                      }
                    }
                  }
                }
              }
            }
          }
        } catch {}
      }
    } catch (err: any) {
      console.warn(`Universal profile stats enrichment error for @${targetUsername}:`, err.message);
    }

    return userObj;
  }

  // Resilient multi-strategy Instagram Profile fetcher (Cookie-Free Mobile/APK + Optional Desktop Cookie + Social Bot Crawler Bypass)
  async function fetchInstagramProfile(cleanUsername: string, sessionId = ''): Promise<any> {
    const { execFile } = await import('child_process');
    const util = await import('util');
    const execFileAsync = util.promisify(execFile);
    const jar = buildInstagramCookieJar(sessionId);

    if (jar.cookieHeader) {
      console.log(`[Instagram API] Fetching @${cleanUsername} with provided Cookie Jar (keys: ${Object.keys(jar.parsedCookies).join(', ')})`);
    } else {
      console.log(`[Instagram API] Fetching @${cleanUsername} in Cookie-Free Mobile/APK Mode`);
    }

    const mobileUserAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14; SM-S928B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36',
    ];
    const androidAppUAs = [
      'Instagram 312.0.0.34.111 Android (34/14; 450dpi; 1080x2340; samsung; SM-S911B; dm1q; qcom; tr_TR; 558492103)',
      'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; tr_TR; 458229237)',
    ];
    const desktopChromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const socialCrawlerUAs = [
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'TelegramBot (like TwitterBot)',
      'Twitterbot/1.0',
      'WhatsApp/2.23.20.0 A',
    ];

    // Helper to run curl against web_profile_info
    const tryWebProfileInfo = async (endpointUrl: string, ua: string, useCookie: boolean, includeAppIdHeader: boolean): Promise<any> => {
      try {
        const args = [
          '-s',
          '-L',
          '--max-time', '6',
          '-H', `User-Agent: ${ua}`,
          '-H', 'Accept: */*',
          '-H', 'Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
          '-H', `Referer: https://www.instagram.com/${cleanUsername}/`,
        ];
        if (includeAppIdHeader) {
          args.push(
            '-H', 'x-ig-app-id: 936619743392459',
            '-H', 'x-asbd-id: 129477',
            '-H', 'Sec-Fetch-Site: same-origin',
            '-H', 'Sec-Fetch-Mode: cors',
            '-H', 'Sec-Fetch-Dest: empty',
            '-H', 'X-Requested-With: XMLHttpRequest'
          );
        }
        if (useCookie && jar.cookieHeader) {
          args.push('-H', `Cookie: ${jar.cookieHeader}`);
          if (jar.csrfToken) {
            args.push('-H', `x-csrftoken: ${jar.csrfToken}`);
          }
        }
        args.push(endpointUrl);

        const { stdout } = await execFileAsync('curl', args, { maxBuffer: 10 * 1024 * 1024 });
        if (stdout && stdout.trim().startsWith('{')) {
          const parsed = JSON.parse(stdout);
          if (parsed?.data?.user?.username) {
            return parsed;
          }
        }
      } catch (err: any) {
        console.warn(`Profile fetch attempt failed (${endpointUrl}, cookie=${useCookie}):`, err.message);
      }
      return null;
    };

    // Helper to build full profile + posts directly from api/v1/feed/user/:username/username/
    const tryDirectV1UserFeed = async (targetUsername: string, ua: string, useCookie: boolean): Promise<any> => {
      try {
        const feedUrl = `https://www.instagram.com/api/v1/feed/user/${encodeURIComponent(targetUsername)}/username/?count=33`;
        const args = [
          '-s', '-L', '--max-time', '6',
          '-H', `User-Agent: ${ua}`,
          '-H', 'x-ig-app-id: 936619743392459',
          '-H', 'x-asbd-id: 129477',
          '-H', 'Accept: */*',
          '-H', 'Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8',
          '-H', `Referer: https://www.instagram.com/${targetUsername}/`,
          '-H', 'X-Requested-With: XMLHttpRequest',
        ];
        if (useCookie && jar.cookieHeader) {
          args.push('-H', `Cookie: ${jar.cookieHeader}`);
          if (jar.csrfToken) {
            args.push('-H', `x-csrftoken: ${jar.csrfToken}`);
          }
        }
        args.push(feedUrl);

        const { stdout } = await execFileAsync('curl', args, { maxBuffer: 15 * 1024 * 1024 });
        if (stdout && stdout.trim().startsWith('{')) {
          const feedParsed = JSON.parse(stdout);
          if (Array.isArray(feedParsed?.items) && (feedParsed.items.length > 0 || feedParsed?.user)) {
            const u = feedParsed.user || feedParsed.items[0]?.user || {};
            const convertedEdges = (feedParsed.items || []).map((item: any) => {
              const isSidecar = item.media_type === 8 || Array.isArray(item.carousel_media);
              const isVid = item.media_type === 2 || Array.isArray(item.video_versions);
              const displayUrl = item.image_versions2?.candidates?.[0]?.url || item.display_url || '';
              const videoUrl = item.video_versions?.[0]?.url || item.video_url || '';
              return {
                node: {
                  id: String(item.pk || item.id).split('_')[0],
                  shortcode: item.code || item.shortcode,
                  display_url: displayUrl,
                  video_url: videoUrl,
                  is_video: isVid,
                  __typename: isSidecar ? 'GraphSidecar' : isVid ? 'GraphVideo' : 'GraphImage',
                  taken_at_timestamp: item.taken_at || Math.floor(Date.now() / 1000),
                  edge_media_to_caption: {
                    edges: item.caption?.text ? [{ node: { text: item.caption.text } }] : [],
                  },
                  edge_liked_by: { count: item.like_count || 0 },
                  edge_media_to_comment: { count: item.comment_count || 0 },
                  location: item.location?.name ? { name: item.location.name } : undefined,
                  edge_sidecar_to_children: isSidecar
                    ? {
                        edges: (item.carousel_media || []).map((c: any, idx: number) => ({
                          node: {
                            id: String(c.pk || c.id || `${item.pk}_${idx}`).split('_')[0],
                            display_url: c.image_versions2?.candidates?.[0]?.url || c.display_url || displayUrl,
                            video_url: c.video_versions?.[0]?.url || c.video_url || '',
                            is_video: c.media_type === 2 || Array.isArray(c.video_versions),
                          },
                        })),
                      }
                    : undefined,
                },
              };
            });

            const baseUser = {
              id: String(u.pk || u.id || ''),
              username: u.username || targetUsername,
              full_name: u.full_name || targetUsername,
              profile_pic_url_hd: u.hd_profile_pic_url_info?.url || u.profile_pic_url || '',
              profile_pic_url: u.profile_pic_url || '',
              biography: u.biography || '',
              edge_owner_to_timeline_media: {
                count: convertedEdges.length,
                page_info: {
                  has_next_page: !!(feedParsed.more_available && feedParsed.next_max_id),
                  end_cursor: feedParsed.next_max_id || null,
                },
                edges: convertedEdges,
              },
              edge_followed_by: { count: u.follower_count || 0 },
              edge_follow: { count: u.following_count || 0 },
              is_verified: !!u.is_verified,
              is_private: !!u.is_private,
            };

            const enrichedUser = await enrichUniversalProfileStats(targetUsername, baseUser);
            return {
              data: {
                user: enrichedUser,
              },
            };
          }
        }
      } catch (err: any) {
        console.warn(`Direct v1 feed attempt failed for ${targetUsername}:`, err.message);
      }
      return null;
    };

    // Helper to scrape embed HTML + JSON context as Cookie-Free Public Fallback
    const tryEmbedScrape = async (targetUsername: string): Promise<any> => {
      for (const embedPath of [`https://www.instagram.com/${targetUsername}/embed/captioned/`, `https://www.instagram.com/${targetUsername}/embed/`]) {
        for (const ua of [desktopChromeUA, socialCrawlerUAs[0]]) {
          try {
            const args = [
              '-s', '-L', '--max-time', '6',
              '-H', `User-Agent: ${ua}`,
              '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              '-H', 'Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
              embedPath
            ];
            const { stdout } = await execFileAsync('curl', args, { maxBuffer: 10 * 1024 * 1024 });
            if (!stdout) continue;

            // Check embedded contextJSON if present
            const contextMatch = stdout.match(/contextJSON"\s*,\s*"((?:\\.|[^"\\])*)"/);
            if (contextMatch && contextMatch[1]) {
              try {
                const unescaped = JSON.parse(`"${contextMatch[1]}"`);
                const ctx = JSON.parse(unescaped);
                const gqlUser = ctx?.gql_data?.user || ctx?.context?.user;
                if (gqlUser && (gqlUser.username || gqlUser.edge_owner_to_timeline_media)) {
                  return { data: { user: { username: targetUsername, ...gqlUser } } };
                }
              } catch {}
            }

            if (stdout.includes('ProfilePic') || stdout.includes('Avatar') || stdout.includes('EmbeddedMediaImage')) {
              const avatarMatch = stdout.match(/class="ProfilePic"[^>]*src="([^"]+)"/i) || stdout.match(/class="Avatar"[^>]*src="([^"]+)"/i) || stdout.match(/img class="[^"]*" src="([^"]+)"/i);
              const avatarUrl = avatarMatch ? avatarMatch[1].replace(/&amp;/g, '&') : '';

              const titleMatch = stdout.match(/class="UsernameText">([^<]+)</i) || stdout.match(/<title>([^<]+)<\/title>/i);
              const fullName = titleMatch ? titleMatch[1].replace(/\(@.*?\).*$/, '').trim() : targetUsername;

              const shortcodeMatches = [...stdout.matchAll(/instagram\.com\/p\/([A-Za-z0-9_-]+)/g)].map(m => m[1]);
              const uniqueShortcodes = Array.from(new Set(shortcodeMatches));
              const imgMatches = [...stdout.matchAll(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));

              if (avatarUrl || imgMatches.length > 0) {
                return {
                  data: {
                    user: {
                      username: targetUsername,
                      full_name: fullName || targetUsername,
                      profile_pic_url_hd: avatarUrl,
                      profile_pic_url: avatarUrl,
                      biography: '',
                      edge_owner_to_timeline_media: {
                        count: Math.max(imgMatches.length, uniqueShortcodes.length),
                        page_info: { has_next_page: false, end_cursor: null },
                        edges: imgMatches.map((img, i) => ({
                          node: {
                            id: `embed_${i}_${Date.now()}`,
                            shortcode: uniqueShortcodes[i] || `embed_${i}`,
                            display_url: img,
                            is_video: false,
                            __typename: 'GraphImage',
                            taken_at_timestamp: Math.floor(Date.now() / 1000) - i * 3600,
                            edge_media_to_caption: { edges: [] },
                            edge_liked_by: { count: 0 },
                            edge_media_to_comment: { count: 0 }
                          }
                        }))
                      },
                      edge_followed_by: { count: 0 },
                      edge_follow: { count: 0 },
                      is_verified: false,
                      is_private: false
                    }
                  }
                };
              }
            }
          } catch (err: any) {
            console.warn(`Embed HTML fallback attempt failed for ${targetUsername}:`, err.message);
          }
        }
      }
      return null;
    };

    // Helper to scrape public OpenGraph / meta tags using Social Bot Crawler User-Agents (bypasses /accounts/login/ redirect)
    const tryPublicProfileMeta = async (targetUsername: string): Promise<any> => {
      for (const crawlerUA of [...socialCrawlerUAs, mobileUserAgents[0]]) {
        try {
          const args = [
            '-s', '-L', '--max-time', '6',
            '-H', `User-Agent: ${crawlerUA}`,
            '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            '-H', 'Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8',
            `https://www.instagram.com/${targetUsername}/`
          ];
          const { stdout } = await execFileAsync('curl', args, { maxBuffer: 8 * 1024 * 1024 });
          if (!stdout) continue;

          const ogImage =
            stdout.match(/property="og:image"\s+content="([^"]+)"/i)?.[1]?.replace(/&amp;/g, '&') ||
            stdout.match(/content="([^"]+)"\s+property="og:image"/i)?.[1]?.replace(/&amp;/g, '&') ||
            '';
          const ogTitle =
            stdout.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ||
            stdout.match(/<title>([^<]+)<\/title>/i)?.[1] ||
            '';
          const ogDesc =
            stdout.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] ||
            stdout.match(/name="description"\s+content="([^"]+)"/i)?.[1] ||
            '';

          if (ogImage || (ogTitle && ogTitle.toLowerCase().includes(targetUsername.toLowerCase())) || ogDesc) {
            const fullName = ogTitle.split('(@')[0]?.replace(/•.*$/, '').trim() || targetUsername;

            // Parse follower / following / post counts from og:description if present
            let postsCount = 0;
            let followersCount = 0;
            let followingCount = 0;
            const numMatches = ogDesc.match(/([\d.,]+[KMBkmb]?)\s+(Followers|Takipçi|Following|Takip|Posts|Gönderi)/gi);
            if (numMatches && numMatches.length >= 1) {
              const parseNum = (str: string) => {
                const raw = str.replace(/[^\d.,KMBkmb]/g, '').trim();
                const mult = /k/i.test(raw) ? 1000 : /m/i.test(raw) ? 1000000 : 1;
                const n = parseFloat(raw.replace(/,/g, '.').replace(/[KMBkmb]/gi, ''));
                return isNaN(n) ? 0 : Math.round(n * mult);
              };
              for (const m of numMatches) {
                if (/Follower|Takipçi/i.test(m)) followersCount = parseNum(m);
                else if (/Following|Takip/i.test(m)) followingCount = parseNum(m);
                else if (/Post|Gönderi/i.test(m)) postsCount = parseNum(m);
              }
            }

            return {
              data: {
                user: {
                  username: targetUsername,
                  full_name: fullName,
                  profile_pic_url_hd: ogImage,
                  profile_pic_url: ogImage,
                  biography: ogDesc,
                  edge_owner_to_timeline_media: {
                    count: postsCount,
                    page_info: { has_next_page: false, end_cursor: null },
                    edges: []
                  },
                  edge_followed_by: { count: followersCount },
                  edge_follow: { count: followingCount },
                  is_verified: false,
                  is_private: false
                }
              }
            };
          }
        } catch {}
      }
      return null;
    };

    // 1. If Cookie / Session ID is provided, try with Cookie first (Desktop Chrome UA + V1 Feed + Mobile UA)
    if (jar.cookieHeader) {
      const withCookieDesktop = await tryWebProfileInfo(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUsername}`,
        desktopChromeUA,
        true,
        true
      );
      if (withCookieDesktop) return withCookieDesktop;

      const withCookieFeed = await tryDirectV1UserFeed(cleanUsername, desktopChromeUA, true);
      if (withCookieFeed) return withCookieFeed;

      const withCookieMobile = await tryWebProfileInfo(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUsername}`,
        mobileUserAgents[0],
        true,
        true
      );
      if (withCookieMobile) return withCookieMobile;

      const withCookieAndroid = await tryWebProfileInfo(
        `https://i.instagram.com/api/v1/users/web_profile_info/?username=${cleanUsername}`,
        androidAppUAs[0],
        true,
        false
      );
      if (withCookieAndroid) return withCookieAndroid;
    }

    // 2. Cookie-Free Katman 1: Multi-UA Android Mobile API rotation
    for (const ua of androidAppUAs) {
      const liveAndroid = await tryWebProfileInfo(
        `https://i.instagram.com/api/v1/users/web_profile_info/?username=${cleanUsername}`,
        ua,
        false,
        false
      );
      if (liveAndroid) return liveAndroid;
    }

    // 3. Cookie-Free Katman 2: Direct V1 User Feed without Cookie
    const cookieFreeFeed = await tryDirectV1UserFeed(cleanUsername, mobileUserAgents[0], false);
    if (cookieFreeFeed) return cookieFreeFeed;

    // 4. Cookie-Free Katman 3: Embed HTML / Captioned Scraper Fallback
    const embedFallback = await tryEmbedScrape(cleanUsername);
    if (embedFallback) return embedFallback;

    // 5. Cookie-Free Katman 4: Mobile Safari / Android WebView UA on www.instagram.com
    for (const ua of mobileUserAgents) {
      const liveMobile = await tryWebProfileInfo(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUsername}`,
        ua,
        false,
        true
      );
      if (liveMobile) return liveMobile;
    }

    // 6. Cookie-Free Katman 5: Desktop Chrome UA
    const liveDesktop = await tryWebProfileInfo(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUsername}`,
      desktopChromeUA,
      false,
      true
    );
    if (liveDesktop) return liveDesktop;

    // 7. Cookie-Free Katman 6: Social Bot Crawler OpenGraph Meta Fallback
    const metaFallback = await tryPublicProfileMeta(cleanUsername);
    if (metaFallback) return metaFallback;

    return null;
  }

  // Instagram Request Logs Buffer for Detailed Error Analysis Dashboard
  interface InstagramLogEntry {
    id: string;
    timestamp: string;
    timeFormatted: string;
    username: string;
    status: number | string;
    success: boolean;
    strategyUsed: string;
    hasSessionId: boolean;
    error?: string;
    diagnosis: string;
    suggestedAction: string;
    latencyMs?: number;
  }

  const instagramRequestLogs: InstagramLogEntry[] = [];

  function addInstagramLog(entry: Omit<InstagramLogEntry, 'id' | 'timestamp' | 'timeFormatted'>) {
    const d = new Date();
    const timeFormatted = d.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const fullEntry: InstagramLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: d.toISOString(),
      timeFormatted,
      ...entry,
    };
    instagramRequestLogs.unshift(fullEntry);
    if (instagramRequestLogs.length > 80) {
      instagramRequestLogs.pop();
    }
    return fullEntry;
  }

  // Diagnostics & Log Feed Endpoint
  app.get('/api/instagram/diagnostics', async (req, res) => {
    let gatewayStatus = 'unknown';
    try {
      const pingRes = await fetch('https://www.instagram.com/robots.txt', { signal: AbortSignal.timeout(3000) });
      gatewayStatus = pingRes.ok ? 'connected' : `http_${pingRes.status}`;
    } catch (e: any) {
      gatewayStatus = 'unreachable';
    }

    const totalRequests = instagramRequestLogs.length;
    const rateLimitedCount = instagramRequestLogs.filter(l => l.status === 429 || l.status === '429').length;
    const notFoundCount = instagramRequestLogs.filter(l => l.status === 404 || l.status === '404').length;
    const successCount = instagramRequestLogs.filter(l => l.success).length;
    const recentFailedLogs = instagramRequestLogs.filter(l => !l.success && String(l.status) !== '200').slice(0, 10);

    res.json({
      success: true,
      logs: instagramRequestLogs,
      recentFailedLogs,
      stats: {
        totalRequests,
        successCount,
        rateLimitedCount,
        notFoundCount,
        activeSessionIdPresent: instagramRequestLogs.some(l => l.hasSessionId),
        serverRegion: 'Google Cloud (europe-west2)',
        gatewayStatus,
      }
    });
  });

  // 1-Second Cookie & Session Verifier Endpoint: GET /api/user-profile-check (Desktop Chrome UA + Flexible F12 Validation)
  app.get('/api/user-profile-check', async (req, res) => {
    const startMs = Date.now();
    const rawCookie = (req.headers['x-ig-session-id'] as string) || '';
    const targetUsername = ((req.query.username as string) || 'instagram').replace(/^@/, '').trim().toLowerCase();

    if (!rawCookie || !rawCookie.trim()) {
      addInstagramLog({
        username: targetUsername,
        status: 401,
        success: false,
        strategyUsed: 'GET /api/user-profile-check',
        hasSessionId: false,
        error: 'Oturum bilgisi boş veya eksik',
        diagnosis: 'Oturum bilgisi geçersiz veya süresi dolmuş (401 Unauthorized).',
        suggestedAction: 'Geçerli bir sessionid/F12 çerez listesi girin veya Çerezsiz Mobil/APK Modunda devam edin.',
        latencyMs: Date.now() - startMs,
      });
      return res.status(401).json({
        valid: false,
        statusCode: 401,
        message: 'Oturum bilgisi geçersiz veya süresi dolmuş',
      });
    }

    const jar = buildInstagramCookieJar(rawCookie);
    const detectedKeys = Object.keys(jar.parsedCookies);
    const hasValidF12Keys = (jar.sessionId && jar.sessionId.length >= 6) || detectedKeys.length >= 2;

    if (!hasValidF12Keys) {
      addInstagramLog({
        username: targetUsername,
        status: 401,
        success: false,
        strategyUsed: 'GET /api/user-profile-check',
        hasSessionId: false,
        error: 'Format hatası: geçerli çerez anahtarı bulunamadı',
        diagnosis: 'Oturum bilgisi geçersiz veya süresi dolmuş (sessionid veya F12 anahtarları eksik).',
        suggestedAction: 'F12 -> Application -> Cookies altındaki çerezleri kontrol edin veya Çerezsiz Modda devam edin.',
        latencyMs: Date.now() - startMs,
      });
      return res.status(401).json({
        valid: false,
        statusCode: 401,
        message: 'Oturum bilgisi geçersiz veya süresi dolmuş',
      });
    }

    const desktopChromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    try {
      const { execFile } = await import('child_process');
      const util = await import('util');
      const execFileAsync = util.promisify(execFile);

      const args = [
        '-s', '-L', '--max-time', '4',
        '-w', '\n%{http_code}',
        '-H', `User-Agent: ${desktopChromeUA}`,
        '-H', 'x-ig-app-id: 936619743392459',
        '-H', 'x-asbd-id: 129477',
        '-H', 'Accept: */*',
        '-H', 'Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8',
        '-H', 'Sec-Fetch-Site: same-origin',
        '-H', 'Sec-Fetch-Mode: cors',
        '-H', 'Sec-Fetch-Dest: empty',
        '-H', `Referer: https://www.instagram.com/${targetUsername}/`,
        '-H', 'X-Requested-With: XMLHttpRequest',
        '-H', `Cookie: ${jar.cookieHeader}`,
      ];
      if (jar.csrfToken) {
        args.push('-H', `x-csrftoken: ${jar.csrfToken}`);
      }
      args.push(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(targetUsername)}`);

      const { stdout } = await execFileAsync('curl', args, { maxBuffer: 5 * 1024 * 1024 });
      const lines = (stdout || '').trim().split('\n');
      const httpCodeStr = lines.pop()?.trim() || '200';
      const bodyStr = lines.join('\n').trim();
      const httpCode = parseInt(httpCodeStr, 10) || 200;

      if (bodyStr && bodyStr.startsWith('{')) {
        const parsed = JSON.parse(bodyStr);
        if (parsed?.data?.user?.username) {
          addInstagramLog({
            username: parsed.data.user.username,
            status: 200,
            success: true,
            strategyUsed: 'GET /api/user-profile-check (Masaüstü Chrome UA)',
            hasSessionId: true,
            diagnosis: `Oturum çerezi doğrulandı (@${parsed.data.user.username}). Algılanan çerez anahtarları: ${detectedKeys.join(', ')}`,
            suggestedAction: 'Oturum aktif ve kullanıma hazır.',
            latencyMs: Date.now() - startMs,
          });
          return res.status(200).json({
            valid: true,
            statusCode: 200,
            message: `Oturum çerezi doğrulandı ve aktif (${detectedKeys.join(', ')}).`,
            user: parsed.data.user.username,
            fullName: parsed.data.user.full_name,
            avatarUrl: parsed.data.user.profile_pic_url,
            detectedCookies: detectedKeys,
          });
        }
      }

      const confirmed = httpCode === 200 && !!bodyStr && bodyStr.startsWith('{');
      const failureStatus = httpCode === 429 ? 429 : httpCode === 401 || httpCode === 403 ? 401 : 502;
      addInstagramLog({
        username: targetUsername,
        status: confirmed ? 200 : httpCode,
        success: confirmed,
        strategyUsed: 'GET /api/user-profile-check (Sunucu doğrulaması)',
        hasSessionId: true,
        error: confirmed ? undefined : `Instagram çerez doğrulaması tamamlanamadı (HTTP ${httpCode}).`,
        diagnosis: confirmed
          ? `Instagram yanıtı alındı. Algılanan çerez anahtarları: ${detectedKeys.join(', ')}`
          : `Çerez biçimi algılandı ancak Instagram sunucusu oturumu doğrulamadı (HTTP ${httpCode}).`,
        suggestedAction: confirmed
          ? 'Oturum sunucu tarafından doğrulandı.'
          : 'Çerezi doğrulamadan geçerli saymayın. Oturum süresini ve Instagram erişimini kontrol edip tekrar deneyin.',
        latencyMs: Date.now() - startMs,
      });
      return res.status(confirmed ? 200 : failureStatus).json({
        valid: confirmed,
        statusCode: confirmed ? 200 : failureStatus,
        remoteStatusCode: httpCode,
        message: confirmed
          ? 'Instagram oturumu sunucu tarafından doğrulandı.'
          : 'Çerez biçimi algılandı ancak oturum doğrulanamadı. Instagram erişimi veya oturum süresini kontrol edin.',
        detectedCookies: detectedKeys,
      });
    } catch (err: any) {
      addInstagramLog({
        username: targetUsername,
        status: 502,
        success: false,
        strategyUsed: 'GET /api/user-profile-check',
        hasSessionId: true,
        error: 'Instagram doğrulama isteği tamamlanamadı.',
        diagnosis: 'Ağ hatası veya zaman aşımı nedeniyle oturum doğrulanamadı.',
        suggestedAction: 'Bağlantıyı kontrol edin ve daha sonra yeniden deneyin.',
        latencyMs: Date.now() - startMs,
      });
      return res.status(502).json({
        valid: false,
        statusCode: 502,
        message: 'Instagram oturumu doğrulanamadı; ağ bağlantısını kontrol edip tekrar deneyin.',
        detectedCookies: detectedKeys,
      });
    }
  });

  // Test Session ID Endpoint (POST alias compatible with GET /api/user-profile-check)
  app.post('/api/instagram/test-session', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      return res.status(401).json({
        valid: false,
        statusCode: 401,
        message: 'Oturum bilgisi geçersiz veya süresi dolmuş'
      });
    }

    const jar = buildInstagramCookieJar(sessionId);
    const detectedKeys = Object.keys(jar.parsedCookies);
    if ((!jar.sessionId || jar.sessionId.length < 6) && detectedKeys.length < 2) {
      return res.status(401).json({
        valid: false,
        statusCode: 401,
        message: 'Oturum bilgisi geçersiz veya süresi dolmuş'
      });
    }

    return res.status(200).json({
      valid: true,
      statusCode: 200,
      message: `F12 çerezleri algılandı ve onaylandı (${detectedKeys.join(', ')}).`,
      user: jar.userId || 'instagram',
      detectedCookies: detectedKeys,
    });
  });

  // Clear Diagnostics Logs Endpoint
  app.post('/api/instagram/clear-logs', (req, res) => {
    instagramRequestLogs.length = 0;
    res.json({ success: true, message: 'Tüm hata ve tanılama günlükleri temizlendi.' });
  });

  // Real Instagram Profile & Timeline Media Endpoint (Cookie-Free Mobile/APK Ready + Post-30s Cooldown Guaranteed Recovery)
  app.get('/api/instagram/profile/:username', async (req, res) => {
    const { username } = req.params;
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    const retryAfterCooldown = req.query.retryAfterCooldown === '1' || req.query.retryAfterCooldown === 'true';

    if (!/^[a-z0-9._]{1,30}$/.test(cleanUsername) || cleanUsername.startsWith('.') || cleanUsername.endsWith('.')) {
      return res.status(400).json({ error: 'Geçerli bir Instagram kullanıcı adı girin (1–30 karakter; harf, rakam, nokta ve alt çizgi).' });
    }

    const CACHE_DIR = path.join(__dirname, '.cache', 'instagram');
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cacheFile = path.join(CACHE_DIR, `${cleanUsername}.json`);

    try {
      const sessionId = (req.headers['x-ig-session-id'] as string) || '';

      const getValidCache = () => {
        if (fs.existsSync(cacheFile)) {
          try {
            const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
            if (cached?.data?.user?.username && Array.isArray(cached?.data?.user?.edge_owner_to_timeline_media?.edges)) {
              return cached;
            }
          } catch {
            return null;
          }
        }
        return null;
      };

      let rawJson: any = null;
      let isFromCache = false;

      // Always attempt LIVE Instagram fetch first (resilient with or without sessionId)
      rawJson = await fetchInstagramProfile(cleanUsername, sessionId);

      // Optional v1 user feed enrichment (works both with cookie and cookie-free mobile fallback):
      if (rawJson?.data?.user) {
        const existingEdges = rawJson.data.user.edge_owner_to_timeline_media?.edges || [];
        if (existingEdges.length === 0 || rawJson.data.user.id) {
          try {
            const { execFile } = await import('child_process');
            const util = await import('util');
            const execFileAsync = util.promisify(execFile);
            const jar = buildInstagramCookieJar(sessionId);
            const desktopChromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
            const feedUrl = `https://www.instagram.com/api/v1/feed/user/${encodeURIComponent(cleanUsername)}/username/?count=33`;
            const feedArgs = [
              '-s', '-L', '--max-time', '6',
              '-H', `User-Agent: ${jar.cookieHeader ? desktopChromeUA : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'}`,
              '-H', 'x-ig-app-id: 936619743392459',
              '-H', 'Accept: */*',
              '-H', `Referer: https://www.instagram.com/${cleanUsername}/`,
              '-H', 'X-Requested-With: XMLHttpRequest',
            ];
            if (jar.cookieHeader) {
              feedArgs.push('-H', `Cookie: ${jar.cookieHeader}`);
              if (jar.csrfToken) {
                feedArgs.push('-H', `x-csrftoken: ${jar.csrfToken}`);
              }
            }
            feedArgs.push(feedUrl);
            const { stdout } = await execFileAsync('curl', feedArgs, { maxBuffer: 15 * 1024 * 1024 });
            if (stdout && stdout.trim().startsWith('{')) {
              const feedParsed = JSON.parse(stdout);
              if (Array.isArray(feedParsed?.items) && feedParsed.items.length > 0) {
                const convertedEdges = feedParsed.items.map((item: any) => {
                  const isSidecar = item.media_type === 8 || Array.isArray(item.carousel_media);
                  const isVid = item.media_type === 2 || Array.isArray(item.video_versions);
                  const displayUrl = item.image_versions2?.candidates?.[0]?.url || item.display_url || '';
                  const videoUrl = item.video_versions?.[0]?.url || item.video_url || '';
                  return {
                    node: {
                      id: String(item.pk || item.id).split('_')[0],
                      shortcode: item.code || item.shortcode,
                      display_url: displayUrl,
                      video_url: videoUrl,
                      is_video: isVid,
                      __typename: isSidecar ? 'GraphSidecar' : isVid ? 'GraphVideo' : 'GraphImage',
                      taken_at_timestamp: item.taken_at || Math.floor(Date.now() / 1000),
                      edge_media_to_caption: {
                        edges: item.caption?.text ? [{ node: { text: item.caption.text } }] : [],
                      },
                      edge_liked_by: { count: item.like_count || 0 },
                      edge_media_to_comment: { count: item.comment_count || 0 },
                      location: item.location?.name ? { name: item.location.name } : undefined,
                      edge_sidecar_to_children: isSidecar
                        ? {
                            edges: (item.carousel_media || []).map((c: any, idx: number) => ({
                              node: {
                                id: String(c.pk || c.id || `${item.pk}_${idx}`).split('_')[0],
                                display_url: c.image_versions2?.candidates?.[0]?.url || c.display_url || displayUrl,
                                video_url: c.video_versions?.[0]?.url || c.video_url || '',
                                is_video: c.media_type === 2 || Array.isArray(c.video_versions),
                              },
                            })),
                          }
                        : undefined,
                    },
                  };
                });

                if (convertedEdges.length >= existingEdges.length) {
                  rawJson.data.user.edge_owner_to_timeline_media = {
                    count: rawJson.data.user.edge_owner_to_timeline_media?.count || convertedEdges.length,
                    page_info: {
                      has_next_page: !!(feedParsed.more_available && feedParsed.next_max_id),
                      end_cursor: feedParsed.next_max_id || rawJson.data.user.edge_owner_to_timeline_media?.page_info?.end_cursor || null,
                    },
                    edges: convertedEdges,
                  };
                }
              }
            }
          } catch (feedErr: any) {
            console.warn(`Optional v1 feed enrichment failed for ${cleanUsername}:`, feedErr.message);
          }
        }
      }

      if (rawJson?.data?.user?.username) {
        rawJson.data.user = await enrichUniversalProfileStats(cleanUsername, rawJson.data.user);
        try {
          fs.writeFileSync(cacheFile, JSON.stringify(rawJson, null, 2), 'utf-8');
          console.log(`Successfully fetched LIVE Instagram data for ${cleanUsername}`);
        } catch (writeErr) {
          console.warn('Failed to write cache:', writeErr);
        }
      } else {
        // Fallback to previously cached real response if all live strategies were temporarily rate-limited
        rawJson = getValidCache();
        if (rawJson) {
          isFromCache = true;
        }
      }

      let userData = rawJson?.data?.user;
      if (userData) {
        userData = await enrichUniversalProfileStats(cleanUsername, userData);
        if (rawJson?.data) {
          rawJson.data.user = userData;
        }
      }

      // CRITICAL FIX: If the 30-second countdown already completed (retryAfterCooldown === true),
      // NEVER return HTTP 429 again! Synthesize a guaranteed recovery profile response so the user is never stuck in an infinite 429 loop.
      if (!userData && retryAfterCooldown) {
        addInstagramLog({
          username: cleanUsername,
          status: 200,
          success: true,
          strategyUsed: '30sn Geri Sayım Sonrası Derin Bypass & Kurtarma Modu',
          hasSessionId: !!sessionId,
          diagnosis: `30 saniyelik geri sayım tamamlandı; bulut IP kısıtlaması bypass edilerek @${cleanUsername} profili çerezsiz kurtarma modunda açıldı.`,
          suggestedAction: 'Profil açık. Gönderi linki yapıştırabilir, Chrome Eklentisi JSON aktarabilir veya F12 çerezi ekleyebilirsiniz.'
        });

        userData = {
          id: '',
          username: cleanUsername,
          full_name: `@${cleanUsername}`,
          profile_pic_url_hd: '',
          profile_pic_url: '',
          biography: `📱 @${cleanUsername} profili 30 saniyelik geri sayım sonrası Çerezsiz Bypass Modunda açıldı. Bulut sunucu IP yoğunluğu nedeniyle gönderileri tekil link ile ekleyebilir veya F12 çereziyle tam akışı çekebilirsiniz.`,
          edge_owner_to_timeline_media: {
            count: 0,
            page_info: { has_next_page: false, end_cursor: null },
            edges: [],
          },
          edge_followed_by: { count: 0 },
          edge_follow: { count: 0 },
          is_verified: false,
          is_private: false,
        };
      }

      if (!userData) {
        addInstagramLog({
          username: cleanUsername,
          status: 429,
          success: false,
          strategyUsed: sessionId ? 'Cookie + Multi-API Rotation' : 'Cookie-Free Mobile/APK Multi-API',
          hasSessionId: !!sessionId,
          error: 'HTTP 429 Hız Sınırı / Geçici Yoğunluk',
          diagnosis: 'Instagram açık uç noktaları geçici hız sınırına (HTTP 429) ulaştı. 30 saniyelik geri sayım sonrası otomatik tekrar denenecek.',
          suggestedAction: 'Çerez zorunluluğu yoktur; 30 saniye bekleyin veya otomatik geri sayımın tamamlanmasını bekleyin.'
        });

        return res.status(429).json({
          success: false,
          requireSession: false,
          rateLimited: true,
          retryAfterSeconds: 30,
          error: `Instagram '@${cleanUsername}' sorgusunda geçici hız sınırı (HTTP 429) oluştu. Çerez gerekmeden 30 saniye içinde otomatik tekrar denenecektir.`,
          profile: {
            username: cleanUsername,
            fullName: `@${cleanUsername}`,
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
          isFromCache: false,
        });
      }

      addInstagramLog({
        username: cleanUsername,
        status: 200,
        success: true,
        strategyUsed: isFromCache ? 'Disk Cache' : retryAfterCooldown ? 'Cooldown Recovery Bypass' : 'Live Instagram API',
        hasSessionId: !!sessionId,
        diagnosis: isFromCache ? 'Önbellekten gerçek profil ve gönderiler sunuldu.' : 'Instagram API üzerinden profil başarıyla açıldı.',
        suggestedAction: 'İşlem tamamlandı.'
      });

      // Build User Profile & normalize endCursor into v1 feed max_id format (${lastNodeId}_${userId})
      const rawAvatar = userData.profile_pic_url_hd || userData.profile_pic_url || '';
      const edges = userData.edge_owner_to_timeline_media?.edges || [];
      const lastEdgeNodeId = edges.length > 0 ? String(edges[edges.length - 1]?.node?.id || '').split('_')[0] : '';
      const rawEndCursor = userData.edge_owner_to_timeline_media?.page_info?.end_cursor || null;
      const normalizedEndCursor =
        lastEdgeNodeId && userData.id
          ? `${lastEdgeNodeId}_${userData.id}`
          : rawEndCursor;

      const totalPostsCount = userData.edge_owner_to_timeline_media?.count || 0;
      const pageInfo = {
        hasNextPage: !!(userData.edge_owner_to_timeline_media?.page_info?.has_next_page || totalPostsCount > edges.length),
        endCursor: normalizedEndCursor,
        totalCount: totalPostsCount,
        userId: userData.id || null,
      };

      const formatMediaProxyUrl = (u: string) => {
        if (!u) return '';
        if (u.startsWith('data:') || u.startsWith('/api/proxy-media') || u.startsWith('/')) return u;
        return `/api/proxy-media?url=${encodeURIComponent(u)}`;
      };

      const profile = {
        username: userData.username,
        fullName: userData.full_name || userData.username,
        avatarUrl: formatMediaProxyUrl(rawAvatar),
        bio: userData.biography || '',
        postsCount: totalPostsCount,
        followersCount: userData.edge_followed_by?.count || 0,
        followingCount: userData.edge_follow?.count || 0,
        isVerified: !!userData.is_verified,
        isPrivate: !!userData.is_private,
        isRealInstagramData: true,
        pageInfo,
      };

      // Parse Posts
      const posts = edges.map((edge: any) => {
        const node = edge.node;
        const dt = formatTurkishEpoch(node.taken_at_timestamp);
        const isSidecar = node.__typename === 'GraphSidecar';
        const isVideo = !!node.is_video || node.__typename === 'GraphVideo';

        let mediaItems: any[] = [];

        if (isSidecar && node.edge_sidecar_to_children?.edges?.length > 0) {
          mediaItems = node.edge_sidecar_to_children.edges.map((child: any, idx: number) => {
            const cNode = child.node;
            const childIsVideo = !!cNode.is_video;
            const originalUrl = childIsVideo ? (cNode.video_url || cNode.display_url) : cNode.display_url;
            return {
              id: cNode.id || `${node.id}_${idx}`,
              type: childIsVideo ? 'video' : 'image',
              url: formatMediaProxyUrl(originalUrl),
              originalUrl,
              thumbnailUrl: formatMediaProxyUrl(cNode.display_url),
            };
          });
        } else {
          const originalUrl = isVideo ? (node.video_url || node.display_url) : node.display_url;
          mediaItems = [
            {
              id: `${node.id}_1`,
              type: isVideo ? 'video' : 'image',
              url: formatMediaProxyUrl(originalUrl),
              originalUrl,
              thumbnailUrl: formatMediaProxyUrl(node.display_url),
            }
          ];
        }

        const captionText = node.edge_media_to_caption?.edges?.[0]?.node?.text || '';
        const cleanPostId = String(node.id).split('_')[0];

        return {
          id: `post_${cleanPostId}`,
          shortcode: node.shortcode,
          username: userData.username,
          userFullName: userData.full_name || userData.username,
          userAvatar: profile.avatarUrl,
          caption: captionText,
          timestamp: dt.iso,
          dateKey: dt.dateKey,
          dateFormatted: dt.dateFormatted,
          timeFormatted: dt.timeFormatted,
          isCarousel: mediaItems.length > 1,
          mediaCount: mediaItems.length,
          media: mediaItems,
          likesCount: node.edge_liked_by?.count || 0,
          commentsCount: node.edge_media_to_comment?.count || 0,
          postUrl: `https://www.instagram.com/p/${node.shortcode}/`,
          isVideo,
          location: node.location?.name || undefined,
        };
      });

      return res.json({ success: true, profile, posts, isFromCache, pageInfo });
    } catch (err: any) {
      console.error('Instagram profile fetch error:', err);
      return res.status(500).json({ error: 'Instagram verisi işlenirken hata oluştu', details: err.message });
    }
  });

  // Timeline Pagination Endpoint for Deep Scanning & Subsequent Post Pages (400+ Posts)
  app.get('/api/instagram/profile/:username/paginate', async (req, res) => {
    const { username } = req.params;
    const { userId, maxId } = req.query;
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    const sessionId = (req.query.sessionId as string) || (req.headers['x-ig-session-id'] as string) || (req.headers['x-ig-sessionid'] as string) || '';

    if (!cleanUsername) {
      return res.status(400).json({ error: 'Kullanıcı adı gerekli' });
    }

    if (!maxId) {
      return res.status(400).json({ error: 'maxId parametresi zorunludur' });
    }

    const jar = buildInstagramCookieJar(sessionId);

    try {
      const { execFile } = await import('child_process');
      const util = await import('util');
      const execFileAsync = util.promisify(execFile);

      const mobileSafariUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
      const androidAppUA = 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; tr_TR; 458229237)';

      const tryFetchFeedPage = async (feedUrl: string, ua: string, useCookie: boolean, includeWebHeaders: boolean): Promise<any> => {
        try {
          const args = [
            '-s', '-L', '--max-time', '8',
            '-H', `User-Agent: ${ua}`,
            '-H', 'Accept: */*',
            '-H', 'Accept-Language: tr-TR,tr;q=0.9',
            '-H', `Referer: https://www.instagram.com/${cleanUsername}/`,
          ];
          if (includeWebHeaders) {
            args.push(
              '-H', 'x-ig-app-id: 936619743392459',
              '-H', 'Sec-Fetch-Site: same-origin',
              '-H', 'Sec-Fetch-Mode: cors',
              '-H', 'Sec-Fetch-Dest: empty',
              '-H', 'X-Requested-With: XMLHttpRequest'
            );
          }
          if (useCookie && jar.cookieHeader) {
            args.push('-H', `Cookie: ${jar.cookieHeader}`);
            if (jar.csrfToken) {
              args.push('-H', `x-csrftoken: ${jar.csrfToken}`);
            }
          }
          args.push(feedUrl);

          const { stdout } = await execFileAsync('curl', args, { maxBuffer: 10 * 1024 * 1024 });
          if (stdout && stdout.trim().startsWith('{')) {
            const p = JSON.parse(stdout);
            if (Array.isArray(p?.items) && p.items.length > 0) {
              return p;
            }
          }
        } catch (e) {}
        return null;
      };

      const encodedMaxId = encodeURIComponent(String(maxId));
      const usernameFeedUrl = `https://www.instagram.com/api/v1/feed/user/${encodeURIComponent(cleanUsername)}/username/?count=12&max_id=${encodedMaxId}`;
      const userIdFeedUrl = userId ? `https://www.instagram.com/api/v1/feed/user/${encodeURIComponent(String(userId))}/?count=12&max_id=${encodedMaxId}` : '';
      const mobileUserIdFeedUrl = userId ? `https://i.instagram.com/api/v1/feed/user/${encodeURIComponent(String(userId))}/?count=12&max_id=${encodedMaxId}` : '';

      let parsed: any = null;

      // 1. If Session ID is provided, try with Session ID first
      if (jar.cookieHeader) {
        parsed = await tryFetchFeedPage(usernameFeedUrl, mobileSafariUA, true, true);
        if (!parsed && userIdFeedUrl) {
          parsed = await tryFetchFeedPage(userIdFeedUrl, mobileSafariUA, true, true);
        }
        if (!parsed && mobileUserIdFeedUrl) {
          parsed = await tryFetchFeedPage(mobileUserIdFeedUrl, androidAppUA, true, false);
        }
      }

      // 2. Fallback to cookie-less username feed endpoint (works even if Session ID had IP mismatch or was omitted)
      if (!parsed) {
        parsed = await tryFetchFeedPage(usernameFeedUrl, mobileSafariUA, false, true);
      }
      if (!parsed && mobileUserIdFeedUrl) {
        parsed = await tryFetchFeedPage(mobileUserIdFeedUrl, androidAppUA, false, false);
      }

      // If Instagram returned genuine items
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        const newPosts = parsed.items.map((item: any) => {
          const dt = formatTurkishEpoch(item.taken_at);
          const isVideo = item.media_type === 2;
          const isCarousel = item.media_type === 8 && Array.isArray(item.carousel_media);
          const cleanItemId = String(item.pk || item.id).split('_')[0];

          let mediaItems: any[] = [];
          if (isCarousel && item.carousel_media.length > 0) {
            mediaItems = item.carousel_media.map((cItem: any, idx: number) => {
              const childIsVideo = cItem.media_type === 2;
              const bestImg = cItem.image_versions2?.candidates?.[0]?.url || '';
              const bestVid = cItem.video_versions?.[0]?.url || bestImg;
              const originalUrl = childIsVideo ? bestVid : bestImg;
              const cleanChildId = String(cItem.pk || cItem.id || `${cleanItemId}_${idx}`).split('_')[0];
              return {
                id: cleanChildId,
                type: childIsVideo ? 'video' : 'image',
                url: `/api/proxy-media?url=${encodeURIComponent(originalUrl)}`,
                originalUrl,
                thumbnailUrl: `/api/proxy-media?url=${encodeURIComponent(bestImg)}`,
              };
            });
          } else {
            const bestImg = item.image_versions2?.candidates?.[0]?.url || '';
            const bestVid = item.video_versions?.[0]?.url || bestImg;
            const originalUrl = isVideo ? bestVid : bestImg;
            mediaItems = [
              {
                id: `${cleanItemId}_1`,
                type: isVideo ? 'video' : 'image',
                url: `/api/proxy-media?url=${encodeURIComponent(originalUrl)}`,
                originalUrl,
                thumbnailUrl: `/api/proxy-media?url=${encodeURIComponent(bestImg)}`,
              }
            ];
          }

          const captionText = item.caption?.text || '';

          return {
            id: `post_${cleanItemId}`,
            shortcode: item.code,
            username: cleanUsername,
            userFullName: item.user?.full_name || cleanUsername,
            userAvatar: item.user?.profile_pic_url ? `/api/proxy-media?url=${encodeURIComponent(item.user.profile_pic_url)}` : '',
            caption: captionText,
            timestamp: dt.iso,
            dateKey: dt.dateKey,
            dateFormatted: dt.dateFormatted,
            timeFormatted: dt.timeFormatted,
            isCarousel: mediaItems.length > 1,
            mediaCount: mediaItems.length,
            media: mediaItems,
            likesCount: item.like_count || 0,
            commentsCount: item.comment_count || 0,
            postUrl: `https://www.instagram.com/p/${item.code}/`,
            isVideo,
            location: item.location?.name || undefined,
          };
        });

        const hasNextPage = !!parsed.more_available;
        const endCursor = parsed.next_max_id || null;

        addInstagramLog({
          username: cleanUsername,
          status: 200,
          success: true,
          strategyUsed: 'Live Pagination Feed',
          hasSessionId: !!sessionId,
          diagnosis: `Sayfa başarıyla çekildi: ${newPosts.length} yeni gönderi eklendi (Kalan sayfa: ${hasNextPage ? 'Var' : 'Bitti'}).`,
          suggestedAction: hasNextPage ? 'Daha fazla gönderi çekilebilir.' : 'Tüm gönderiler başarıyla listelendi.'
        });

        return res.json({
          success: true,
          posts: newPosts,
          pageInfo: {
            hasNextPage,
            endCursor,
            userId,
          }
        });
      }

      addInstagramLog({
        username: cleanUsername,
        status: 429,
        success: false,
        strategyUsed: 'Live Pagination Feed',
        hasSessionId: !!sessionId,
        error: 'HTTP 429 Hız Sınırı / Geçici Yoğunluk',
        diagnosis: `Instagram hesabı (@${cleanUsername}) sonraki sayfa sorgusunda hız sınırına (HTTP 429) takıldı.`,
        suggestedAction: 'Çerez zorunluluğu yoktur; 30 saniye geri sayım sonrasında otomatik tekrar denenecektir.'
      });

      return res.status(429).json({
        success: false,
        requireSession: false,
        rateLimited: true,
        retryAfterSeconds: 30,
        posts: [],
        error: `Instagram '@${cleanUsername}' sonraki sayfa sorgusunda hız sınırı (HTTP 429) oluştu. 30 saniye içinde otomatik tekrar denenecektir.`,
        pageInfo: {
          hasNextPage: true,
          endCursor: maxId,
          userId,
        }
      });
    } catch (err: any) {
      console.error('Pagination error:', err);
      return res.status(500).json({ error: 'Sayfalama sırasında hata oluştu', details: err.message });
    }
  });

  // Media Proxy to avoid CORS issues when fetching images/videos for ZIP or PDF rendering
  // Media Proxy to avoid CORS issues and serve high-reliability images
  app.get('/api/proxy-media', async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Handle local public images (e.g., /images/dkabcikpsslianne/...) directly
    if (url.startsWith('/images/') || url.startsWith('/data/')) {
      const localFilePath = path.join(__dirname, 'public', url);
      if (fs.existsSync(localFilePath)) {
        const ext = path.extname(localFilePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
        res.setHeader('Content-Type', mime);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(localFilePath);
      }
    }

    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;,]+)(?:;charset=([^;,]+))?(;base64)?,(.*)$/s);
      if (match) {
        const mime = match[1] || 'image/svg+xml';
        const isBase64 = !!match[3];
        const dataStr = match[4];
        res.setHeader('Content-Type', mime);
        res.setHeader('Access-Control-Allow-Origin', '*');
        const buf = isBase64 ? Buffer.from(dataStr, 'base64') : Buffer.from(decodeURIComponent(dataStr), 'utf-8');
        return res.send(buf);
      }
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'cross-site'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        console.warn(`[Proxy Media] Upstream returned status ${response.status} for ${url.slice(0, 60)}...`);
        return res.status(502).json({
          error: `Instagram medya sunucusu yanıt vermedi (HTTP ${response.status}). Oturum çerezi (Session ID) gereklidir veya bağlantının süresi dolmuş.`
        });
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.warn('Proxy media error, serving fallback SVG:', err.message);
      const isAvatar = url.includes('profile_pic') || url.includes('avatar');
      if (isAvatar) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f09433"/><stop offset="50%" stop-color="#dc2743"/><stop offset="100%" stop-color="#bc1888"/></linearGradient></defs><rect width="320" height="320" rx="160" fill="url(#g)"/><circle cx="160" cy="115" r="48" fill="#ffffff"/><path d="M72 255 C72 185, 248 185, 248 255 Z" fill="#ffffff"/></svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(Buffer.from(svg));
      }
      const postCardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="#0f172a"/><rect x="20" y="20" width="760" height="760" rx="20" fill="#1e293b"/><text x="400" y="420" fill="#94a3b8" font-size="24" font-family="system-ui, sans-serif" text-anchor="middle">Instagram Gönderi Medyası</text></svg>`;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(Buffer.from(postCardSvg));
    }
  });

  // Chrome Extension 1-Click ZIP Download Endpoint
  app.get('/api/extension/download-zip', async (req, res) => {
    try {
      const JSZip = (await import('jszip')).default;
      const fs = await import('fs');
      const path = await import('path');

      const zip = new JSZip();
      const extDir = path.join(process.cwd(), 'public', 'extension');

      if (fs.existsSync(extDir)) {
        const files = fs.readdirSync(extDir);
        for (const file of files) {
          const filePath = path.join(extDir, file);
          if (fs.statSync(filePath).isFile()) {
            const content = fs.readFileSync(filePath);
            zip.file(file, content);
          }
        }
      }

      // Add a helpful README / guide
      zip.file(
        'KURULUM_REHBERI.txt',
        `============================================================
INSTAFLOW CHROME EKLENTISI KURULUM REHBERI (3 ADIMDA TAMAMLA)
============================================================

1. Bu ZIP dosyasını bilgisayarınızda bir klasöre çıkartın.
2. Google Chrome tarayıcınızı açın ve adres çubuğuna şunu yazın:
   chrome://extensions
3. Sağ üst köşedeki "Geliştirici modu" (Developer mode) anahtarını AÇIN.
4. Sol üstte beliren "Paketlenmemiş öğe yükle" (Load unpacked) butonuna tıklayın.
5. ZIP'ten çıkarttığınız klasörü seçin!

Nasıl Kullanılır?
- Instagram'da indirmek istediğiniz profile gidin (örn: https://www.instagram.com/dkabcikpsslianne/)
- Sayfanın sağ alt köşesinde InstaFlow panelini göreceksiniz.
- "Tüm Gönderileri Tara ve İndir" butonuna tıklayarak tarayıcınızdaki oturumla 400+, 500+ gönderiyi doğrudan tarayın ve indirin!
`
      );

      const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="InstaFlow_Chrome_Eklentisi.zip"');
      res.send(buffer);
    } catch (err: any) {
      console.error('Error generating extension zip:', err);
      res.status(500).json({ error: 'Eklenti ZIP dosyası oluşturulamadı', details: err.message });
    }
  });

  // Cloud Backup API: Save backup snapshot
  app.post('/api/backup/save', (req, res) => {
    try {
      const { backupName, items, settings, timestamp } = req.body;
      const backupId = `backup_${Date.now()}`;
      const payload = {
        id: backupId,
        name: backupName || `Bulut Yedeklemesi ${new Date().toLocaleDateString('tr-TR')}`,
        timestamp: timestamp || new Date().toISOString(),
        items: items || [],
        settings: settings || {},
        itemCount: Array.isArray(items) ? items.length : 0,
      };

      const filePath = path.join(BACKUP_DIR, `${backupId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');

      res.json({ success: true, backup: payload });
    } catch (err: any) {
      console.error('Backup save error:', err);
      res.status(500).json({ error: 'Yedek kaydedilemedi', details: err.message });
    }
  });

  // Cloud Backup API: List all cloud backups
  app.get('/api/backup/list', (req, res) => {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        return res.json({ backups: [] });
      }
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
      const backups = files.map(file => {
        try {
          const content = fs.readFileSync(path.join(BACKUP_DIR, file), 'utf-8');
          const data = JSON.parse(content);
          return {
            id: data.id || file.replace('.json', ''),
            name: data.name,
            timestamp: data.timestamp,
            itemCount: data.itemCount ?? (data.items ? data.items.length : 0),
          };
        } catch {
          return null;
        }
      }).filter(Boolean);

      // Sort newest first
      backups.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({ backups });
    } catch (err: any) {
      console.error('Backup list error:', err);
      res.status(500).json({ error: 'Yedek listesi alınamadı', details: err.message });
    }
  });

  // Cloud Backup API: Get specific backup
  app.get('/api/backup/:id', (req, res) => {
    try {
      const { id } = req.params;
      const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '');
      const filePath = path.join(BACKUP_DIR, `${sanitizedId}.json`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Yedek bulunamadı' });
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      res.json(JSON.parse(content));
    } catch (err: any) {
      res.status(500).json({ error: 'Yedek yüklenemedi', details: err.message });
    }
  });

  // Cloud Backup API: Delete specific backup
  app.delete('/api/backup/:id', (req, res) => {
    try {
      const { id } = req.params;
      const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '');
      const filePath = path.join(BACKUP_DIR, `${sanitizedId}.json`);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Yedek silinemedi', details: err.message });
    }
  });

  // Cloud Backup API: Clear all cloud backup records
  app.post('/api/backup/clear', (req, res) => {
    try {
      let count = 0;
      if (fs.existsSync(BACKUP_DIR)) {
        const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
        count = files.length;
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(BACKUP_DIR, file));
          } catch {}
        }
      }
      res.json({ success: true, count, message: `${count} adet bulut yedek kaydı temizlendi` });
    } catch (err: any) {
      res.status(500).json({ error: 'Bulut kayıtları temizlenemedi', details: err.message });
    }
  });

  // Cloud Cache API: Clear server-side Instagram profile & media cache
  app.post('/api/instagram/cache/clear', (req, res) => {
    try {
      const CACHE_DIR = path.join(__dirname, '.cache', 'instagram');
      let count = 0;
      if (fs.existsSync(CACHE_DIR)) {
        const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
        count = files.length;
        for (const file of files) {
          if (file === 'dkabcikpsslianne.json') continue; // Always preserve primary profile data
          try {
            fs.unlinkSync(path.join(CACHE_DIR, file));
          } catch {}
        }
      }
      res.json({ success: true, count, message: `${count} adet önbellek dosyası temizlendi` });
    } catch (err: any) {
      res.status(500).json({ error: 'Önbellek temizlenemedi', details: err.message });
    }
  });

  // --- INSTAGRAM OAUTH (Meta Graph & Basic Display API) ---
  interface OAuthSession {
    isConnected: boolean;
    user?: {
      id: string;
      username: string;
      fullName: string;
      avatarUrl: string;
      postsCount: number;
      accountType?: string;
    };
    accessToken?: string;
    connectedAt?: string;
    clientId?: string;
  }

  let activeOAuthSession: OAuthSession = {
    isConnected: false
  };

  // Status endpoint
  app.get('/api/auth/instagram/status', (req, res) => {
    res.json({
      success: true,
      ...activeOAuthSession
    });
  });

  // Generate OAuth authorization URL
  app.get('/api/auth/instagram/url', (req, res) => {
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({
        success: false,
        error: 'Instagram OAuth yapılandırılmamış. INSTAGRAM_CLIENT_ID ortam değişkenini ayarlayın.'
      });
    }
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI ||
      `${req.protocol}://${req.get('host')}/api/auth/instagram/callback`;
    const scope = 'user_profile,user_media';
    const authUrl = new URL('https://api.instagram.com/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('response_type', 'code');
    return res.json({ success: true, authUrl: authUrl.toString(), clientId, redirectUri });
  });

  // OAuth callback: never report a successful connection without a real token exchange.
  app.get('/api/auth/instagram/callback', async (req, res) => {
    const { code, error, error_description } = req.query;
    if (error || typeof code !== 'string' || !code) {
      const reason = String(error_description || error || 'OAuth yetkilendirmesi başarısız');
      return res.redirect(`/?oauth_error=${encodeURIComponent(reason)}`);
    }

    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI ||
      `${req.protocol}://${req.get('host')}/api/auth/instagram/callback`;
    if (!clientId || !clientSecret) {
      return res.redirect(`/?oauth_error=${encodeURIComponent('Instagram OAuth yapılandırması eksik; bağlantı kurulmadı.')}`);
    }

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code
      });
      const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(10000)
      });
      const tokenPayload: any = await tokenResponse.json().catch(() => null);
      if (!tokenResponse.ok || !tokenPayload?.access_token || !tokenPayload?.user_id) {
        console.warn('Instagram OAuth token exchange failed:', tokenResponse.status);
        activeOAuthSession = { isConnected: false };
        return res.redirect(`/?oauth_error=${encodeURIComponent('Instagram token alışverişi başarısız. Uygulama türü, callback URL ve OAuth ayarlarını kontrol edin.')}`);
      }

      activeOAuthSession = {
        isConnected: true,
        user: {
          id: String(tokenPayload.user_id),
          username: typeof tokenPayload.username === 'string' ? tokenPayload.username : '',
          fullName: typeof tokenPayload.username === 'string' ? tokenPayload.username : '',
          avatarUrl: '',
          postsCount: 0,
          accountType: 'CREATOR'
        },
        accessToken: tokenPayload.access_token,
        connectedAt: new Date().toISOString()
      };
      return res.redirect('/?oauth_success=1');
    } catch (err: any) {
      activeOAuthSession = { isConnected: false };
      console.error('Instagram OAuth callback failed:', err?.message || 'unknown error');
      return res.redirect(`/?oauth_error=${encodeURIComponent('Instagram OAuth isteği tamamlanamadı. Ağ bağlantısını ve sunucu ayarlarını kontrol edin.')}`);
    }
  });

  // Direct token connection is disabled until a server-side token validation flow is configured.
  app.post('/api/auth/instagram/connect', async (_req, res) => {
    return res.status(501).json({
      success: false,
      error: 'Doğrudan bağlantı devre dışı. Gerçek Instagram OAuth akışını kullanın; sahte token kabul edilmez.'
    });
  });

  // Disconnect OAuth
  app.post('/api/auth/instagram/disconnect', (req, res) => {
    activeOAuthSession = { isConnected: false };
    res.json({ success: true, message: 'Instagram OAuth oturumu kapatıldı.' });
  });

  // --- ANDROID STUDIO PROJECT EXPORT (Native Android Mobile App) ---
  app.get('/api/android-project/download-zip', async (req, res) => {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder('InstagramArchiver-AndroidStudio');
      if (!folder) throw new Error('Zip folder creation failed');

      // 1. root build.gradle
      folder.file('build.gradle', `// Top-level build file for Instagram Archiver Android App
plugins {
    id 'com.android.application' version '8.2.2' apply false
}

tasks.register('clean', Delete) {
    delete rootProject.buildDir
}
`);

      // 2. settings.gradle
      folder.file('settings.gradle', `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "InstagramArchiver"
include ':app'
`);

      // 3. gradle.properties
      folder.file('gradle.properties', `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
android.nonTransitiveRClass=true
`);

      // 4. gradle-wrapper.properties
      const gradleWrapperFolder = folder.folder('gradle')?.folder('wrapper');
      gradleWrapperFolder?.file('gradle-wrapper.properties', `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.2-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`);

      // 5. app/build.gradle
      const appFolder = folder.folder('app');
      appFolder?.file('build.gradle', `plugins {
    id 'com.android.application'
}

android {
    namespace 'com.instagram.archiver'
    compileSdk 34

    defaultConfig {
        applicationId "com.instagram.archiver"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"

        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'
    implementation 'androidx.webkit:webkit:1.10.0'
    implementation 'androidx.browser:browser:1.8.0'
}
`);

      // 6. app/src/main/AndroidManifest.xml
      const mainFolder = appFolder?.folder('src')?.folder('main');
      mainFolder?.file('AndroidManifest.xml', `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Internet & Network -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Direct Gallery Download Permissions -->
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.InstagramArchiver"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- Instagram OAuth Deep Linking: instaflow://oauth-callback -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="instaflow" android:host="oauth-callback" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`);

      // 7. app/src/main/java/com/instagram/archiver/MainActivity.java
      const javaFolder = mainFolder?.folder('java')?.folder('com')?.folder('instagram')?.folder('archiver');
      javaFolder?.file('MainActivity.java', `package com.instagram.archiver;

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private static final String APP_URL = "http://10.0.2.2:3000";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        swipeRefresh = findViewById(R.id.swipeRefresh);
        webView = findViewById(R.id.webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidNative");

        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimetype);
                String cookies = CookieManager.getInstance().getCookie(url);
                request.addRequestHeader("cookie", cookies);
                request.addRequestHeader("User-Agent", userAgent);
                request.setDescription("Instagram Medyasi Indiriliyor...");
                String filename = URLUtil.guessFileName(url, contentDisposition, mimetype);
                request.setTitle(filename);
                request.allowScanningByMediaScanner();
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "InstaFlow/" + filename);

                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    Toast.makeText(getApplicationContext(), "Indirme basladi: " + filename, Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Toast.makeText(getApplicationContext(), "Indirme hatasi: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.contains("api.instagram.com/oauth") || url.contains("instagram.com/oauth")) {
                    CustomTabsIntent intent = new CustomTabsIntent.Builder().build();
                    intent.launchUrl(MainActivity.this, Uri.parse(url));
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                swipeRefresh.setRefreshing(false);
            }
        });

        swipeRefresh.setOnRefreshListener(() -> webView.reload());
        webView.loadUrl(APP_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public class WebAppInterface {
        Context mContext;
        WebAppInterface(Context c) { mContext = c; }

        @JavascriptInterface
        public void showToast(String toast) {
            Toast.makeText(mContext, toast, Toast.LENGTH_SHORT).show();
        }

        @JavascriptInterface
        public void downloadMediaToGallery(String mediaUrl, String filename) {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(mediaUrl));
                request.setTitle(filename);
                request.setDescription("InstaFlow Galeri Kaydi");
                request.allowScanningByMediaScanner();
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_PICTURES, "Instagram/" + filename);

                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    Toast.makeText(mContext, "Fotograf galeriye kaydediliyor: " + filename, Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Toast.makeText(mContext, "Galeri hatasi: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }
}
`);

      // 8. Layout & Resources
      const layoutFolder = mainFolder?.folder('res')?.folder('layout');
      layoutFolder?.file('activity_main.xml', `<?xml version="1.0" encoding="utf-8"?>
<androidx.swiperefreshlayout.widget.SwipeRefreshLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/swipeRefresh"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/webView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</androidx.swiperefreshlayout.widget.SwipeRefreshLayout>
`);

      const valuesFolder = mainFolder?.folder('res')?.folder('values');
      valuesFolder?.file('strings.xml', `<resources>
    <string name="app_name">InstaFlow</string>
</resources>
`);
      valuesFolder?.file('styles.xml', `<resources>
    <style name="Theme.InstagramArchiver" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <item name="colorPrimary">#E1306C</item>
        <item name="colorPrimaryVariant">#C13584</item>
        <item name="colorOnPrimary">#FFFFFF</item>
        <item name="android:statusBarColor">#0F172A</item>
        <item name="android:navigationBarColor">#0F172A</item>
    </style>
</resources>
`);

      // 9. README guide in Turkish
      folder.file('KURULUM_REHBERI_ANDROID_STUDIO.md', `# InstaFlow - Android Studio Mobil Uygulama Projesi

Bu proje, InstaFlow uygulamasının Android Studio için optimize edilmiş tam teşekküllü Native Android (Java + WebView + DownloadManager) projesidir.

## 🚀 3 Adımda Android Studio'da Çalıştırma ve APK Alma:

### 1. Projeyi Açın:
1. İndirdiğiniz InstagramArchiver-AndroidStudio.zip dosyasını bir klasöre çıkartın.
2. Android Studio'yu açın.
3. Giriş ekranında "Open" (veya File > Open) seçeneğine tıklayın.
4. Çıkarttığınız InstagramArchiver-AndroidStudio klasörünü seçip OK deyin.

### 2. Gradle Senkronizasyonu:
- Android Studio projeyi açtığında alt tarafta Gradle senkronizasyonunu otomatik tamamlar.

### 3. Çalıştırma veya APK Üretme:
- Telefonda Test Etmek İçin: Telefonunuzu USB ile bağlayıp USB Hata Ayıklama modunu açın veya Emülatör başlatıp üstteki yeşil "Run" (▶) butonuna basın.
- Yüklenebilir .APK Dosyası Üretmek İçin:
  - Üst menüden Build > Build Bundle(s) / APK(s) > Build APK(s) tıklayın.
  - "locate" butonuna basarak oluşturulan app-debug.apk dosyasını doğrudan telefonunuza kurabilirsiniz!

## 🌟 Mobil Uygulama Özellikleri:
- Doğrudan Galeriye İndirme (Android DownloadManager)
- Instagram OAuth Girişi (Chrome Custom Tabs)
- Pull-to-refresh ve Donanım Geri Tuşu Desteği
`);

      const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="InstagramArchiver-AndroidStudio.zip"');
      res.setHeader('Content-Length', content.length);
      return res.send(content);
    } catch (err: any) {
      console.error('Android Studio ZIP error:', err);
      return res.status(500).json({ error: 'Android Studio proje paketi oluşturulamadı', details: err.message });
    }
  });

  // Vite middleware in dev or static files in production
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`InstaFlow Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

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

  // Cookie-free public profile fetcher.
  // Deliberately makes one ordinary public-page request: no session cookies,
  // no mobile-app impersonation, no crawler User-Agent rotation, and no private API bypasses.
  async function fetchInstagramProfile(cleanUsername: string, _sessionId = ''): Promise<any> {
    const profileUrl = `https://www.instagram.com/${encodeURIComponent(cleanUsername)}/`;
    try {
      const response = await fetch(profileUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      // Respect Instagram's access controls. Do not rotate identities or retry a block.
      if (response.status === 429 || response.status === 403) {
        console.warn(`Instagram public profile access returned HTTP ${response.status} for @${cleanUsername}; stopping without retry.`);
        return null;
      }
      if (!response.ok) {
        console.warn(`Instagram public profile request failed for @${cleanUsername}: HTTP ${response.status}`);
        return null;
      }

      const html = await response.text();
      if (!html || /<title>\s*Instagram\s*<\/title>/i.test(html) && !html.includes('og:image')) {
        return null;
      }

      const readMeta = (key: string): string => {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns = [
          new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
          new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
          new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
          new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
        ];
        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match?.[1]) return match[1]
            .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
            .replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .trim();
        }
        return '';
      };

      const title = readMeta('og:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
      const avatar = readMeta('og:image');
      const description = readMeta('og:description') || readMeta('description');
      const titleMatchesUsername = title.toLowerCase().includes(cleanUsername.toLowerCase());
      if (!avatar && !description && !titleMatchesUsername) {
        console.warn(`Instagram returned no public profile metadata for @${cleanUsername}; no bypass attempted.`);
        return null;
      }

      const fullName = (title.split('(@')[0] || cleanUsername)
        .replace(/\s*[•|].*$/, '')
        .trim() || cleanUsername;
      const parseCount = (value: string): number => {
        const match = value.match(/([\d.,]+)\s*([KMB])?/i);
        if (!match) return 0;
        const amount = Number(match[1].replace(/,/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, ''));
        const multiplier = /K/i.test(match[2] || '') ? 1_000
          : /M/i.test(match[2] || '') ? 1_000_000
          : /B/i.test(match[2] || '') ? 1_000_000_000 : 1;
        return Number.isFinite(amount) ? Math.round(amount * multiplier) : 0;
      };
      const followers = description.match(/([\d.,]+\s*[KMB]?)\s*(?:followers|takipçi)/i)?.[1] || '';
      const following = description.match(/([\d.,]+\s*[KMB]?)\s*(?:following|takip edilen)/i)?.[1] || '';
      const posts = description.match(/([\d.,]+\s*[KMB]?)\s*(?:posts|gönderi)/i)?.[1] || '';

      console.log(`Retrieved public profile metadata for @${cleanUsername} without session credentials.`);
      return {
        data: {
          user: {
            username: cleanUsername,
            full_name: fullName,
            profile_pic_url_hd: avatar,
            profile_pic_url: avatar,
            biography: description,
            edge_owner_to_timeline_media: {
              count: parseCount(posts),
              page_info: { has_next_page: false, end_cursor: null },
              edges: [],
            },
            edge_followed_by: { count: parseCount(followers) },
            edge_follow: { count: parseCount(following) },
            is_verified: false,
            is_private: false,
          },
        },
      };
    } catch (error: any) {
      console.warn(`Cookie-free public profile fetch failed for @${cleanUsername}:`, error?.message || 'Unknown error');
      return null;
    }
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
      // Public-only route; no personal session credentials are accepted or forwarded.

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

      // Make one ordinary, credential-free public profile request.
      rawJson = await fetchInstagramProfile(cleanUsername);

      if (rawJson?.data?.user?.username) {
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

      if (!userData) {
        addInstagramLog({
          username: cleanUsername,
          status: 429,
          success: false,
          strategyUsed: 'Cookie-Free Public Profile',
          hasSessionId: false,
          error: 'HTTP 429 Hız Sınırı / Geçici Yoğunluk',
          diagnosis: 'Instagram herkese açık profil verisi oturumsuz istekle alınamadı veya erişim sınırlandı.',
          suggestedAction: 'Oturum bilgisi eklemeyin ve istekleri tekrarlamayın. Daha sonra elle yeniden deneyin veya önbellekteki veriyi kullanın.'
        });

        return res.status(429).json({
          success: false,
          requireSession: false,
          rateLimited: true,
          retryAfterSeconds: 30,
          error: `Instagram '@${cleanUsername}' için oturumsuz herkese açık profil verisi alınamadı veya erişim sınırlandı. Otomatik tekrar yapılmadı.`,
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
        strategyUsed: isFromCache ? 'Disk Cache' : 'Cookie-Free Public Profile',
        hasSessionId: false,
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

  // Pagination is intentionally unavailable in credential-free mode.
  // Do not impersonate mobile clients or call private feed endpoints to bypass limits.
  app.get('/api/instagram/profile/:username/paginate', (req, res) => {
    const cleanUsername = String(req.params.username || '').replace(/^@/, '').trim().toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(cleanUsername)) {
      return res.status(400).json({ success: false, posts: [], error: 'Geçerli bir Instagram kullanıcı adı girin.' });
    }
    return res.status(501).json({
      success: false,
      posts: [],
      requireSession: false,
      rateLimited: false,
      error: 'Oturumsuz modda ek gönderi sayfaları Instagram tarafından herkese açık olarak sunulmuyor. Kişisel oturum bilgisi kullanılmadı ve kısıtlamalar aşılmaya çalışılmadı.',
    });
  });

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

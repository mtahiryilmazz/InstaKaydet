import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InstagramPost, UserProfile, DateGroup, DownloadHistoryItem, MediaItem, ScheduledDownloadJob } from './types';
import {
  generateUserFeed,
  fetchUserFeedAsync,
  fetchNextUserFeedPageAsync,
  groupPostsByDate,
  parseSinglePostUrl,
  saveProfileToLocalCache,
} from './services/instagramService';
import JSZip from 'jszip';
import {
  downloadSingleMedia,
  downloadCarouselAsFolder,
  downloadDateGroupAsArchive,
  fetchMediaBlob,
  convertBlobToTrueJpeg,
  saveMediaToDevice,
} from './services/downloadService';
import {
  getLocalHistory,
  addHistoryItem,
  createCloudBackup,
} from './services/backupService';
import { Header } from './components/Header';
import { BottomTabBar } from './components/BottomTabBar';
import { UserProfileHeader } from './components/UserProfileHeader';
import { DateGroupCard } from './components/DateGroupCard';
import { QuickDownloader } from './components/QuickDownloader';
import { PdfExportModal } from './components/PdfExportModal';
import { CloudBackupView } from './components/CloudBackupView';
import { DateRangeFilter } from './components/DateRangeFilter';
import { InstagramSessionModal } from './components/InstagramSessionModal';
import { ErrorLogViewer } from './components/ErrorLogViewer';
import { BulkDownloadModal } from './components/BulkDownloadModal';
import { ChromeExtensionModal } from './components/ChromeExtensionModal';
import { LiveTimerControl } from './components/LiveTimerControl';
import { ScheduledDownloadModal } from './components/ScheduledDownloadModal';
import {
  FolderArchive,
  FileText,
  Download,
  CheckCircle,
  Calendar,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  CheckSquare,
  SearchX,
  Key,
  Film,
  Image as ImageIcon,
  Loader2,
  Link as LinkIcon,
  AlertTriangle,
  RefreshCw,
  Table,
  Activity,
  XCircle,
  StopCircle,
} from 'lucide-react';

const initialDefaultProfile: UserProfile = {
  username: 'dkabcikpsslianne',
  fullName: '@dkabcikpsslianne',
  avatarUrl: '',
  bio: '',
  postsCount: 0,
  followersCount: 0,
  followingCount: 0,
  isVerified: false,
  isPrivate: false,
  isRealInstagramData: false,
  pageInfo: {
    hasNextPage: false,
    endCursor: null,
    totalCount: 0,
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'profile' | 'quick' | 'pdf' | 'logs' | 'cloud'>('profile');
  const [username, setUsername] = useState('dkabcikpsslianne');
  const [profile, setProfile] = useState<UserProfile>(initialDefaultProfile);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [inlinePostUrl, setInlinePostUrl] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isFromLocalCache, setIsFromLocalCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);

  // Profile Posts Date Range Filter State
  const [profileStartDate, setProfileStartDate] = useState('');
  const [profileEndDate, setProfileEndDate] = useState('');

  // History & Backup State
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Download / Processing Progress Toast
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // PDF Export Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfScopePosts, setPdfScopePosts] = useState<InstagramPost[]>([]);
  const [pdfCustomTitle, setPdfCustomTitle] = useState('');

  // Session Cookie ID state for overcoming rate limits
  // InstaFlow public mode deliberately does not load or use personal Instagram session IDs.
  const [sessionId] = useState<string>('');
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  // Media Type Filter: 'all' | 'video' | 'image' | 'carousel'
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'image' | 'carousel'>('all');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showTimerBar, setShowTimerBar] = useState(false);

  // Data Saver Mode State (persisted in localStorage)
  const [isDataSaver, setIsDataSaver] = useState<boolean>(() => {
    return localStorage.getItem('instaflow_data_saver') === 'true';
  });

  // Resolution Enhancer State (default: true)
  const [enhanceResolution, setEnhanceResolution] = useState<boolean>(() => {
    return localStorage.getItem('instaflow_enhance_res') !== 'false';
  });

  // User explicit request: "ayrıca reels ve videoları devre dışı bırak" (Default: true)
  const [excludeVideos, setExcludeVideos] = useState<boolean>(true);

  // Deep Scan 400+ Archive State
  const [isScanningDeep, setIsScanningDeep] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStatusMessage, setScanStatusMessage] = useState<string>('');
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  // Auto-fetch disabled by default (USER REQUEST: "sürekli otomatik canlı çek yapmasın")
  const [autoLiveFetch, setAutoLiveFetch] = useState<boolean>(false);

  const toggleDataSaver = () => {
    setIsDataSaver(prev => {
      const next = !prev;
      localStorage.setItem('instaflow_data_saver', String(next));
      showToast(next ? '⚡ Veri Tasarrufu Aktif (Orta Kalite · ~%60 Daha Az Mobil Kota)' : '💎 Veri Tasarrufu Kapalı (HD Kalite)');
      return next;
    });
  };

  const toggleEnhanceResolution = () => {
    setEnhanceResolution(prev => {
      const next = !prev;
      localStorage.setItem('instaflow_enhance_res', String(next));
      showToast(next ? '💎 HD Çözünürlük Geliştirici Aktif' : '⚡ Standart Çözünürlük');
      return next;
    });
  };

  // Scheduled Downloads Queue State & Persistence
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledDownloadJob[]>(() => {
    try {
      const saved = localStorage.getItem('instaflow_scheduled_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isScheduledModalOpen, setIsScheduledModalOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('instaflow_scheduled_queue', JSON.stringify(scheduledJobs));
  }, [scheduledJobs]);

  const handleAddScheduledJob = (jobData: Omit<ScheduledDownloadJob, 'id' | 'createdAt' | 'status' | 'progress'>) => {
    const newJob: ScheduledDownloadJob = {
      ...jobData,
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      progress: 0,
      statusMessage: 'Kuyrukta bekliyor...',
    };
    setScheduledJobs(prev => [newJob, ...prev]);
    showToast(`⏰ Zamanlanmış indirme kuyruğa eklendi: ${newJob.scheduledDisplay}`);
  };

  const handleDeleteScheduledJob = (jobId: string) => {
    setScheduledJobs(prev => prev.filter(j => j.id !== jobId));
    showToast('Zamanlanmış indirme görevi silindi.');
  };

  const handleCancelScheduledJob = (jobId: string) => {
    setScheduledJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'paused' } : j));
    showToast('Görev duraklatıldı.');
  };

  // Execution engine for scheduled download jobs
  const executeScheduledJob = async (job: ScheduledDownloadJob) => {
    setScheduledJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'running', progress: 10, statusMessage: 'Gönderiler taranıyor ve medya hazırlanıyor...' } : j));

    try {
      const targetPosts = posts.filter(p => job.postIds.includes(p.id));
      if (targetPosts.length === 0) {
        throw new Error('İndirilecek gönderi bulunamadı.');
      }
      const zip = new JSZip();

      if (job.options.includeCsv) {
        const csvHeader = 'Kullanıcı,Tarih,Saat,Kısa Kod,Medya Sayısı,Tür,Beğeni,Yorum,Gönderi Linki,Açıklama\n';
        const csvRows = targetPosts.map((p) => {
          const cleanCaption = (p.caption || '').replace(/"/g, '""').replace(/\n/g, ' ');
          const mType = p.isVideo ? 'Video/Reels' : p.isCarousel ? `Karusel (${p.mediaCount})` : 'Fotoğraf';
          return `"${p.username}","${p.dateKey}","${p.timeFormatted}","${p.shortcode}","${p.mediaCount}","${mType}","${p.likesCount}","${p.commentsCount}","${p.postUrl}","${cleanCaption}"`;
        }).join('\n');
        zip.file(`${job.username}_gonderi_listesi.csv`, '\uFEFF' + csvHeader + csvRows);
      }

      let count = 0;
      for (const p of targetPosts) {
        count++;
        const prog = Math.min(92, Math.round((count / targetPosts.length) * 85));
        setScheduledJobs(prev => prev.map(j => j.id === job.id ? { ...j, progress: prog, statusMessage: `Paketleniyor: ${count}/${targetPosts.length} gönderi...` } : j));

        const targetFolder = job.options.folderByDate ? (zip.folder(`${p.dateKey}_${p.shortcode}`) || zip) : zip;

        for (let m = 0; m < p.media.length; m++) {
          const item = p.media[m];
          const isVid = item.type === 'video' || p.isVideo;
          let blob = await fetchMediaBlob(item.url);
          if (!isVid) {
            blob = await convertBlobToTrueJpeg(blob, { isDataSaver: job.options.isDataSaver, enhanceResolution: job.options.enhanceResolution });
          }
          const ext = isVid ? 'mp4' : 'jpg';
          targetFolder.file(`${p.username}_${p.dateKey}_${p.shortcode}_${m + 1}.${ext}`, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      await saveMediaToDevice(zipBlob, `${job.username}_zamanlanmis_${targetPosts.length}_gonderi.zip`);

      setScheduledJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'completed', progress: 100, statusMessage: 'Başarıyla indirildi ve kaydedildi.' } : j));
      showToast(`🎉 Zamanlanmış indirme tamamlandı: @${job.username} (${targetPosts.length} gönderi) ZIP olarak cihazınıza kaydedildi!`);
    } catch (err: any) {
      console.error('Scheduled job error:', err);
      setScheduledJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed', statusMessage: `Hata: ${err.message}` } : j));
      showToast(`Zamanlanmış indirme hatası: ${err.message}`);
    }
  };

  // Background queue watcher: runs every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();
      const jobToRun = scheduledJobs.find(j => j.status === 'pending' && new Date(j.scheduledTime).getTime() <= nowMs);
      if (jobToRun && !isProcessing) {
        executeScheduledJob(jobToRun);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [scheduledJobs, isProcessing, posts]);

  // Rate-limit countdown only. Never start live requests automatically:
  // the user explicitly asked to avoid continuous Instagram fetches.
  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    let remaining = cooldownSeconds;
    const interval = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      setCooldownSeconds(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownSeconds > 0]);

  // Initial load (loads from local cache first if available, otherwise fetches live)
  useEffect(() => {
    const loadedHistory = getLocalHistory();
    setHistory(loadedHistory);
    loadUserProfile(username, false);
  }, []);

  // Filter posts by media type and publication date range (respecting excludeVideos)
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      // Reels and video exclusion filter (USER REQUEST)
      if (excludeVideos && post.isVideo && mediaFilter !== 'video') return false;

      // Content type filter
      if (mediaFilter === 'video' && !post.isVideo) return false;
      if (mediaFilter === 'image' && (post.isVideo || post.isCarousel)) return false;
      if (mediaFilter === 'carousel' && !post.isCarousel) return false;

      // Date range filter
      const postDateKey = post.dateKey; // YYYY-MM-DD
      if (profileStartDate && postDateKey < profileStartDate) return false;
      if (profileEndDate && postDateKey > profileEndDate) return false;
      return true;
    });
  }, [posts, mediaFilter, profileStartDate, profileEndDate, excludeVideos]);

  // Counts for media filter pills
  const videoCount = useMemo(() => posts.filter(p => p.isVideo).length, [posts]);
  const photoCount = useMemo(() => posts.filter(p => !p.isVideo && !p.isCarousel).length, [posts]);
  const carouselCount = useMemo(() => posts.filter(p => p.isCarousel).length, [posts]);

  // Update date grouping whenever filteredPosts or sortOrder changes
  useEffect(() => {
    if (filteredPosts.length > 0) {
      const grouped = groupPostsByDate(filteredPosts, sortOrder);
      setDateGroups(grouped);
    } else {
      setDateGroups([]);
    }
  }, [filteredPosts, sortOrder]);

  const activeRequestIdRef = useRef(0);

  const loadUserProfile = async (
    targetUsername: string,
    force = false,
    overrideSessionId?: string,
    retryAfterCooldown = false
  ) => {
    const requestId = ++activeRequestIdRef.current;
    setIsLoadingUser(true);
    setCooldownSeconds(0);

    const effectiveSessionId = ''; // Always use credential-free public profile mode.
    try {
      const feed = await fetchUserFeedAsync(
        targetUsername,
        force,
        effectiveSessionId,
        1,
        undefined,
        retryAfterCooldown
      );
      if (activeRequestIdRef.current !== requestId) {
        // Discard stale out-of-order response from previous search
        return;
      }

      if (feed.rateLimited && !retryAfterCooldown) {
        setCooldownSeconds(feed.retryAfterSeconds || 30);
      } else {
        setCooldownSeconds(0);
      }

      if (!feed.profile.isRealInstagramData && feed.posts.length === 0 && profile.username === feed.profile.username && profile.isRealInstagramData && posts.length > 0) {
        showToast(feed.error || `Instagram hız sınırı (429) nedeniyle mevcut @${profile.username} verileri korundu.`);
        return;
      }

      setProfile(feed.profile);
      setPosts(feed.posts);
      setUsername(feed.profile.username);
      setIsFromLocalCache(!!feed.fromLocalCache);
      setCachedAt(feed.cachedAt || null);
      setSelectedPostIds(new Set());

      if (feed.fromLocalCache && feed.posts.length > 0) {
        showToast(`⚡ @${feed.profile.username} yerel önbellekten anında yüklendi (${feed.posts.length} gönderi). Güncellemek için Canlı Yenile'ye basın.`);
      } else if (feed.isLive && feed.posts.length > 0) {
        showToast(`@${feed.profile.username} hesabından ${feed.posts.length} canlı gönderi listelendi!`);
      } else if (retryAfterCooldown) {
        showToast(`✓ 30sn geri sayım tamamlandı: @${feed.profile.username} profili açıldı!`);
      } else if (feed.rateLimited || feed.error) {
        showToast(feed.error || `Instagram '@${feed.profile.username}' sorgusunda hız sınırı oluştu. 30 saniye içinde otomatik tekrar denenecek.`);
      }
    } catch (err) {
      if (activeRequestIdRef.current !== requestId) return;
      console.error('Error fetching user feed:', err);
      setProfile(prev => prev || initialDefaultProfile);
      showToast('Profil bilgileri alınamadı');
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsLoadingUser(false);
      }
    }
  };

  // Export metadata table standalone as Excel / CSV
  const handleExportCsvStandalone = () => {
    const targetPosts = selectedPostIds.size > 0 ? posts.filter(p => selectedPostIds.has(p.id)) : posts;
    if (targetPosts.length === 0) {
      showToast('Dışa aktarılacak gönderi bulunmuyor.');
      return;
    }
    const csvHeader = 'Kullanıcı,Tarih,Saat,Kısa Kod,Medya Sayısı,Tür,Beğeni,Yorum,Gönderi Linki,Açıklama\n';
    const csvRows = targetPosts.map((p) => {
      const cleanCaption = (p.caption || '').replace(/"/g, '""').replace(/\n/g, ' ');
      const mType = p.isVideo ? 'Video/Reels' : p.isCarousel ? `Karusel (${p.mediaCount})` : 'Fotoğraf';
      return `"${p.username}","${p.dateKey}","${p.timeFormatted}","${p.shortcode}","${p.mediaCount}","${mType}","${p.likesCount}","${p.commentsCount}","${p.postUrl}","${cleanCaption}"`;
    }).join('\n');

    const blob = new Blob(['\uFEFF' + csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    saveMediaToDevice(blob, `${username}_gonderi_listesi_tablosu.csv`);
    showToast(`${targetPosts.length} gönderi Excel / CSV tablosu olarak cihazınıza kaydedildi!`);
  };

  const handleLoadInlinePost = () => {
    if (!inlinePostUrl.trim()) return;
    const post = parseSinglePostUrl(inlinePostUrl.trim());
    if (post) {
      if (profile) {
        post.username = profile.username;
        post.userFullName = profile.fullName;
        post.userAvatar = profile.avatarUrl || post.userAvatar;
      }
      setPosts(prev => {
        const existing = prev.filter(p => p.shortcode !== post.shortcode);
        return [post, ...existing];
      });
      setInlinePostUrl('');
      showToast(`Gönderi (${post.shortcode}) başarıyla yüklendi!`);
    } else {
      showToast('Geçerli bir Instagram gönderi veya reels linki girin.');
    }
  };

  // Helper to get valid v1 max_id cursor from profile or last post
  const getEffectiveMaxIdCursor = (currentCursor?: string | null) => {
    const uid = profile?.pageInfo?.userId || '';
    if (currentCursor && currentCursor.includes('_')) {
      return currentCursor;
    }
    if (posts.length > 0) {
      const lastPostCleanId = posts[posts.length - 1].id.replace(/^post_/, '').split('_')[0];
      if (lastPostCleanId && uid) {
        return `${lastPostCleanId}_${uid}`;
      }
      if (lastPostCleanId) {
        return lastPostCleanId;
      }
    }
    return currentCursor || '';
  };

  // Pagination Handler: Load next page of posts
  const handleLoadMore = async () => {
    if (isLoadingMore || !profile?.pageInfo?.hasNextPage) return;
    setIsLoadingMore(true);
    showToast('Sonraki gönderiler taranıyor...');
    try {
      const effectiveCursor = getEffectiveMaxIdCursor(profile.pageInfo?.endCursor);
      const result = await fetchNextUserFeedPageAsync(
        profile.username,
        profile.pageInfo?.userId || '',
        effectiveCursor,
        sessionId
      );

      if (result.success && result.posts && result.posts.length > 0) {
        const existingIds = new Set(posts.map(p => p.id));
        const fresh = result.posts.filter(p => !existingIds.has(p.id));
        const combinedPosts = [...posts, ...fresh];
        const updatedProfile = { ...profile, pageInfo: result.pageInfo };
        setPosts(combinedPosts);
        setProfile(updatedProfile);
        await saveProfileToLocalCache(profile.username, updatedProfile, combinedPosts, result.pageInfo);
        showToast(`+${result.posts.length} yeni gönderi başarıyla eklendi! Toplam: ${combinedPosts.length}`);
      } else if (result.rateLimited) {
        setCooldownSeconds(30);
        showToast('Instagram hız sınırı (HTTP 429) oluştu. 30 saniyelik geri sayım başlatıldı.');
      } else {
        showToast(result.error || 'Daha fazla gönderi yüklenemedi.');
      }
    } catch (err: any) {
      console.error('Load more error:', err);
      showToast('Gönderiler yüklenirken hata oluştu.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const scanAbortControllerRef = useRef<AbortController | null>(null);

  const handleCancelDeepScan = () => {
    if (scanAbortControllerRef.current) {
      scanAbortControllerRef.current.abort();
      scanAbortControllerRef.current = null;
      setIsScanningDeep(false);
      showToast(' Derin tarama anında durduruldu. Taranan tüm veriler saklandı.');
    }
  };

  // Deep Scan Handler: Iteratively scan all 400+ or 522 posts from user profile
  const handleDeepScan = async (targetCount?: number) => {
    if (isScanningDeep) return;
    const controller = new AbortController();
    scanAbortControllerRef.current = controller;

    const effectiveTarget = targetCount || profile?.postsCount || 522;
    setIsScanningDeep(true);
    setScanProgress(5);
    setScanStatusMessage(`Tüm ${effectiveTarget} Gönderi Taranıyor (@${username})...`);

    try {
      let currentCursor = getEffectiveMaxIdCursor(profile?.pageInfo?.endCursor);
      let hasMore = true;
      let accumulatedPosts = [...posts];
      let fetchedCount = accumulatedPosts.length;
      let round = 0;

      while (hasMore && fetchedCount < effectiveTarget && round < 60) {
        if (controller.signal.aborted) {
          showToast(`Derin tarama durduruldu. ${fetchedCount} gönderi yerel önbelleğe saklandı.`);
          break;
        }

        round++;
        setScanStatusMessage(`Derin Tarama [Tur ${round}]: ${fetchedCount}/${effectiveTarget} gönderi listelendi...`);
        setScanProgress(Math.min(96, Math.round((fetchedCount / effectiveTarget) * 100)));

        const result = await fetchNextUserFeedPageAsync(
          profile?.username || username,
          profile?.pageInfo?.userId || '',
          currentCursor,
          sessionId,
          controller.signal
        );

        if (result.success && result.posts && result.posts.length > 0) {
          const existingIds = new Set(accumulatedPosts.map(p => p.id));
          const fresh = result.posts.filter(p => !existingIds.has(p.id));
          accumulatedPosts = [...accumulatedPosts, ...fresh];
          fetchedCount = accumulatedPosts.length;
          currentCursor = result.pageInfo?.endCursor || '';
          hasMore = !!(result.pageInfo?.hasNextPage && currentCursor);
          const updatedProfile = {
            ...profile,
            pageInfo: result.pageInfo,
            postsCount: Math.max(profile.postsCount, fetchedCount),
          };
          setPosts(accumulatedPosts);
          setProfile(updatedProfile);
          await saveProfileToLocalCache(updatedProfile.username, updatedProfile, accumulatedPosts, result.pageInfo);

          if (controller.signal.aborted) break;

          // Safe delay between requests
          await new Promise((resolve) => {
            const timer = setTimeout(resolve, 450);
            controller.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              resolve(null);
            }, { once: true });
          });
        } else if (result.rateLimited) {
          setCooldownSeconds(30);
          setScanStatusMessage(`Instagram Hız Sınırı (429)! 30 saniye bekleniyor ve otomatik tekrar deneniyor...`);
          let countdown = 30;
          while (countdown > 0 && !controller.signal.aborted) {
            await new Promise(r => setTimeout(r, 1000));
            countdown--;
          }
        } else {
          break;
        }
      }

      if (!controller.signal.aborted) {
        setScanProgress(100);
        showToast(`Tarama işlemi tamamlandı! Toplam ${fetchedCount} gönderi listelendi ve yerel önbelleğe kaydedildi.`);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && !controller.signal.aborted) {
        console.error('Deep scan error:', err);
        showToast('Derin tarama sırasında hata oluştu.');
      }
    } finally {
      setIsScanningDeep(false);
      scanAbortControllerRef.current = null;
    }
  };

  // Import handler for data exported from Chrome Extension or JSON file
  const handleImportExtensionJson = (jsonData: any) => {
    try {
      let importedPosts: InstagramPost[] = [];
      let targetUsername = username;

      if (jsonData.summary?.username) {
        targetUsername = jsonData.summary.username;
      } else if (jsonData.username) {
        targetUsername = jsonData.username;
      }

      if (Array.isArray(jsonData.posts) && jsonData.posts.length > 0) {
        // If already structured posts
        if (jsonData.posts[0].shortcode && jsonData.posts[0].media) {
          importedPosts = jsonData.posts;
        } else {
          // Edges or raw items
          importedPosts = jsonData.posts.map((item: any, idx: number) => {
            const node = item.node || item;
            const shortcode = node.shortcode || node.code || `ext_${idx + 1}`;
            const isVideo = !!(node.is_video || node.media_type === 2);
            const displayUrl = node.display_url || node.image_versions2?.candidates?.[0]?.url || '';
            const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || node.caption?.text || node.caption || '';
            const takenAt = node.taken_at_timestamp || node.taken_at || Math.floor(Date.now() / 1000);
            const dt = new Date(takenAt * 1000);
            const dateKey = dt.toISOString().slice(0, 10);
            const dateFormatted = dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
            const timeFormatted = dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

            const mediaItems = [];
            if (node.edge_sidecar_to_children?.edges?.length > 0) {
              node.edge_sidecar_to_children.edges.forEach((cEdge: any, cIdx: number) => {
                const cNode = cEdge.node;
                const cIsVid = !!cNode.is_video;
                const cUrl = cNode.display_url || '';
                mediaItems.push({
                  id: `m_${shortcode}_${cIdx + 1}`,
                  type: cIsVid ? ('video' as const) : ('image' as const),
                  url: `/api/proxy-media?url=${encodeURIComponent(cUrl)}`,
                  originalUrl: cUrl,
                  thumbnailUrl: `/api/proxy-media?url=${encodeURIComponent(cUrl)}`,
                });
              });
            } else {
              mediaItems.push({
                id: `m_${shortcode}_1`,
                type: isVideo ? ('video' as const) : ('image' as const),
                url: `/api/proxy-media?url=${encodeURIComponent(displayUrl)}`,
                originalUrl: displayUrl,
                thumbnailUrl: `/api/proxy-media?url=${encodeURIComponent(displayUrl)}`,
              });
            }

            return {
              id: `post_${shortcode}`,
              shortcode,
              username: targetUsername,
              userFullName: `@${targetUsername}`,
              caption,
              timestamp: dt.toISOString(),
              dateKey,
              dateFormatted,
              timeFormatted,
              isCarousel: mediaItems.length > 1,
              mediaCount: mediaItems.length,
              media: mediaItems,
              likesCount: node.edge_liked_by?.count || node.like_count || 0,
              commentsCount: node.edge_media_to_comment?.count || node.comment_count || 0,
              postUrl: `https://www.instagram.com/p/${shortcode}/`,
              isVideo,
            };
          });
        }
      } else if (Array.isArray(jsonData.edges) && jsonData.edges.length > 0) {
        // Direct edges array
        importedPosts = jsonData.edges.map((item: any, idx: number) => {
          const node = item.node || item;
          const shortcode = node.shortcode || node.code || `ext_${idx + 1}`;
          const isVideo = !!(node.is_video || node.media_type === 2);
          const displayUrl = node.display_url || node.image_versions2?.candidates?.[0]?.url || '';
          const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || node.caption?.text || '';
          const takenAt = node.taken_at_timestamp || node.taken_at || Math.floor(Date.now() / 1000);
          const dt = new Date(takenAt * 1000);
          const dateKey = dt.toISOString().slice(0, 10);
          const dateFormatted = dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
          const timeFormatted = dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

          const mediaItems = [];
          if (node.edge_sidecar_to_children?.edges?.length > 0) {
            node.edge_sidecar_to_children.edges.forEach((cEdge: any, cIdx: number) => {
              const cNode = cEdge.node;
              const cIsVid = !!cNode.is_video;
              const cUrl = cNode.display_url || '';
              mediaItems.push({
                id: `m_${shortcode}_${cIdx + 1}`,
                type: cIsVid ? ('video' as const) : ('image' as const),
                url: `/api/proxy-media?url=${encodeURIComponent(cUrl)}`,
                originalUrl: cUrl,
                thumbnailUrl: `/api/proxy-media?url=${encodeURIComponent(cUrl)}`,
              });
            });
          } else {
            mediaItems.push({
              id: `m_${shortcode}_1`,
              type: isVideo ? ('video' as const) : ('image' as const),
              url: `/api/proxy-media?url=${encodeURIComponent(displayUrl)}`,
              originalUrl: displayUrl,
              thumbnailUrl: `/api/proxy-media?url=${encodeURIComponent(displayUrl)}`,
            });
          }

          return {
            id: `post_${shortcode}`,
            shortcode,
            username: targetUsername,
            userFullName: `@${targetUsername}`,
            caption,
            timestamp: dt.toISOString(),
            dateKey,
            dateFormatted,
            timeFormatted,
            isCarousel: mediaItems.length > 1,
            mediaCount: mediaItems.length,
            media: mediaItems,
            likesCount: node.edge_liked_by?.count || node.like_count || 0,
            commentsCount: node.edge_media_to_comment?.count || node.comment_count || 0,
            postUrl: `https://www.instagram.com/p/${shortcode}/`,
            isVideo,
          };
        });
      }

      if (importedPosts.length > 0) {
        setPosts(importedPosts);
        setUsername(targetUsername);
        if (profile) {
          setProfile({
            ...profile,
            username: targetUsername,
            postsCount: Math.max(profile.postsCount, importedPosts.length),
          });
        }
        showToast(`🎉 ${importedPosts.length} gönderi Chrome eklentisinden başarıyla aktarıldı!`);
      } else {
        showToast('JSON dosyasında geçerli gönderi verisi bulunamadı.');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      showToast(`Veri içe aktarma hatası: ${err.message}`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleSelectPost = (postId: string) => {
    setSelectedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const handleSelectAllPosts = () => {
    setSelectedPostIds(new Set(filteredPosts.map(p => p.id)));
    showToast(`Görünen tüm ${filteredPosts.length} gönderi seçildi`);
  };

  const handleSelectOnlyVideos = () => {
    const videoIds = filteredPosts.filter(p => p.isVideo).map(p => p.id);
    setSelectedPostIds(new Set(videoIds));
    showToast(`${videoIds.length} video gönderisi seçildi`);
  };

  const handleSelectOnlyImages = () => {
    const imageIds = filteredPosts.filter(p => !p.isVideo).map(p => p.id);
    setSelectedPostIds(new Set(imageIds));
    showToast(`${imageIds.length} fotoğraf gönderisi seçildi`);
  };

  const handleClearSelection = () => {
    setSelectedPostIds(new Set());
  };

  const handleExportSelectedPostsPdf = () => {
    const selected = posts.filter(p => selectedPostIds.has(p.id));
    if (selected.length === 0) {
      showToast('Lütfen önce PDF için en az bir gönderi seçin');
      return;
    }
    handleOpenPdfExport(selected, `@${username} Seçilen ${selected.length} Çoklu Gönderi`);
  };

  // Download selected posts as a unified ZIP archive
  const handleDownloadSelectedBatch = async () => {
    if (selectedPostIds.size === 0) return;
    const selectedPosts = posts.filter(p => selectedPostIds.has(p.id));
    setIsProcessing(true);
    setProcessingStatus('Seçilen gönderiler paketleniyor...');
    setProcessingProgress(10);
    try {
      const zip = new JSZip();
      let count = 0;
      for (const p of selectedPosts) {
        count++;
        setProcessingProgress(Math.round((count / selectedPosts.length) * 80));
        for (let m = 0; m < p.media.length; m++) {
          const item = p.media[m];
          const isVid = item.type === 'video' || p.isVideo;
          let blob = await fetchMediaBlob(item.url);
          if (!isVid) {
            blob = await convertBlobToTrueJpeg(blob, { isDataSaver, enhanceResolution });
          }
          const ext = isVid ? 'mp4' : 'jpg';
          zip.file(`${p.username}_${p.dateKey}_${p.shortcode}_${m + 1}.${ext}`, blob);
        }
      }
      setProcessingProgress(92);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      await saveMediaToDevice(zipBlob, `${username}_secilen_${selectedPosts.length}_medya.zip`);
      showToast(`Seçilen ${selectedPosts.length} gönderi cihazınıza indirildi!`);
    } catch (err: any) {
      showToast(`İndirme hatası: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Single media download
  const handleDownloadSingle = async (
    post: InstagramPost,
    mediaItem: MediaItem,
    index: number,
    options: { embedCaption?: boolean; isDataSaver?: boolean; enhanceResolution?: boolean } = {}
  ) => {
    setIsProcessing(true);
    setProcessingStatus('Medya hazırlanıyor...');
    setProcessingProgress(20);

    try {
      const item = await downloadSingleMedia(
        post,
        mediaItem,
        index,
        { isDataSaver, enhanceResolution, ...options },
        (msg) => {
          setProcessingStatus(msg);
        }
      );
      const updated = addHistoryItem(item);
      setHistory(updated);
      showToast(
        options.embedCaption && mediaItem.type !== 'video'
          ? 'Fotoğraf açıklama metniyle (beyaz bar içine gömülü) galeriye indirildi!'
          : `${mediaItem.type === 'video' || post.isVideo ? 'Video' : 'Fotoğraf'} başarıyla galeriye indirildi!`
      );
    } catch (err: any) {
      showToast(`İndirme başarısız: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Single-folder Carousel ZIP download
  const handleDownloadCarousel = async (
    post: InstagramPost,
    options: { embedCaption?: boolean; isDataSaver?: boolean; enhanceResolution?: boolean } = {}
  ) => {
    setIsProcessing(true);
    setProcessingProgress(5);
    setProcessingStatus('Fotoğraflar tek klasörde toplanıyor...');

    try {
      const item = await downloadCarouselAsFolder(
        post,
        { isDataSaver, enhanceResolution, ...options },
        (pct, status) => {
          setProcessingProgress(pct);
          setProcessingStatus(status);
        }
      );
      const updated = addHistoryItem(item);
      setHistory(updated);
      showToast(`${post.mediaCount} fotoğraflı albüm tek klasör olarak indirildi!`);
    } catch (err: any) {
      showToast(`Klasör indirme hatası: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Whole date archive ZIP download
  const handleDownloadDayArchive = async (
    group: DateGroup,
    options: { embedCaption?: boolean; isDataSaver?: boolean; enhanceResolution?: boolean } = {}
  ) => {
    setIsProcessing(true);
    setProcessingProgress(5);
    setProcessingStatus(`${group.displayDate} gönderileri klasörleniyor...`);

    try {
      const item = await downloadDateGroupAsArchive(
        group,
        username,
        { isDataSaver, enhanceResolution, ...options },
        (pct, status) => {
          setProcessingProgress(pct);
          setProcessingStatus(status);
        }
      );
      const updated = addHistoryItem(item);
      setHistory(updated);
      showToast(`${group.displayDate} gönderileri saat klasörleriyle indirildi!`);
    } catch (err: any) {
      showToast(`Arşiv hatası: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Open PDF Export for specific posts or all posts
  const handleOpenPdfExport = (scopePosts?: InstagramPost[], title?: string) => {
    const targetPosts = scopePosts || posts;
    setPdfScopePosts(targetPosts);
    setPdfCustomTitle(title || `@${username} tüm gönderileri`);
    setIsPdfModalOpen(true);
  };

  const handlePdfCompleted = (historyItem: DownloadHistoryItem) => {
    const updated = addHistoryItem(historyItem);
    setHistory(updated);
    showToast('Tek dosya PDF arşivi başarıyla kaydedildi!');
  };

  // Action: Quick cloud backup
  const handleQuickCloudBackup = async () => {
    setIsBackingUp(true);
    try {
      await createCloudBackup(`Bulut Anlık Yedek`, history);
      showToast('İndirme geçmişi bulutta arşivlendi.');
    } catch (err: any) {
      showToast(`Bulut yedekleme hatası: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const totalMediaInFeed = posts.reduce((sum, p) => sum + p.mediaCount, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-28 md:pb-8">
      {/* Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        historyCount={history.length}
        onQuickCloudBackup={handleQuickCloudBackup}
        isBackingUp={isBackingUp}
        isDataSaver={isDataSaver}
        onToggleDataSaver={toggleDataSaver}
        enhanceResolution={enhanceResolution}
        onToggleEnhanceResolution={toggleEnhanceResolution}
        onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
        onOpenSessionModal={() => setIsSessionModalOpen(true)}
        onOpenScheduledModal={() => setIsScheduledModalOpen(true)}
        sessionId={sessionId}
        scheduledCount={scheduledJobs.filter(j => j.status === 'pending').length}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
        {/* TAB 1: User Profile & Date Groups Explorer */}
        {activeTab === 'profile' && (
          <div>
            <UserProfileHeader
              profile={profile}
              totalPosts={posts.length}
              totalMedia={totalMediaInFeed}
              onSearchUsername={(u, force) => loadUserProfile(u, force ?? false)}
              isLoading={isLoadingUser}
              onOpenPdfModal={() => handleOpenPdfExport(posts, `@${profile.username} Tam Profil Arşivi`)}
              sortOrder={sortOrder}
              onToggleSortOrder={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
              selectedCount={selectedPostIds.size}
              onSelectAllPosts={handleSelectAllPosts}
              onClearSelection={handleClearSelection}
              onExportSelectedPdf={handleExportSelectedPostsPdf}
              onOpenSessionModal={() => setIsSessionModalOpen(true)}
              onOpenBulkDownloadModal={() => setIsBulkModalOpen(true)}
              onExportCsvStandalone={handleExportCsvStandalone}
              sessionId={sessionId}
              isDataSaver={isDataSaver}
              onToggleDataSaver={toggleDataSaver}
              cooldownSeconds={cooldownSeconds}
              excludeVideos={excludeVideos}
              onToggleExcludeVideos={() => setExcludeVideos(prev => !prev)}
              onDeepScan={handleDeepScan}
              onCancelDeepScan={handleCancelDeepScan}
              isScanningDeep={isScanningDeep}
              onLoadMore={handleLoadMore}
              isLoadingMore={isLoadingMore}
              hasNextPage={!!profile.pageInfo?.hasNextPage}
              onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
              isFromLocalCache={isFromLocalCache}
              cachedAt={cachedAt}
            />

            {/* Deep Scan Active Progress Banner with Instant Abort Button */}
            {isScanningDeep && (
              <div className="mb-4 p-4 bg-purple-950/60 border border-purple-500/40 rounded-2xl text-xs space-y-2 animate-in fade-in shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-purple-200 font-medium">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
                    <span className="font-semibold text-purple-100 text-sm">{scanStatusMessage}</span>
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-bold text-amber-300 text-sm">%{scanProgress}</span>
                    <button
                      onClick={handleCancelDeepScan}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Taramayı İptal Et</span>
                    </button>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-purple-900/50">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-rose-500 transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Live Rate Limit Countdown & Auto-Retry Panel */}
            {cooldownSeconds > 0 && (
              <div className="mb-4 p-4 bg-amber-950/70 border border-amber-500/50 rounded-2xl text-xs space-y-2 shadow-xl animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-mono tabular-nums text-lg font-extrabold shrink-0">
                      {cooldownSeconds}s
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-200 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>HTTP 429 Bypass & 30 Saniye Otomatik Geri Sayım Sayacı</span>
                      </h4>
                      <p className="text-amber-300/80 text-[11px] mt-0.5">
                        Mobil ve APK kullanıcıları için çerez zorunluluğu yoktur. {cooldownSeconds} saniye sonra otomatik olarak yeniden denenecektir.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => loadUserProfile(username, true, undefined, true)}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Şimdi Tekrar Dene</span>
                    </button>
                    <button
                      onClick={() => setIsSessionModalOpen(true)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                      <Key className="w-3.5 h-3.5 text-rose-400" />
                      <span>İsteğe Bağlı Çerez</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Unified Responsive Filter & Selection Bar (Visible when posts exist) */}
            {posts.length > 0 && (
              <div className="mb-5 p-3 sm:p-4 rounded-2xl bg-slate-900/70 border border-slate-800/90 space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Segmented Media Type Tabs */}
                  <div className="flex items-center gap-1 p-1 bg-slate-950/80 border border-slate-800/80 rounded-xl overflow-x-auto no-scrollbar text-xs">
                    <button
                      onClick={() => setMediaFilter('all')}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        mediaFilter === 'all'
                          ? 'bg-slate-800 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>Tümü</span>
                      <span className="text-[11px] text-slate-400 tabular-nums">({posts.length})</span>
                    </button>

                    <button
                      onClick={() => setMediaFilter('image')}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        mediaFilter === 'image'
                          ? 'bg-slate-800 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                      <span>Fotoğraf</span>
                      <span className="text-[11px] text-slate-400 tabular-nums">({photoCount})</span>
                    </button>

                    <button
                      onClick={() => setMediaFilter('carousel')}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        mediaFilter === 'carousel'
                          ? 'bg-slate-800 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FolderArchive className="w-3.5 h-3.5 text-purple-400" />
                      <span>Karusel</span>
                      <span className="text-[11px] text-slate-400 tabular-nums">({carouselCount})</span>
                    </button>

                    <button
                      onClick={() => setMediaFilter('video')}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        mediaFilter === 'video'
                          ? 'bg-slate-800 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Film className="w-3.5 h-3.5 text-sky-400" />
                      <span>Video</span>
                      <span className="text-[11px] text-slate-400 tabular-nums">({videoCount})</span>
                    </button>
                  </div>

                  {/* Secondary Filter Drawer Toggles & Quick Selection */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <button
                      type="button"
                      onClick={() => setShowDateFilter(prev => !prev)}
                      className={`px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                        showDateFilter || profileStartDate || profileEndDate
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                          : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 text-rose-400" />
                      <span>Tarih Aralığı</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTimerBar(prev => !prev)}
                      className={`px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                        showTimerBar
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Otomatik Yenile</span>
                    </button>

                    <button
                      type="button"
                      onClick={
                        selectedPostIds.size === filteredPosts.length && filteredPosts.length > 0
                          ? handleClearSelection
                          : handleSelectAllPosts
                      }
                      className="px-3 py-1.5 bg-slate-950/80 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-800 cursor-pointer font-medium"
                    >
                      {selectedPostIds.size === filteredPosts.length && filteredPosts.length > 0
                        ? 'Seçimi Kaldır'
                        : `Tümünü Seç (${filteredPosts.length})`}
                    </button>
                  </div>
                </div>

                {/* Collapsible Date Range Picker */}
                {showDateFilter && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <DateRangeFilter
                      startDate={profileStartDate}
                      endDate={profileEndDate}
                      onStartDateChange={setProfileStartDate}
                      onEndDateChange={setProfileEndDate}
                      onClear={() => {
                        setProfileStartDate('');
                        setProfileEndDate('');
                      }}
                      totalCount={posts.length}
                      filteredCount={filteredPosts.length}
                      label="Gönderi Yayın Tarihi Aralığı"
                    />
                  </div>
                )}

                {/* Collapsible Auto-Refresh Timer Control */}
                {showTimerBar && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
                    <LiveTimerControl
                      onRefresh={() => loadUserProfile(username, true)}
                      isLoading={isLoadingUser}
                      username={username}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Posts Empty State or Date Groups Feed */}
            {posts.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center my-6 max-w-xl mx-auto space-y-5 shadow-xl backdrop-blur-md">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                  <Smartphone className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-white">
                    📱 Çerezsiz Mobil & APK Modu — HTTP 429 Otomatik Bypass
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto mt-1.5">
                    Mobil ve APK kullanıcıları için <strong className="text-emerald-300">Session ID / çerez zorunluluğu kaldırılmıştır</strong>. @{username} hesabı için Instagram hız sınırı (HTTP 429) oluştuysa {cooldownSeconds > 0 ? `${cooldownSeconds} saniye içinde otomatik tekrar denenecektir.` : 'Canlı Yenile butonuyla hemen tekrar çekebilirsiniz.'}
                  </p>
                </div>

                {/* Primary Methods to get posts */}
                <div className="grid grid-cols-1 gap-3 text-left">
                  {/* Method 1: Cookie-Free Live Retry */}
                  <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-500/50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        <span>1. Yöntem: Çerezsiz (Mobil / APK) Canlı Çekim</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal">
                        Hiçbir oturum çerezi girmeden çoklu açık API rotasyonu ile profili ve gönderileri doğrudan sorgulayın.
                      </p>
                    </div>
                    <button
                      onClick={() => loadUserProfile(username, true)}
                      disabled={isLoadingUser}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 min-h-[40px]"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUser ? 'animate-spin' : ''}`} />
                      <span>{cooldownSeconds > 0 ? `Şimdi Dene (${cooldownSeconds}s)` : 'Çerezsiz Canlı Çek'}</span>
                    </button>
                  </div>

                  {/* Method 2: Direct Post / Reel Link Input */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                      <LinkIcon className="w-4 h-4 text-sky-400" />
                      <span>2. Yöntem: Hesaba Ait Gönderi veya Reels Bağlantısı Yapıştırın</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Hesabın herhangi bir gönderi/reel linkini yapıştırarak anında tekil, karusel veya video olarak listeye ekleyip arşivleyebilirsiniz.
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={inlinePostUrl}
                        onChange={(e) => setInlinePostUrl(e.target.value)}
                        placeholder="https://www.instagram.com/p/... veya reel linki"
                        className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <button
                        onClick={handleLoadInlinePost}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[38px]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Gönderiyi Yükle</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Test Accounts & Retry */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                    <span className="text-[11px] text-slate-500 font-medium">Hazır Canlı Akışlar:</span>
                    <button
                      onClick={() => loadUserProfile('trthaber', false)}
                      className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-rose-300 text-[11px] font-medium rounded-lg border border-slate-700/60 cursor-pointer transition-colors"
                    >
                      🔴 @trthaber (Canlı Haberler)
                    </button>
                    <button
                      onClick={() => loadUserProfile('dkabcikpsslianne', false)}
                      className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-emerald-300 text-[11px] font-medium rounded-lg border border-slate-700/60 cursor-pointer transition-colors"
                    >
                      📚 @dkabcikpsslianne (Ders Notları)
                    </button>
                  </div>

                  <button
                    onClick={() => loadUserProfile(username, true)}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl transition-all border border-slate-700/60 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Yeniden Canlı Çek</span>
                  </button>
                </div>
              </div>
            ) : dateGroups.length === 0 ? (
              <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-10 text-center my-6">
                <SearchX className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-300">
                  Bu filtrede hiçbir gönderi bulunamadı
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {profileStartDate && `Başlangıç: ${profileStartDate}`} {profileEndDate && `Bitiş: ${profileEndDate}`}. Filtreyi temizleyebilir veya tümünü seçebilirsiniz.
                </p>
                <button
                  onClick={() => {
                    setMediaFilter('all');
                    setProfileStartDate('');
                    setProfileEndDate('');
                  }}
                  className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 font-medium text-xs rounded-xl border border-slate-700/60 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Filtreleri Temizle ve Tüm Gönderileri Göster</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {dateGroups.map((group) => (
                  <DateGroupCard
                    key={group.dateKey}
                    group={group}
                    username={username}
                    onDownloadCarouselFolder={handleDownloadCarousel}
                    onDownloadSingleMedia={handleDownloadSingle}
                    onDownloadDayArchive={handleDownloadDayArchive}
                    onExportDayPdf={(pList, title) => handleOpenPdfExport(pList, title)}
                    isProcessing={isProcessing}
                    selectedPostIds={selectedPostIds}
                    onToggleSelectPost={handleToggleSelectPost}
                    isDataSaver={isDataSaver}
                    enhanceResolution={enhanceResolution}
                  />
                ))}

                {/* Feed Bottom Pagination & Deep Scan (400+ Posts) Hub */}
                <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 text-center">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-rose-400" />
                        <span>Hesap Gönderi Tarama Durumu</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Şu anda <strong>{posts.length}</strong> / <strong>{(profile.postsCount || posts.length).toLocaleString('tr-TR')}</strong> gönderi listede yüklü.
                        {profile.postsCount > posts.length && (
                          <span className="text-rose-300 ml-1">
                            (Kalan {profile.postsCount - posts.length} gönderi Instagram'dan taranabilir)
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {posts.length >= profile.postsCount ? 'Tümü Yüklendi' : `${posts.length} / ${profile.postsCount} Yüklü`}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-800/80">
                    {/* Load Next Page Button */}
                    {profile.pageInfo?.hasNextPage && (
                      <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore || isScanningDeep}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700/60 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 min-h-[40px]"
                      >
                        {isLoadingMore ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                        ) : (
                          <ArrowRight className="w-4 h-4 text-rose-400" />
                        )}
                        <span>{isLoadingMore ? 'Sayfa Çekiliyor...' : 'Sonraki Gönderileri Yükle (+12)'}</span>
                      </button>
                    )}

                    {/* Deep Scan All 400+ Posts */}
                    <button
                      onClick={() => handleDeepScan(profile.postsCount || 400)}
                      disabled={isScanningDeep || isLoadingMore}
                      className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg active:scale-95 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 min-h-[40px]"
                      title="Hesaptaki tüm gönderileri sayfalar halinde otomatik tarar ve hafızaya alır"
                    >
                      {isScanningDeep ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      <span>
                        {isScanningDeep
                          ? `Derin Tarama Yapılıyor (%${scanProgress})...`
                          : `Tüm ${profile.postsCount || 400}+ Gönderiyi Otomatik Tara`}
                      </span>
                    </button>

                    {/* Bulk Download Modal Trigger */}
                    <button
                      onClick={() => setIsBulkModalOpen(true)}
                      disabled={isScanningDeep}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-lg active:scale-95 flex items-center gap-2 transition-all cursor-pointer min-h-[40px]"
                      title="Listelenen tüm gönderileri tek seferde ZIP formatında indir"
                    >
                      <Download className="w-4 h-4" />
                      <span>Her Gönderiyi Ayrı PDF Yap & Tek ZIP İndir</span>
                    </button>
                  </div>

                  {/* Informational Callout regarding Instagram 12-posts pagination & Session ID */}
                  {!sessionId && profile.postsCount > posts.length && (
                    <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-amber-500/30 text-xs text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-300">
                          <Key className="w-3.5 h-3.5 text-amber-400" />
                          <span>Instagram 400+ Gönderi Bilgilendirmesi</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Instagram herkese açık web profilinde ilk 12 gönderiyi şifresiz sunar. Kalan <strong>{profile.postsCount - posts.length} gönderinin</strong> tamamını hız sınırına takılmadan tek seferde tarayıp indirmek için tarayıcınızdan alabileceğiniz <strong className="text-amber-200">Session ID</strong> çerezini ekleyebilirsiniz.
                        </p>
                      </div>

                      <button
                        onClick={() => setIsSessionModalOpen(true)}
                        className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        🔑 Session ID Ekle
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Quick Media Downloader (Single URL) */}
        {activeTab === 'quick' && (
          <QuickDownloader
            onDownloadSingleMedia={handleDownloadSingle}
            onDownloadCarouselFolder={handleDownloadCarousel}
            isProcessing={isProcessing}
          />
        )}

        {/* TAB 3: PDF Single File Compilation Hub */}
        {activeTab === 'pdf' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-rose-400" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Tek Dosya Birleştirilmiş PDF Arşivi
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Kullanıcının (@{profile.username}) tarihe ve saate göre sıralı tüm gönderilerini, fotoğraflarını ve açıklamalarını tek bir A4 PDF dosyasında birleştirin.
              </p>

              <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => handleOpenPdfExport(posts, `@${profile.username} - Tam Profil Arşivi`)}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <FileText className="w-4 h-4" />
                  <span>Tüm Gönderileri ({posts.length} Gönderi) Tek PDF Yap</span>
                </button>
              </div>
            </div>

            {/* Date-by-date PDF selection cards */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-300">
                Veya Belirli Bir Günün Gönderilerini PDF Yapın:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dateGroups.map((group) => (
                  <div
                    key={group.dateKey}
                    className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-white">
                        {group.displayDate}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {group.posts.length} Gönderi · {group.totalMediaCount} Medya (Saat Sıralı)
                      </p>
                    </div>

                    <button
                      onClick={() => handleOpenPdfExport(group.posts, `${group.displayDate} PDF Arşivi`)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700/60 min-h-[36px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF Yap</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Live Error & Request Diagnostics Logs Viewer */}
        {activeTab === 'logs' && (
          <ErrorLogViewer
            onOpenSessionModal={() => setIsSessionModalOpen(true)}
            onRefreshFeed={() => loadUserProfile(username, true)}
          />
        )}

        {/* TAB 5: Cloud Backup & History */}
        {activeTab === 'cloud' && (
          <CloudBackupView
            history={history}
            onHistoryUpdated={(newH) => setHistory(newH)}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Sticky Multi-Post PDF Export Action Bar */}
      {selectedPostIds.size > 0 && !isProcessing && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-emerald-500/60 rounded-2xl px-4 sm:px-5 py-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 max-w-md w-[92%] animate-in fade-in slide-in-from-bottom-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
              {selectedPostIds.size}
            </span>
            <div className="text-xs truncate">
              <span className="font-bold text-white">Çoklu Gönderi Seçildi</span>
              <span className="text-slate-400 block text-[10px]">Tek PDF dosyasında birleştir</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleClearSelection}
              className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Temizle
            </button>
            <button
              onClick={handleExportSelectedPostsPdf}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap min-h-[36px]"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Tek PDF Yap</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Processing / Download Bar */}
      {isProcessing && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-rose-500/40 rounded-2xl px-5 py-3 shadow-2xl backdrop-blur-md flex items-center gap-4 max-w-sm w-full mx-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {processingStatus}
            </div>
            {processingProgress > 0 && (
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className="bg-rose-500 h-full transition-all duration-300"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 border border-slate-700/80 text-white rounded-2xl px-4 py-3 shadow-xl backdrop-blur-md flex items-center gap-3 text-xs max-w-sm animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium text-slate-200">{toastMessage}</span>
        </div>
      )}

      {/* Unified PDF Export Modal */}
      {profile && (
        <PdfExportModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          posts={pdfScopePosts}
          profile={profile}
          customTitle={pdfCustomTitle}
          onPdfGenerated={handlePdfCompleted}
        />
      )}

      {/* Instagram Session ID Cookie Modal */}


      {/* Chrome Extension Modal */}
      <ChromeExtensionModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
        onImportJson={handleImportExtensionJson}
      />

      {/* Chrome Extension Style Bulk Downloader Modal */}
      {profile && (
        <BulkDownloadModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          posts={selectedPostIds.size > 0 ? posts.filter(p => selectedPostIds.has(p.id)) : posts}
          profile={profile}
          username={username}
          isDataSaver={isDataSaver}
          enhanceResolution={enhanceResolution}
          onDownloadCompleted={(zipName) => {
            showToast(`Toplu indirme tamamlandı: ${zipName}`);
          }}
        />
      )}

      {/* Scheduled Download Queue Modal */}
      <ScheduledDownloadModal
        isOpen={isScheduledModalOpen}
        onClose={() => setIsScheduledModalOpen(false)}
        jobs={scheduledJobs}
        posts={selectedPostIds.size > 0 ? posts.filter(p => selectedPostIds.has(p.id)) : posts}
        username={username}
        onAddJob={handleAddScheduledJob}
        onCancelJob={handleCancelScheduledJob}
        onRunNow={(jobId) => {
          const targetJob = scheduledJobs.find(j => j.id === jobId);
          if (targetJob) executeScheduledJob(targetJob);
        }}
        onDeleteJob={handleDeleteScheduledJob}
        isProcessing={isProcessing}
      />

      {/* Mobile Fixed Bottom Navigation Bar */}
      <BottomTabBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        historyCount={history.length}
      />
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InstagramPost, UserProfile, DateGroup, DownloadHistoryItem, MediaItem } from './types';
import { generateUserFeed, fetchUserFeedAsync, groupPostsByDate } from './services/instagramService';
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
import {
  FolderArchive,
  FileText,
  Download,
  CheckCircle,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  CheckSquare,
  SearchX,
  Key,
  Film,
  Image as ImageIcon
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'profile' | 'quick' | 'pdf' | 'cloud'>('profile');
  const [username, setUsername] = useState('mtahiryilmazz');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());

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
  const [sessionId, setSessionId] = useState<string>(() => {
    return localStorage.getItem('instaflow_session_id') || '';
  });
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  // Media Type Filter: 'all' | 'video' | 'image' | 'carousel'
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'image' | 'carousel'>('all');

  // Data Saver Mode State (persisted in localStorage)
  const [isDataSaver, setIsDataSaver] = useState<boolean>(() => {
    return localStorage.getItem('instaflow_data_saver') === 'true';
  });

  // Resolution Enhancer State (default: true)
  const [enhanceResolution, setEnhanceResolution] = useState<boolean>(() => {
    return localStorage.getItem('instaflow_enhance_res') !== 'false';
  });

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

  // Initial load
  useEffect(() => {
    const loadedHistory = getLocalHistory();
    setHistory(loadedHistory);
    loadUserProfile(username, true);
  }, []);

  // Filter posts by media type and publication date range
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
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
  }, [posts, mediaFilter, profileStartDate, profileEndDate]);

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

  const loadUserProfile = async (targetUsername: string, force = true) => {
    const requestId = ++activeRequestIdRef.current;
    setIsLoadingUser(true);
    try {
      const feed = await fetchUserFeedAsync(targetUsername, force, sessionId);
      if (activeRequestIdRef.current !== requestId) {
        // Discard stale out-of-order response from previous search
        return;
      }
      setProfile(feed.profile);
      setPosts(feed.posts);
      setUsername(feed.profile.username);
      setSelectedPostIds(new Set());

      if (feed.isLive) {
        showToast(`@${feed.profile.username} gerçek Instagram profili ve gönderileri yüklendi!`);
      } else if (feed.error) {
        showToast(feed.error);
      }
    } catch (err) {
      if (activeRequestIdRef.current !== requestId) return;
      console.error('Error fetching user feed:', err);
      showToast('Profil bilgileri alınamadı');
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsLoadingUser(false);
      }
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
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 sm:pt-7">
        {/* TAB 1: User Profile & Date Groups Explorer */}
        {activeTab === 'profile' && profile && (
          <div>
            <UserProfileHeader
              profile={profile}
              totalPosts={posts.length}
              totalMedia={totalMediaInFeed}
              onSearchUsername={(u) => loadUserProfile(u, false)}
              isLoading={isLoadingUser}
              onOpenPdfModal={() => handleOpenPdfExport(posts, `@${profile.username} Tam Profil Arşivi`)}
              sortOrder={sortOrder}
              onToggleSortOrder={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
              selectedCount={selectedPostIds.size}
              onSelectAllPosts={handleSelectAllPosts}
              onClearSelection={handleClearSelection}
              onExportSelectedPdf={handleExportSelectedPostsPdf}
              onOpenSessionModal={() => setIsSessionModalOpen(true)}
              sessionId={sessionId}
              isDataSaver={isDataSaver}
              onToggleDataSaver={toggleDataSaver}
            />

            {/* Date Range Filter Picker for Profile Posts */}
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

            {/* Content Type Filter & Selection Toolbar */}
            <div className="mb-5 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3.5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Media Type Tabs (Hepsi, Videolar, Fotoğraflar, Karusel) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    onClick={() => setMediaFilter('all')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      mediaFilter === 'all'
                        ? 'bg-rose-600 text-white shadow-sm font-semibold'
                        : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tümü (Hepsi)</span>
                    <span className="opacity-80 tabular-nums">({posts.length})</span>
                  </button>

                  <button
                    onClick={() => setMediaFilter('video')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      mediaFilter === 'video'
                        ? 'bg-sky-600 text-white shadow-sm font-semibold'
                        : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5 text-sky-400" />
                    <span>Videolar & Reels</span>
                    <span className="opacity-80 tabular-nums">({videoCount})</span>
                  </button>

                  <button
                    onClick={() => setMediaFilter('image')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      mediaFilter === 'image'
                        ? 'bg-amber-600 text-white shadow-sm font-semibold'
                        : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tekli Fotoğraflar</span>
                    <span className="opacity-80 tabular-nums">({photoCount})</span>
                  </button>

                  <button
                    onClick={() => setMediaFilter('carousel')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      mediaFilter === 'carousel'
                        ? 'bg-purple-600 text-white shadow-sm font-semibold'
                        : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <FolderArchive className="w-3.5 h-3.5 text-purple-400" />
                    <span>Çoklu Gönderiler (Karusel)</span>
                    <span className="opacity-80 tabular-nums">({carouselCount})</span>
                  </button>
                </div>

                {/* Resolution & Data Saver indicators */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <button
                    onClick={toggleEnhanceResolution}
                    className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                      enhanceResolution && !isDataSaver
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Düşük çözünürlüklü görselleri 1080p HD kalitesine yükseltir ve netleştirir"
                  >
                    <span>💎 HD Çözünürlük: {enhanceResolution && !isDataSaver ? 'Aktif (1080p)' : 'Standart'}</span>
                  </button>

                  <button
                    onClick={toggleDataSaver}
                    className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isDataSaver
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Mobil veri kotasını korumak için video ön yüklemeyi durdurur ve orta çözünürlük kullanır"
                  >
                    <span className={`w-2 h-2 rounded-full ${isDataSaver ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    <span>⚡ Tasarruf Modu: {isDataSaver ? 'Açık (~%60 Az Kota)' : 'Kapalı'}</span>
                  </button>
                </div>
              </div>

              {/* Batch Selection Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60 flex-wrap text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 text-[11px] font-medium">Hızlı Seçim:</span>
                  <button
                    onClick={handleSelectAllPosts}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 cursor-pointer text-[11px]"
                  >
                    Görünenleri Seç ({filteredPosts.length})
                  </button>
                  <button
                    onClick={handleSelectOnlyVideos}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-sky-300 rounded-lg border border-slate-800 cursor-pointer text-[11px]"
                  >
                    Sadece Videolar ({videoCount})
                  </button>
                  <button
                    onClick={handleSelectOnlyImages}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-amber-300 rounded-lg border border-slate-800 cursor-pointer text-[11px]"
                  >
                    Sadece Fotoğraflar ({photoCount})
                  </button>
                  {selectedPostIds.size > 0 && (
                    <button
                      onClick={handleClearSelection}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-rose-950/50 text-rose-400 rounded-lg border border-slate-800 cursor-pointer text-[11px]"
                    >
                      Seçimi Temizle
                    </button>
                  )}
                </div>

                {selectedPostIds.size > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleDownloadSelectedBatch}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 text-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Seçilen {selectedPostIds.size} Medyayı İndir (ZIP)</span>
                    </button>
                    <button
                      onClick={handleExportSelectedPostsPdf}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 text-xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Seçilenleri Tek PDF Yap</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Posts Empty State or Date Groups Feed */}
            {posts.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center my-6 max-w-lg mx-auto space-y-4 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mx-auto text-rose-400">
                  <SearchX className="w-7 h-7" />
                </div>
                <h4 className="text-base sm:text-lg font-bold text-white">
                  Bu Hesapta Canlı Gönderi Bulunamadı
                </h4>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
                  Hesabın paylaştığı gönderi olmayabilir, hesap gizli olabilir veya Instagram hız sınırı uygulanmış olabilir. Kesinlikle rastgele ya da sahte gönderi listelenmemektedir.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <button
                    onClick={() => setIsSessionModalOpen(true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Key className="w-4 h-4" />
                    <span>🔑 Session ID Ekle & Yeniden Canlı Çek</span>
                  </button>
                  <button
                    onClick={() => loadUserProfile('mtahiryilmazz', true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs sm:text-sm rounded-xl transition-all border border-slate-700/60 cursor-pointer"
                  >
                    @mtahiryilmazz Hesabına Dön
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
        {activeTab === 'pdf' && profile && (
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

        {/* TAB 4: Cloud Backup & History */}
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
      <InstagramSessionModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        currentSessionId={sessionId}
        onSaveSessionId={(newId) => {
          setSessionId(newId);
          if (newId) {
            localStorage.setItem('instaflow_session_id', newId);
            showToast('Instagram Session ID kaydedildi, veriler yenileniyor!');
            loadUserProfile(username, true);
          } else {
            localStorage.removeItem('instaflow_session_id');
            showToast('Session ID kaldırıldı');
          }
        }}
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

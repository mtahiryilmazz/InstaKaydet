import React, { useState, useRef } from 'react';
import { InstagramPost, MediaItem, UserProfile } from '../types';
import JSZip from 'jszip';
import { fetchMediaBlob, convertBlobToTrueJpeg, embedCaptionInImage, saveMediaToDevice } from '../services/downloadService';
import { generateSinglePdfArchive, generateSinglePostPdf } from '../services/pdfService';
import {
  Download,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  Film,
  Image as ImageIcon,
  FolderArchive,
  Table,
  Sparkles,
  ShieldCheck,
  Package,
  Layers,
  Archive,
  BookOpen
} from 'lucide-react';

interface BulkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  posts: InstagramPost[];
  profile: UserProfile;
  username: string;
  isDataSaver: boolean;
  enhanceResolution: boolean;
  onDownloadCompleted?: (zipName: string, count: number) => void;
}

export const BulkDownloadModal: React.FC<BulkDownloadModalProps> = ({
  isOpen,
  onClose,
  posts,
  profile,
  username,
  isDataSaver: defaultDataSaver,
  enhanceResolution: defaultEnhance,
  onDownloadCompleted,
}) => {
  if (!isOpen) return null;

  // Options - Default exclude reels & videos and include per-post PDF in single ZIP as requested
  const [excludeVideos, setExcludeVideos] = useState(true); // REQ: "ayrıca reels ve videoları devre dışı bırak"
  const [includePdfInZip, setIncludePdfInZip] = useState(true); // REQ: "pdf dönüşümü yaprıktan sonra tek seferde zip formatında indirsin"
  // USER EXPLICIT REQUIREMENT: "400 küsür göneriyi tek pdf değil her gönderiyi tek pdf yapacak, bir gönderi içinde fazla resim varsa onlarıda tek pdf içinde birleştirecek"
  const [pdfStructure, setPdfStructure] = useState<'per_post' | 'single_master'>('per_post');
  const [includeImagesInZip, setIncludeImagesInZip] = useState(true);
  const [includeCsvInZip, setIncludeCsvInZip] = useState(true);
  const [embedCaption, setEmbedCaption] = useState(false);
  const [dataSaver, setDataSaver] = useState(defaultDataSaver);
  const [enhance, setEnhance] = useState(defaultEnhance);

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [currentStep, setCurrentStep] = useState<'idle' | 'fetching' | 'pdf' | 'zipping' | 'done'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [zipResultName, setZipResultName] = useState('');

  const cancelRef = useRef(false);
  const pauseRef = useRef(false);

  // Filter posts according to excludeVideos option
  const effectivePosts = posts.filter(p => {
    if (excludeVideos && p.isVideo) return false;
    return true;
  });

  // Compute all media files to download
  const mediaQueue: { post: InstagramPost; media: MediaItem; index: number }[] = [];
  effectivePosts.forEach((p) => {
    p.media.forEach((m, idx) => {
      const isVid = m.type === 'video' || p.isVideo;
      if (isVid && excludeVideos) return;
      mediaQueue.push({ post: p, media: m, index: idx });
    });
  });

  const videoCount = posts.filter(p => p.isVideo).length;
  const imagePostsCount = posts.filter(p => !p.isVideo).length;

  const handleStartDownload = async () => {
    if (mediaQueue.length === 0 && !includePdfInZip) return;

    setIsDownloading(true);
    setIsPaused(false);
    setCurrentStep('fetching');
    cancelRef.current = false;
    pauseRef.current = false;
    setTotalFiles(mediaQueue.length);
    setProgress(0);
    setCurrentIndex(0);

    const zip = new JSZip();
    let downloadedCount = 0;

    try {
      // PHASE 1: Fetch and add image files into ZIP
      if (includeImagesInZip && mediaQueue.length > 0) {
        for (let i = 0; i < mediaQueue.length; i++) {
          if (cancelRef.current) {
            setStatusText('İndirme kullanıcı tarafından iptal edildi.');
            setIsDownloading(false);
            setCurrentStep('idle');
            return;
          }

          // Handle pause
          while (pauseRef.current) {
            setStatusText('İndirme duraklatıldı. Devam etmek için Başlat\'a basın.');
            await new Promise((r) => setTimeout(r, 400));
            if (cancelRef.current) {
              setIsDownloading(false);
              setCurrentStep('idle');
              return;
            }
          }

          const item = mediaQueue[i];
          setCurrentIndex(i + 1);
          setStatusText(`[1/3] Görsel ${i + 1}/${mediaQueue.length} hazırlanıyor: @${item.post.username}_${item.post.dateKey}_${item.index + 1}...`);
          setProgress(Math.round(((i + 0.5) / mediaQueue.length) * (includePdfInZip ? 55 : 85)));

          const isVid = item.media.type === 'video' || item.post.isVideo;

          try {
            let blob = await fetchMediaBlob(item.media.url);
            if (!isVid) {
              blob = await convertBlobToTrueJpeg(blob, {
                isDataSaver: dataSaver,
                enhanceResolution: enhance,
              });
              if (embedCaption && item.post.caption) {
                blob = await embedCaptionInImage(blob, item.post, item.index, { isDataSaver: dataSaver });
              }
            }

            const ext = isVid ? 'mp4' : 'jpg';
            const safeCaptionPrefix = item.post.shortcode || `${i + 1}`;
            const fileName = `gorseller/${String(i + 1).padStart(3, '0')}_${item.post.dateKey}_${safeCaptionPrefix}_${item.index + 1}.${ext}`;
            zip.file(fileName, blob);
            downloadedCount++;
          } catch (itemErr) {
            console.warn(`File download failed for ${item.media.url}:`, itemErr);
          }

          // Safe pacing between requests
          await new Promise((r) => setTimeout(r, 60));
        }
      }

      // PHASE 2: Generate PDF Archive and add into ZIP
      if (includePdfInZip && effectivePosts.length > 0) {
        setCurrentStep('pdf');
        setStatusText(`[2/3] Gönderiler PDF'e dönüştürülüyor (${pdfStructure === 'per_post' ? 'Her gönderi ayrı PDF' : 'Tek master PDF'})...`);
        setProgress(includeImagesInZip ? 60 : 20);

        try {
          if (pdfStructure === 'per_post') {
            // USER EXPLICIT REQUIREMENT:
            // "400 küsür göneriyi tek pdf değil her gönderiyi tek pdf yapacak, bir gönderi içinde fazla resim varsa onlarıda tek pdf içinde birleştirecek"
            let generatedCount = 0;
            for (let pIdx = 0; pIdx < effectivePosts.length; pIdx++) {
              if (cancelRef.current) break;
              const post = effectivePosts[pIdx];
              const pct = includeImagesInZip
                ? Math.round(60 + ((pIdx + 1) / effectivePosts.length) * 30)
                : Math.round(20 + ((pIdx + 1) / effectivePosts.length) * 70);
              setProgress(pct);
              setStatusText(`[2/3] Gönderi ${pIdx + 1}/${effectivePosts.length} PDF yapılıyor: @${post.username} (${post.dateFormatted}) ${post.isCarousel ? `[${post.mediaCount} slayt tek PDF]` : ''}`);

              const singlePdfRes = await generateSinglePostPdf(
                post,
                profile,
                {
                  includeCaptions: embedCaption,
                  includeStats: false,
                  includeTimestamps: true,
                  includeUserHeader: true,
                  theme: 'clean',
                  pageSize: 'a4',
                  excludeVideos,
                },
                pIdx + 1
              );

              if (singlePdfRes) {
                zip.file(`pdf_gonderiler/${singlePdfRes.filename}`, singlePdfRes.pdfBlob);
                generatedCount++;
              }
              await new Promise(r => setTimeout(r, 20));
            }
          } else {
            // Single master PDF option
            const pdfResult = await generateSinglePdfArchive(
              effectivePosts,
              profile,
              {
                includeCaptions: embedCaption,
                includeStats: false,
                includeTimestamps: true,
                includeUserHeader: true,
                theme: 'clean',
                pageSize: 'a4',
                excludeVideos,
              },
              (pct, msg) => {
                const scaledProgress = includeImagesInZip 
                  ? Math.round(60 + (pct * 0.25))
                  : Math.round(20 + (pct * 0.65));
                setProgress(scaledProgress);
                setStatusText(`[2/3 PDF Dönüşümü] ${msg}`);
              },
              false
            );
            const pdfFileName = `00_${username}_TAM_ARSIV_${effectivePosts.length}_GONDERI.pdf`;
            zip.file(pdfFileName, pdfResult.pdfBlob);
          }
        } catch (pdfErr: any) {
          console.error('PDF generation inside ZIP failed:', pdfErr);
          setStatusText(`PDF oluşturulurken uyarı: ${pdfErr.message}. ZIP işlemine devam ediliyor...`);
        }
      }

      // PHASE 3: Add CSV and JSON metadata indices
      if (includeCsvInZip && effectivePosts.length > 0) {
        const csvHeader = 'Kullanıcı,Tarih,Saat,Kısa Kod,Medya No,Tür,Beğeni,Yorum,Gönderi Linki,Açıklama\n';
        const csvRows = mediaQueue.map((item) => {
          const cleanCaption = (item.post.caption || '').replace(/"/g, '""').replace(/\n/g, ' ');
          return `"${item.post.username}","${item.post.dateKey}","${item.post.timeFormatted}","${item.post.shortcode}","${item.index + 1}","${item.media.type}","${item.post.likesCount}","${item.post.commentsCount}","${item.post.postUrl}","${cleanCaption}"`;
        }).join('\n');
        zip.file('00_arsiv_ozet_tablosu.csv', '\uFEFF' + csvHeader + csvRows);

        const manifestJson = {
          account: username,
          totalPosts: effectivePosts.length,
          totalMediaFiles: mediaQueue.length,
          generatedAt: new Date().toISOString(),
          excludeVideosApplied: excludeVideos,
          isPdfIncluded: includePdfInZip,
        };
        zip.file('00_arsiv_metadata.json', JSON.stringify(manifestJson, null, 2));
      }

      // PHASE 4: Compress and download single ZIP file
      setCurrentStep('zipping');
      setStatusText('[3/3] Tek dosya ZIP arşivi derleniyor ve sıkıştırılıyor...');
      setProgress(92);

      const zipBlob = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 5 }
        },
        (metadata) => {
          setProgress(Math.round(92 + (metadata.percent * 0.07)));
        }
      );

      const finalZipName = `${username}_tam_arsiv_${effectivePosts.length}_gonderi_${new Date().toISOString().slice(0, 10)}.zip`;
      await saveMediaToDevice(zipBlob, finalZipName);

      setProgress(100);
      setCurrentStep('done');
      setZipResultName(finalZipName);
      setStatusText(`Tebrikler! PDF ve medya dosyaları tek bir ZIP (${finalZipName}) olarak cihazınıza kaydedildi.`);

      if (onDownloadCompleted) {
        onDownloadCompleted(finalZipName, downloadedCount);
      }
    } catch (err: any) {
      console.error('Bulk download error:', err);
      setStatusText(`Hata oluştu: ${err.message}`);
      setCurrentStep('idle');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
    setIsDownloading(false);
    setCurrentStep('idle');
  };

  const handleTogglePause = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(pauseRef.current);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-rose-600 flex items-center justify-center text-white shadow-md">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Tek Seferde PDF + ZIP İndirme Yöneticisi
              </h3>
              <p className="text-xs text-slate-400">
                @{username} · {posts.length} Gönderi · {excludeVideos ? `${imagePostsCount} Görsel Gönderi` : `${posts.length} Gönderi`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isDownloading}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Guidance Banner */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Kullanıcı İsteğine Özel İş Akışı</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            <strong className="text-white">1. Aşama:</strong> Tüm {posts.length} gönderi önce listede taranıp belleğe yüklendi.
            <br />
            <strong className="text-white">2. Aşama:</strong> Reels ve videolar devre dışı bırakılır, fotoğraflar A4 PDF kitabına dönüştürülür ve tüm içerik <strong className="text-emerald-300">tek seferde tek bir ZIP formatında</strong> cihazınıza indirilir.
          </p>
        </div>

        {/* Download Options */}
        {!isDownloading && currentStep !== 'done' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                İndirme ve Paketleme Seçenekleri:
              </h4>
              <span className="text-[11px] text-slate-400">
                Seçilen: {mediaQueue.length} Medya Dosyası
              </span>
            </div>

            <div className="space-y-2">
              {/* Option 1: Exclude Reels and Videos (USER EXPLICIT REQUEST) */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-rose-500/30 cursor-pointer hover:border-rose-500/50 transition-colors">
                <input
                  type="checkbox"
                  checked={excludeVideos}
                  onChange={(e) => setExcludeVideos(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-semibold text-white">Reels ve Videoları Devre Dışı Bırak</span>
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded font-medium">Önerilen</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {excludeVideos
                      ? `Açık: ${videoCount} video/reel atlandı, sadece ${imagePostsCount} adet fotoğraf ve slayt işlenecek (hızlı ve hafif).`
                      : `Kapalı: ${videoCount} video ve reel dosyası da dahil edilecek.`}
                  </p>
                </div>
              </label>

              {/* Option 2: PDF Conversion in ZIP (USER EXPLICIT REQUEST) */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/30 space-y-2.5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePdfInZip}
                    onChange={(e) => setIncludePdfInZip(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-white">PDF Dönüşümü Yapıp ZIP İçine Ekle</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-medium">Tek Seferde</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Gönderileri A4 PDF formatına çevirir ve tek ZIP paketi içinde indirir.
                    </p>
                  </div>
                </label>

                {/* Sub-selector for PDF Structure (Per-Post vs Single Master) */}
                {includePdfInZip && (
                  <div className="pt-2 pl-7 border-t border-slate-800/80 space-y-2">
                    <div className="text-[11px] font-semibold text-emerald-300">
                      PDF Yapılandırma Biçimi:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setPdfStructure('per_post')}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-2 ${
                          pdfStructure === 'per_post'
                            ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-sm'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Archive className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${pdfStructure === 'per_post' ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <div className="min-w-0">
                          <div className="font-semibold text-xs flex items-center gap-1.5">
                            <span>Her Gönderi Ayrı PDF</span>
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded">İstenen</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Karusel slaytları kendi PDF'inde birleşik ({effectivePosts.length} adet PDF).
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPdfStructure('single_master')}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-2 ${
                          pdfStructure === 'single_master'
                            ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-sm'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <BookOpen className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${pdfStructure === 'single_master' ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <div className="min-w-0">
                          <div className="font-semibold text-xs">
                            Tek Büyük Master PDF
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Tüm gönderiler tek bir ciltte birleşir.
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Option 3: Original JPEG photos folder */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={includeImagesInZip}
                  onChange={(e) => setIncludeImagesInZip(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-white">Orijinal JPEG Fotoğraflarını ZIP İçine Klasörle</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    ZIP içinde <code>gorseller/</code> klasöründe yüksek çözünürlüklü fotoğrafları sıralı olarak barındırır.
                  </p>
                </div>
              </label>

              {/* Option 4: Excel / CSV index */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={includeCsvInZip}
                  onChange={(e) => setIncludeCsvInZip(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-semibold text-white">Excel / CSV Tablosunu ve JSON Yedeğini Ekle</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Tüm gönderilerin tarih, saat, beğeni, yorum sayıları ve açıklamalarını içeren Türkçe Excel tablosu ekler.
                  </p>
                </div>
              </label>
            </div>

            {/* Quality & Caption Flags */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enhance && !dataSaver}
                  disabled={dataSaver}
                  onChange={(e) => setEnhance(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="text-slate-300 text-[11px] truncate">1080p HD Netleştirme</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={embedCaption}
                  onChange={(e) => setEmbedCaption(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="text-slate-300 text-[11px] truncate">Görsel Üzerine Açıklama Yaz</span>
              </label>
            </div>
          </div>
        )}

        {/* Active Progress Bar & Controls */}
        {isDownloading && (
          <div className="space-y-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {currentStep === 'fetching' && `Medya Hazırlanıyor (${currentIndex} / ${totalFiles})`}
                {currentStep === 'pdf' && 'PDF Dokümanı Derleniyor...'}
                {currentStep === 'zipping' && 'ZIP Paketleniyor...'}
              </span>
              <span className="font-bold text-emerald-400 tabular-nums text-sm">
                %{progress}
              </span>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 via-teal-400 to-rose-500 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-xs text-slate-300 truncate">
              {statusText}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleTogglePause}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPaused ? 'Devam Et' : 'Duraklat'}</span>
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>İptal Et</span>
              </button>
            </div>
          </div>
        )}

        {/* Done State */}
        {currentStep === 'done' && (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h4 className="text-base font-bold text-white">Tek Seferde İndirme Tamamlandı!</h4>
            <p className="text-xs text-slate-300">
              <strong>{zipResultName}</strong> dosyası cihazınıza indirildi.
            </p>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-left text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-emerald-300">ZIP İçeriği:</div>
              {includePdfInZip && <div>📄 <strong>00_{username}_TAM_ARSIV.pdf</strong> (A4 PDF Kitabı)</div>}
              {includeImagesInZip && <div>🖼️ <strong>gorseller/</strong> ({mediaQueue.length} adet sıralı JPEG)</div>}
              {includeCsvInZip && <div>📊 <strong>00_arsiv_ozet_tablosu.csv</strong> (Excel Uyumlu Rapor)</div>}
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md"
            >
              Kapat
            </button>
          </div>
        )}

        {/* Footer Actions */}
        {!isDownloading && currentStep !== 'done' && (
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Vazgeç
            </button>

            <button
              type="button"
              disabled={mediaQueue.length === 0 && !includePdfInZip}
              onClick={handleStartDownload}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-rose-600 hover:from-emerald-500 hover:to-rose-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>
                {includePdfInZip
                  ? `PDF Dönüştür ve Tek Seferde ZIP İndir (${mediaQueue.length} Görsel)`
                  : `Tüm Medyayı ZIP Olarak İndir (${mediaQueue.length})`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

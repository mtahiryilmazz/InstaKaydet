import React, { useState } from 'react';
import { InstagramPost, UserProfile, PdfExportOptions } from '../types';
import {
  FileText,
  X,
  CheckSquare,
  Square,
  Sparkles,
  Download,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Film,
  Archive,
  BookOpen
} from 'lucide-react';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  posts: InstagramPost[];
  profile: UserProfile;
  customTitle?: string;
  onPdfGenerated: (historyItem: any) => void;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  posts,
  profile,
  customTitle,
  onPdfGenerated,
}) => {
  // USER EXPLICIT REQUEST:
  // "400 küsür göneriyi tek pdf değil her gönderiyi tek pdf yapacak, bir gönderi içinde fazla resim varsa onlarıda tek pdf içinde birleştirecek"
  const [options, setOptions] = useState<PdfExportOptions>({
    includeCaptions: false,
    includeStats: false,
    includeTimestamps: true,
    includeUserHeader: true,
    theme: 'clean',
    pageSize: 'a4',
    excludeVideos: true,
    pdfMode: posts.length > 1 ? 'per_post' : 'single_master',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isFinished, setIsFinished] = useState(false);

  if (!isOpen) return null;

  const effectivePosts = posts.filter(p => {
    if (options.excludeVideos && p.isVideo) return false;
    return true;
  });

  const totalMediaCount = effectivePosts.reduce((acc, p) => acc + p.mediaCount, 0);

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    setProgress(5);
    setStatusMessage('Doküman hazırlanıyor...');

    try {
      // PDF motorunu yalnızca kullanıcı PDF dışa aktarmayı başlattığında yükle.
      const { generateSinglePdfArchive, generatePerPostPdfZipArchive } = await import('../services/pdfService');
      if (options.pdfMode === 'per_post' && effectivePosts.length > 1) {
        // PER-POST PDF ARCHIVE (Bundled in ZIP)
        const result = await generatePerPostPdfZipArchive(
          effectivePosts,
          profile,
          options,
          (pct, msg) => {
            setProgress(pct);
            setStatusMessage(msg);
          }
        );

        setIsFinished(true);
        onPdfGenerated(result.historyItem);
      } else {
        // SINGLE MASTER PDF DOCUMENT
        const result = await generateSinglePdfArchive(
          effectivePosts,
          profile,
          options,
          (pct, msg) => {
            setProgress(pct);
            setStatusMessage(msg);
          },
          true
        );

        setIsFinished(true);
        onPdfGenerated(result.historyItem);
      }

      setTimeout(() => {
        setIsGenerating(false);
        setIsFinished(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('PDF export error:', err);
      setStatusMessage(`Hata: ${err.message || 'PDF oluşturulamadı'}`);
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                PDF Dışa Aktarma Yöneticisi
              </h3>
              <p className="text-xs text-slate-400">
                {customTitle || `@${profile.username} ${effectivePosts.length} gönderi`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Scope Summary */}
        <div className="py-4 space-y-4">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              PDF Kapsam Özeti
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="text-lg font-bold text-white tabular-nums">
                  {effectivePosts.length}
                </div>
                <div className="text-[11px] text-slate-400">Gönderi</div>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="text-lg font-bold text-rose-400 tabular-nums">
                  {totalMediaCount}
                </div>
                <div className="text-[11px] text-slate-400">Toplam Sayfa</div>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-amber-400 truncate mt-1">
                  {options.pdfMode === 'per_post' ? `${effectivePosts.length} Ayrı PDF` : '1 Master PDF'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {options.pdfMode === 'per_post' ? 'ZIP Arşivi' : 'Tek Doküman'}
                </div>
              </div>
            </div>
          </div>

          {/* Mode Selector (Per Post vs Single Master) */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              PDF Yapılandırma Formatı:
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs">
              {/* Option A: Per Post PDF (USER REQUEST) */}
              <button
                type="button"
                onClick={() => setOptions(prev => ({ ...prev, pdfMode: 'per_post' }))}
                className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  options.pdfMode === 'per_post'
                    ? 'bg-rose-950/40 border-rose-500/60 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <Archive className={`w-4 h-4 mt-0.5 shrink-0 ${options.pdfMode === 'per_post' ? 'text-rose-400' : 'text-slate-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">
                      Her Gönderiyi Ayrı PDF Yap (Kendi Karuselleri Tek PDF)
                    </span>
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded font-medium">
                      İstenen
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Her gönderi bağımsız birer PDF dosyası olur. Çoklu resimli karuseller o gönderinin PDF'inde birleştirilir. Tümü tek ZIP olarak iner.
                  </p>
                </div>
              </button>

              {/* Option B: Single Master Document */}
              <button
                type="button"
                onClick={() => setOptions(prev => ({ ...prev, pdfMode: 'single_master' }))}
                className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  options.pdfMode === 'single_master'
                    ? 'bg-rose-950/40 border-rose-500/60 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <BookOpen className={`w-4 h-4 mt-0.5 shrink-0 ${options.pdfMode === 'single_master' ? 'text-rose-400' : 'text-slate-500'}`} />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white">
                    Tüm Gönderileri Tek Bir Master PDF'te Birleştir
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Tüm gönderileri tek bir cilt halinde tek A4 PDF dosyasında toplar.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Options Toggles */}
          <div className="space-y-2 pt-1">
            <div className="text-xs font-semibold text-slate-300">
              İçerik Tercihleri:
            </div>

            {/* Exclude Reels & Videos Toggle */}
            <button
              type="button"
              onClick={() =>
                setOptions(prev => ({ ...prev, excludeVideos: !prev.excludeVideos }))
              }
              className="w-full flex items-center justify-between p-3 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-xl text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex flex-col">
                <span className="text-slate-200 font-medium flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-rose-400" />
                  <span>Reels ve Videoları Devre Dışı Bırak</span>
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  {options.excludeVideos
                    ? 'Açık: Yalnızca görseller ve karusel slaytları PDF yapılacak (Önerilen)'
                    : 'Kapalı: Video ve reels önizlemeleri de dahil edilecek'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {options.excludeVideos ? (
                  <CheckSquare className="w-4 h-4 text-rose-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
              </div>
            </button>

            {/* Captions Toggle */}
            <button
              type="button"
              onClick={() =>
                setOptions(prev => ({ ...prev, includeCaptions: !prev.includeCaptions }))
              }
              className="w-full flex items-center justify-between p-3 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-xl text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex flex-col">
                <span className="text-slate-200 font-medium">Görsellerin Altına Açıklama Metinlerini Ekle</span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  {options.includeCaptions
                    ? 'Açık: Her görselin altında Instagram açıklaması yer alacak'
                    : 'Kapalı: Sade ve temiz fotoğraflar yer alacak (Varsayılan)'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {options.includeCaptions ? (
                  <CheckSquare className="w-4 h-4 text-rose-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
              </div>
            </button>

            {/* Timestamps Toggle */}
            <button
              type="button"
              onClick={() =>
                setOptions(prev => ({ ...prev, includeTimestamps: !prev.includeTimestamps }))
              }
              className="w-full flex items-center justify-between p-3 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-xl text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex flex-col">
                <span className="text-slate-200 font-medium">Gönderi Tarihi ve Saat Başlıkları</span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Tarih ve saat etiketlerini sayfa başlarında korur
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {options.includeTimestamps ? (
                  <CheckSquare className="w-4 h-4 text-rose-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
              </div>
            </button>
          </div>

          {/* Progress Indicator */}
          {isGenerating && (
            <div className="bg-slate-950 border border-rose-900/40 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-rose-300 font-medium truncate">{statusMessage}</span>
                <span className="font-bold text-white tabular-nums">%{progress}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-rose-500 to-amber-500 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs sm:text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            İptal
          </button>

          <button
            onClick={handleGeneratePdf}
            disabled={isGenerating || effectivePosts.length === 0}
            className="flex-2 py-3 px-4 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            {isFinished ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>PDF Arşivi İndirildi!</span>
              </>
            ) : isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>PDF Hazırlanıyor...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>
                  {options.pdfMode === 'per_post'
                    ? `Her Gönderiyi Ayrı PDF Yap (${effectivePosts.length} PDF · ZIP)`
                    : 'Tek Master PDF Olarak İndir'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { InstagramPost, UserProfile, PdfExportOptions } from '../types';
import { generateSinglePdfArchive } from '../services/pdfService';
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
  AlertCircle
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
  const [options, setOptions] = useState<PdfExportOptions>({
    includeCaptions: false, // User requested: do not add text at bottom by default, keep it optional
    includeStats: false,
    includeTimestamps: true,
    includeUserHeader: true,
    theme: 'clean',
    pageSize: 'a4',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isFinished, setIsFinished] = useState(false);

  if (!isOpen) return null;

  const totalMediaCount = posts.reduce((acc, p) => acc + p.mediaCount, 0);

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    setProgress(5);
    setStatusMessage('Doküman hazırlanıyor...');

    try {
      const result = await generateSinglePdfArchive(
        posts,
        profile,
        options,
        (pct, msg) => {
          setProgress(pct);
          setStatusMessage(msg);
        }
      );

      setIsFinished(true);
      onPdfGenerated(result.historyItem);

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
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Tek Dosya PDF Olarak Dışa Aktar
              </h3>
              <p className="text-xs text-slate-400">
                {customTitle || `@${profile.username} tüm gönderileri`}
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
        <div className="py-5 space-y-4">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              PDF Doküman Özeti
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="text-lg font-bold text-white tabular-nums">
                  {posts.length}
                </div>
                <div className="text-[11px] text-slate-400">Gönderi</div>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="text-lg font-bold text-rose-400 tabular-nums">
                  {totalMediaCount}
                </div>
                <div className="text-[11px] text-slate-400">Toplam Medya</div>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="text-lg font-bold text-amber-400 tabular-nums">
                  1 Dosya
                </div>
                <div className="text-[11px] text-slate-400">A4 PDF</div>
              </div>
            </div>
          </div>

          {/* Options Toggles */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-slate-300">
              PDF İçerik Seçenekleri
            </div>

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
                    : 'Kapalı: Sadece sade ve temiz fotoğraflar/medyalar yer alacak (Önerilen)'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${options.includeCaptions ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-800 text-slate-400'}`}>
                  {options.includeCaptions ? 'Metinli' : 'Sade Görsel (Kapalı)'}
                </span>
                {options.includeCaptions ? (
                  <CheckSquare className="w-4 h-4 text-rose-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setOptions(prev => ({ ...prev, includeStats: !prev.includeStats }))
              }
              className="w-full flex items-center justify-between p-3 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-xl text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex flex-col">
                <span className="text-slate-200 font-medium">Beğeni ve Yorum Sayılarını Göster</span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  {options.includeStats ? 'Açık' : 'Kapalı (Sade Arşiv)'}
                </span>
              </div>
              {options.includeStats ? (
                <CheckSquare className="w-4 h-4 text-rose-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setOptions(prev => ({ ...prev, includeTimestamps: !prev.includeTimestamps }))
              }
              className="w-full flex items-center justify-between p-3 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-xl text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex flex-col">
                <span className="text-slate-200 font-medium">Gönderi Yayın Saati ve Tarih Başlıkları</span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Tarih ve saat etiketlerini sayfa başlarında korur
                </span>
              </div>
              {options.includeTimestamps ? (
                <CheckSquare className="w-4 h-4 text-rose-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>

          {/* Progress Indicator */}
          {isGenerating && (
            <div className="bg-slate-950 border border-rose-900/40 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-rose-300 font-medium">{statusMessage}</span>
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
            disabled={isGenerating || posts.length === 0}
            className="flex-2 py-3 px-4 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            {isFinished ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>PDF Hazırlandı ve İndirildi!</span>
              </>
            ) : isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Tek Dosya PDF Derleniyor...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Tek PDF Olarak İndir</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

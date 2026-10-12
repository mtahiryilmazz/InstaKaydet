import React, { useState } from 'react';
import { InstagramPost, MediaItem } from '../types';
import { parseSinglePostUrl } from '../services/instagramService';
import {
  Download,
  Link as LinkIcon,
  Sparkles,
  FolderArchive,
  Film,
  Image as ImageIcon,
  CheckCircle,
  ExternalLink,
  Smartphone
} from 'lucide-react';

interface QuickDownloaderProps {
  onDownloadSingleMedia: (post: InstagramPost, mediaItem: MediaItem, index: number, options?: { embedCaption?: boolean }) => void;
  onDownloadCarouselFolder: (post: InstagramPost, options?: { embedCaption?: boolean }) => void;
  isProcessing: boolean;
}

const PRESET_LINKS = [
  {
    title: 'Kapadokya Carousel (4 Foto)',
    url: 'https://www.instagram.com/p/C_d1a1415_carousel/',
    type: 'carousel',
  },
  {
    title: 'Boğaz Günbatımı (HD Foto)',
    url: 'https://www.instagram.com/p/C_d1m930_photo/',
    type: 'photo',
  },
  {
    title: 'Gece Şehir Işıkları (Reels Video)',
    url: 'https://www.instagram.com/reel/C_d1e2045_video/',
    type: 'video',
  },
];

export const QuickDownloader: React.FC<QuickDownloaderProps> = ({
  onDownloadSingleMedia,
  onDownloadCarouselFolder,
  isProcessing,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [parsedPost, setParsedPost] = useState<InstagramPost | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [embedCaption, setEmbedCaption] = useState(false);

  const handleParse = (urlToParse?: string) => {
    const target = urlToParse || urlInput;
    if (!target.trim()) return;
    const post = parseSinglePostUrl(target);
    if (post) {
      setParsedPost(post);
      setActiveMediaIndex(0);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text);
        handleParse(text);
      }
    } catch {
      // Browser permission prompt or fallback
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Intro Hero Box */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 sm:p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-0.5 mx-auto mb-3 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-rose-400" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Hızlı Instagram Galeri İndirici
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
          Fotoğraf, Reels veya çoklu kaydırmalı (carousel) gönderi bağlantısını yapıştırın; doğrudan galerinize indirin.
        </p>

        {/* Input Bar */}
        <div className="mt-5 max-w-xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <LinkIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.instagram.com/p/... veya /reel/..."
                className="w-full pl-10 pr-24 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
              />
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="absolute inset-y-1.5 right-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-lg transition-colors cursor-pointer"
              >
                Yapıştır
              </button>
            </div>

            <button
              onClick={() => handleParse()}
              disabled={!urlInput.trim() || isProcessing}
              className="w-full sm:w-auto px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>Medyayı Getir</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 mt-3.5 overflow-x-auto pb-1 text-xs justify-center flex-wrap">
            <span className="text-slate-500 text-[11px]">Örnek Gönderiler:</span>
            {PRESET_LINKS.map((preset) => (
              <button
                key={preset.url}
                onClick={() => {
                  setUrlInput(preset.url);
                  handleParse(preset.url);
                }}
                className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer border border-slate-700/50 flex items-center gap-1 text-[11px]"
              >
                {preset.type === 'carousel' ? (
                  <FolderArchive className="w-3 h-3 text-amber-400" />
                ) : preset.type === 'video' ? (
                  <Film className="w-3 h-3 text-sky-400" />
                ) : (
                  <ImageIcon className="w-3 h-3 text-rose-400" />
                )}
                <span>{preset.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Parsed Result Display */}
      {parsedPost && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md transition-all">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
                <img
                  src={parsedPost.userAvatar}
                  alt={parsedPost.username}
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  @{parsedPost.username}
                  <CheckCircle className="w-3.5 h-3.5 text-sky-400" />
                </h4>
                <div className="text-[11px] text-slate-400">
                  {parsedPost.dateFormatted} · Saat {parsedPost.timeFormatted}
                </div>
              </div>
            </div>

            <a
              href={parsedPost.postUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-rose-400 hover:underline flex items-center gap-1"
            >
              <span>Instagram</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Media Visual */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
              {parsedPost.media[activeMediaIndex]?.type === 'video' ? (
                <video
                  src={parsedPost.media[activeMediaIndex]?.url}
                  controls
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={parsedPost.media[activeMediaIndex]?.url}
                  alt="Downloaded media"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              )}

              {parsedPost.isCarousel && (
                <div className="absolute top-2 left-2 bg-slate-950/90 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-700/60">
                  <FolderArchive className="w-3 h-3 text-amber-400" />
                  <span>Fotoğraf {activeMediaIndex + 1} / {parsedPost.mediaCount}</span>
                </div>
              )}
            </div>

            {/* Actions & Caption */}
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-slate-300 line-clamp-4 leading-relaxed">
                {parsedPost.caption}
              </p>

              {parsedPost.isCarousel && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400">Klasördeki Fotoğrafları Seç:</div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {parsedPost.media.map((m, idx) => (
                      <button
                        key={m.id}
                        onClick={() => setActiveMediaIndex(idx)}
                        className={`w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                          activeMediaIndex === idx
                            ? 'border-rose-500 scale-105'
                            : 'border-slate-800 opacity-60'
                        }`}
                      >
                        <img
                          src={m.thumbnailUrl || m.url}
                          alt={`Thumbnail ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Caption Embedding Selection Option */}
              {!parsedPost.isVideo && (
                <label className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer text-xs select-none transition-colors">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={embedCaption}
                      onChange={(e) => setEmbedCaption(e.target.checked)}
                      className="accent-rose-500 w-4 h-4 rounded cursor-pointer"
                    />
                    <span className="text-slate-200 font-medium text-[11px] sm:text-xs">
                      Görsel altına açıklama metnini beyaz barla göm
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${embedCaption ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'text-slate-500'}`}>
                    {embedCaption ? 'Metin Gömülecek' : 'Sade Görsel'}
                  </span>
                </label>
              )}

              <div className="pt-2 space-y-2">
                {parsedPost.isCarousel ? (
                  <>
                    <button
                      onClick={() => onDownloadCarouselFolder(parsedPost, { embedCaption })}
                      disabled={isProcessing}
                      className="w-full py-3 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
                    >
                      <FolderArchive className="w-4 h-4" />
                      <span>
                        Tek Klasörde Tümünü İndir (ZIP · {parsedPost.mediaCount} Foto {embedCaption ? '· Metinli' : '· Sade'})
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        onDownloadSingleMedia(
                          parsedPost,
                          parsedPost.media[activeMediaIndex],
                          activeMediaIndex,
                          { embedCaption }
                        )
                      }
                      disabled={isProcessing}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700/60 min-h-[40px]"
                    >
                      <Download className="w-3.5 h-3.5 text-rose-400" />
                      <span>
                        {embedCaption
                          ? `Foto ${activeMediaIndex + 1}'i Beyaz Barlı İndir`
                          : `Bu Fotoğrafı Galeriye İndir (${activeMediaIndex + 1}/${parsedPost.mediaCount})`}
                      </span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() =>
                      onDownloadSingleMedia(parsedPost, parsedPost.media[0], 0, { embedCaption })
                    }
                    disabled={isProcessing}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {parsedPost.isVideo
                        ? 'Videoyu Galeriye İndir (1080p MP4)'
                        : embedCaption
                        ? 'Fotoğrafı Açıklamalı İndir (Beyaz Bar İçinde)'
                        : 'Fotoğrafı Galeriye İndir (HD JPG)'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

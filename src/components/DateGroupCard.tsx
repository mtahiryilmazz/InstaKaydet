import React, { useState } from 'react';
import { DateGroup, InstagramPost, MediaItem } from '../types';
import {
  Calendar,
  Clock,
  FolderArchive,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Film,
  Copy,
  Check,
  Heart,
  MessageCircle,
  ExternalLink
} from 'lucide-react';

interface DateGroupCardProps {
  group: DateGroup;
  username: string;
  onDownloadCarouselFolder: (post: InstagramPost, options?: { embedCaption?: boolean; isDataSaver?: boolean; enhanceResolution?: boolean }) => void;
  onDownloadSingleMedia: (post: InstagramPost, mediaItem: MediaItem, index: number, options?: { embedCaption?: boolean; isDataSaver?: boolean; enhanceResolution?: boolean }) => void;
  onDownloadDayArchive: (group: DateGroup, options?: { embedCaption?: boolean; isDataSaver?: boolean; enhanceResolution?: boolean }) => void;
  onExportDayPdf: (posts: InstagramPost[], title: string) => void;
  isProcessing: boolean;
  selectedPostIds?: Set<string>;
  onToggleSelectPost?: (postId: string) => void;
  globalEmbedCaption?: boolean;
  isDataSaver?: boolean;
  enhanceResolution?: boolean;
}

export const DateGroupCard: React.FC<DateGroupCardProps> = ({
  group,
  username,
  onDownloadCarouselFolder,
  onDownloadSingleMedia,
  onDownloadDayArchive,
  onExportDayPdf,
  isProcessing,
  selectedPostIds,
  onToggleSelectPost,
  globalEmbedCaption = false,
  isDataSaver = false,
  enhanceResolution = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeMediaIndices, setActiveMediaIndices] = useState<{ [postId: string]: number }>({});
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [postEmbedCaptions, setPostEmbedCaptions] = useState<{ [postId: string]: boolean }>({});
  const [dayEmbedCaption, setDayEmbedCaption] = useState(false);

  const isPostEmbedCaption = (postId: string) => {
    if (postEmbedCaptions[postId] !== undefined) return postEmbedCaptions[postId];
    return globalEmbedCaption;
  };

  const togglePostEmbedCaption = (postId: string) => {
    setPostEmbedCaptions(prev => ({
      ...prev,
      [postId]: !isPostEmbedCaption(postId),
    }));
  };

  const getActiveIndex = (postId: string) => activeMediaIndices[postId] || 0;
  const setActiveIndex = (postId: string, index: number) => {
    setActiveMediaIndices(prev => ({ ...prev, [postId]: index }));
  };

  const handleCopyCaption = (postId: string, caption: string) => {
    navigator.clipboard.writeText(caption);
    setCopiedPostId(postId);
    setTimeout(() => setCopiedPostId(null), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden mb-6 shadow-sm transition-all">
      {/* Date Header Strip */}
      <div className="bg-slate-950/70 p-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              {group.displayDate}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>{group.posts.length} Gönderi</span>
              <span aria-hidden="true">·</span>
              <span>{group.totalMediaCount} Medya Öğesi</span>
              <span aria-hidden="true">·</span>
              <span className="text-rose-400 font-medium">Saat Sıralı</span>
            </div>
          </div>
        </div>

        {/* Date Group Quick Actions */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => onDownloadDayArchive(group)}
            disabled={isProcessing}
            className="px-3 py-2 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 min-h-[40px]"
            title="Bu tarihteki tüm gönderileri saat klasörleriyle ZIP olarak indir"
          >
            <FolderArchive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Günü İndir (ZIP)</span>
          </button>

          <button
            onClick={() => onExportDayPdf(group.posts, `${group.displayDate} Gönderileri`)}
            disabled={isProcessing}
            className="px-3 py-2 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 min-h-[40px]"
            title="Sadece bu günün gönderilerini tek PDF dosyası yap"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">Günü PDF Yap</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hidden sm:flex p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer min-h-[40px] min-w-[40px] items-center justify-center shrink-0"
            aria-label={isExpanded ? 'Gizle' : 'Genişlet'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Posts on this Date (Sorted by Post Time) */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6">
          {group.posts.map((post, postIdx) => {
            const activeIndex = getActiveIndex(post.id);
            const currentMedia = post.media[activeIndex] || post.media[0];

            return (
              <div
                key={post.id}
                className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 sm:p-5 transition-all hover:border-slate-700"
              >
                {/* Post Time & Category Indicator */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/70">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Saat {post.timeFormatted}</span>
                    </div>

                    <span className="text-xs text-slate-400 hidden sm:inline">
                      {post.isCarousel
                        ? `Çoklu Gönderi (${post.mediaCount} Fotoğraf)`
                        : post.isVideo
                        ? 'Video / Reels'
                        : 'Tekli Fotoğraf'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300 hover:text-white select-none bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                      <input
                        type="checkbox"
                        checked={selectedPostIds?.has(post.id) || false}
                        onChange={() => onToggleSelectPost?.(post.id)}
                        className="accent-rose-500 w-3.5 h-3.5 cursor-pointer rounded"
                      />
                      <span className="text-[11px] font-medium">PDF için Seç</span>
                    </label>

                    <a
                      href={post.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                    >
                      <span className="hidden sm:inline">Instagram</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Media Presentation Grid / Split */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Visual Media Box */}
                  <div className="md:col-span-5 relative group">
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                      {currentMedia.type === 'video' || post.isVideo ? (
                        <div className="relative w-full h-full bg-slate-950 flex items-center justify-center">
                          <video
                            src={currentMedia.url || undefined}
                            poster={(currentMedia.thumbnailUrl || post.userAvatar) || undefined}
                            controls
                            preload={isDataSaver ? "none" : "metadata"}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-sm text-slate-200 text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-700/50">
                            <Film className="w-3 h-3 text-rose-400" />
                            <span>Reels Video (MP4)</span>
                          </div>
                        </div>
                      ) : currentMedia.url ? (
                        <div className="relative w-full h-full">
                          <img
                            src={currentMedia.url}
                            alt={`Post ${post.shortcode}`}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {post.isCarousel && (
                            <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-sm text-slate-200 text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-700/50">
                              <FolderArchive className="w-3 h-3 text-amber-400" />
                              <span>{activeIndex + 1} / {post.mediaCount} Fotoğraf</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 text-xs">
                          Görsel
                        </div>
                      )}

                      {/* Quality & Resolution indicator */}
                      <div className="absolute bottom-2 right-2 bg-slate-950/85 backdrop-blur-sm text-[10px] px-2 py-0.5 rounded-md text-slate-300 border border-slate-700/50">
                        {isDataSaver ? (
                          <span className="text-emerald-400 font-medium">⚡ Orta Kalite (Düşük Kota)</span>
                        ) : (
                          <span className="text-amber-300 font-medium">💎 1080p HD (Çözünürlük Yüksek)</span>
                        )}
                      </div>
                    </div>

                    {/* Carousel Thumbnail Strip (If post has multiple photos) */}
                    {post.isCarousel && post.media.length > 1 && (
                      <div className="mt-2.5">
                        <div className="text-[11px] text-slate-400 mb-1.5 flex items-center justify-between">
                          <span>Klasördeki Fotoğraflar:</span>
                          <span className="text-amber-400 font-medium">Tek klasörde toplanacak</span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {post.media.map((item, idx) => (
                            <button
                              key={item.id}
                              onClick={() => setActiveIndex(post.id, idx)}
                              className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                                activeIndex === idx
                                  ? 'border-rose-500 scale-105 shadow-md shadow-rose-950'
                                  : 'border-slate-800 opacity-60 hover:opacity-100'
                              }`}
                            >
                              {(item.thumbnailUrl || item.url) ? (
                                <img
                                  src={item.thumbnailUrl || item.url}
                                  alt={`Thumb ${idx + 1}`}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-[10px] text-slate-500">
                                  {idx + 1}
                                </div>
                              )}
                              <span className="absolute bottom-0 right-0 bg-slate-950/80 text-[9px] text-white px-1 font-bold">
                                {idx + 1}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Download Actions & Metadata */}
                  <div className="md:col-span-7 flex flex-col justify-between h-full space-y-4">
                    {/* Caption & Location */}
                    <div>
                      {post.location && (
                        <div className="text-xs text-rose-400/90 font-medium mb-1">
                          📍 {post.location}
                        </div>
                      )}
                      <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
                        {post.caption}
                      </p>

                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
                          <span className="tabular-nums font-semibold">
                            {post.likesCount.toLocaleString('tr-TR')}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <MessageCircle className="w-3.5 h-3.5 text-sky-400" />
                          <span className="tabular-nums font-semibold">
                            {post.commentsCount.toLocaleString('tr-TR')}
                          </span>
                        </span>
                        <button
                          onClick={() => handleCopyCaption(post.id, post.caption)}
                          className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors ml-auto cursor-pointer"
                          title="Açıklamayı kopyala"
                        >
                          {copiedPostId === post.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Kopyalandı</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Metni Kopyala</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Download Controls & Caption Embedding Toggle */}
                    <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                      {/* Caption Embedding Selection Option */}
                      {!post.isVideo && (
                        <label className="flex items-center justify-between p-2.5 bg-slate-900/90 hover:bg-slate-900 border border-slate-800 rounded-xl cursor-pointer text-xs select-none transition-colors">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isPostEmbedCaption(post.id)}
                              onChange={() => togglePostEmbedCaption(post.id)}
                              className="accent-rose-500 w-4 h-4 rounded cursor-pointer"
                            />
                            <span className="text-slate-200 font-medium text-[11px] sm:text-xs">
                              Görsel altına açıklama metnini beyaz barla göm
                            </span>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${isPostEmbedCaption(post.id) ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'text-slate-500'}`}>
                            {isPostEmbedCaption(post.id) ? 'Metin Gömülecek' : 'Sade Görsel'}
                          </span>
                        </label>
                      )}

                      {/* If Carousel: Highlight Single Folder Download requirement */}
                      {post.isCarousel ? (
                        <div className="space-y-2">
                          <button
                            onClick={() => onDownloadCarouselFolder(post, { embedCaption: isPostEmbedCaption(post.id), isDataSaver, enhanceResolution })}
                            disabled={isProcessing}
                            className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
                          >
                            <FolderArchive className="w-4 h-4" />
                            <span>
                              Klasör Olarak İndir (Tek Klasörde {post.mediaCount} Foto {isPostEmbedCaption(post.id) ? '· Metinli' : '· Sade'})
                            </span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onDownloadSingleMedia(post, currentMedia, activeIndex, { embedCaption: isPostEmbedCaption(post.id), isDataSaver, enhanceResolution })}
                              disabled={isProcessing}
                              className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700/60 min-h-[40px]"
                            >
                              <Download className="w-3.5 h-3.5 text-rose-400" />
                              <span>
                                {isPostEmbedCaption(post.id)
                                  ? `Foto ${activeIndex + 1}'i Beyaz Barlı İndir`
                                  : `Foto ${activeIndex + 1}'i HD İndir`}
                              </span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onDownloadSingleMedia(post, currentMedia, 0, { embedCaption: isPostEmbedCaption(post.id), isDataSaver, enhanceResolution })}
                            disabled={isProcessing}
                            className={`w-full py-2.5 px-4 font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px] ${
                              post.isVideo || currentMedia.type === 'video'
                                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-sky-950/40'
                                : 'bg-rose-600 hover:bg-rose-500 text-white'
                            }`}
                          >
                            {post.isVideo || currentMedia.type === 'video' ? (
                              <>
                                <Film className="w-4 h-4" />
                                <span>🎬 Videoyu Galeriye / Cihaza İndir (MP4)</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" />
                                <span>
                                  {isPostEmbedCaption(post.id)
                                    ? 'Fotoğrafı Açıklamalı İndir (Beyaz Bar İçinde)'
                                    : 'Fotoğrafı Galeriye İndir (1080p HD JPEG)'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

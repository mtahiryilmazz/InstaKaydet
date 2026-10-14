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
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

interface DateGroupCardProps {
  group: DateGroup;
  username: string;
  onDownloadCarouselFolder: (
    post: InstagramPost,
    options?: { embedCaption?: boolean; isDataSaver?: boolean; enhanceResolution?: boolean }
  ) => void;
  onDownloadSingleMedia: (
    post: InstagramPost,
    mediaItem: MediaItem,
    index: number,
    options?: { embedCaption?: boolean; isDataSaver?: boolean; enhanceResolution?: boolean }
  ) => void;
  onDownloadDayArchive: (
    group: DateGroup,
    options?: { embedCaption?: boolean; isDataSaver?: boolean; enhanceResolution?: boolean }
  ) => void;
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
  const [failedMediaIds, setFailedMediaIds] = useState<Record<string, boolean>>({});

  const isPostEmbedCaption = (postId: string) => {
    if (postEmbedCaptions[postId] !== undefined) return postEmbedCaptions[postId];
    return globalEmbedCaption;
  };

  const togglePostEmbedCaption = (postId: string) => {
    setPostEmbedCaptions((prev) => ({
      ...prev,
      [postId]: !isPostEmbedCaption(postId),
    }));
  };

  const getActiveIndex = (postId: string) => activeMediaIndices[postId] || 0;
  const setActiveIndex = (postId: string, index: number) => {
    setActiveMediaIndices((prev) => ({ ...prev, [postId]: index }));
  };

  const handleCopyCaption = (postId: string, caption: string) => {
    navigator.clipboard.writeText(caption);
    setCopiedPostId(postId);
    setTimeout(() => setCopiedPostId(null), 2000);
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl overflow-hidden mb-5 shadow-sm transition-all">
      {/* Date Group Header */}
      <div className="bg-slate-950/60 px-4 py-3.5 border-b border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 cursor-pointer select-none min-w-0 flex-1"
        >
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-rose-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
              {group.displayDate}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>{group.posts.length} gönderi</span>
              <span aria-hidden="true">·</span>
              <span>{group.totalMediaCount} medya</span>
            </div>
          </div>
        </div>

        {/* Compact Date Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onDownloadDayArchive(group)}
            disabled={isProcessing}
            className="px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 min-h-[38px]"
            title="Bu tarihteki tüm gönderileri ZIP olarak indir"
          >
            <FolderArchive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Günü ZIP İndir</span>
          </button>

          <button
            onClick={() => onExportDayPdf(group.posts, `${group.displayDate} Gönderileri`)}
            disabled={isProcessing}
            className="px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 min-h-[38px]"
            title="Bu günün gönderilerini tek PDF dosyası yap"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="hidden sm:inline">PDF Yap</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
            aria-label={isExpanded ? 'Gizle' : 'Genişlet'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Posts List */}
      {isExpanded && (
        <div className="p-3 sm:p-5 space-y-4">
          {group.posts.map((post) => {
            const activeIndex = getActiveIndex(post.id);
            const currentMedia = post.media[activeIndex] || post.media[0];
            const isSelected = selectedPostIds?.has(post.id) || false;

            return (
              <div
                key={post.id}
                className={`bg-slate-950/70 border rounded-2xl p-3.5 sm:p-5 transition-all ${
                  isSelected
                    ? 'border-rose-500/60 ring-1 ring-rose-500/20'
                    : 'border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* Top Meta Row */}
                <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-800/70 gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="text-slate-200 font-semibold">{post.timeFormatted}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {post.isCarousel
                        ? `${post.mediaCount} Fotoğraf`
                        : post.isVideo
                        ? 'Video'
                        : 'Fotoğraf'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300 hover:text-white select-none px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectPost?.(post.id)}
                        className="accent-rose-500 w-3.5 h-3.5 cursor-pointer rounded"
                      />
                      <span className="text-[11px] font-medium">Seç</span>
                    </label>

                    <a
                      href={post.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors p-1"
                      title="Instagram'da Aç"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Responsive Two-Column Post Content */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-start">
                  {/* Left: Media Preview & Carousel Thumbnails */}
                  <div className="md:col-span-5">
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                      {currentMedia?.type === 'video' || post.isVideo ? (
                        <video
                          key={currentMedia?.url}
                          src={currentMedia?.url}
                          poster={currentMedia?.thumbnailUrl}
                          controls
                          playsInline
                          preload={isDataSaver ? 'none' : 'metadata'}
                          className="w-full h-full object-contain bg-black"
                        />
                      ) : currentMedia?.url && !failedMediaIds[currentMedia.id] ? (
                        <img
                          src={currentMedia.url}
                          alt={post.caption?.slice(0, 60) || 'Instagram Gönderisi'}
                          referrerPolicy="no-referrer"
                          onError={() => {
                            setFailedMediaIds((prev) => ({ ...prev, [currentMedia.id]: true }));
                          }}
                          className="w-full h-full object-cover transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-slate-950">
                          <AlertTriangle className="w-7 h-7 text-amber-400 mb-2" />
                          <p className="text-xs font-semibold text-slate-200">
                            Orijinal Medya Oturum Doğrulaması İstiyor
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Gerçek görseli görüntülemek için üst menüden Session ID ekleyin.
                          </p>
                        </div>
                      )}

                      {/* Subtle Slide Counter */}
                      {post.isCarousel && (
                        <div className="absolute top-2.5 right-2.5 bg-slate-950/85 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-700/60 tabular-nums">
                          {activeIndex + 1} / {post.mediaCount}
                        </div>
                      )}
                    </div>

                    {/* Carousel Strip */}
                    {post.isCarousel && post.media.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto pt-2.5 pb-1">
                        {post.media.map((item, idx) => (
                          <button
                            key={item.id}
                            onClick={() => setActiveIndex(post.id, idx)}
                            className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                              activeIndex === idx
                                ? 'border-rose-500 scale-105'
                                : 'border-slate-800 opacity-60 hover:opacity-100'
                            }`}
                          >
                            {(item.thumbnailUrl || item.url) && !failedMediaIds[item.id] ? (
                              <img
                                src={item.thumbnailUrl || item.url}
                                alt={`Kare ${idx + 1}`}
                                referrerPolicy="no-referrer"
                                onError={() => {
                                  setFailedMediaIds((prev) => ({ ...prev, [item.id]: true }));
                                }}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-900 flex items-center justify-center text-[10px] text-slate-400">
                                {idx + 1}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Caption, Metrics & Clean Download Actions */}
                  <div className="md:col-span-7 flex flex-col justify-between h-full space-y-4">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line line-clamp-4">
                        {post.caption || 'Açıklama metni bulunmuyor.'}
                      </p>

                      {/* Clean Unboxed Metrics & Copy Action */}
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Heart className="w-3.5 h-3.5 text-rose-500" />
                          <span className="tabular-nums font-medium text-slate-300">
                            {post.likesCount.toLocaleString('tr-TR')}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5 text-sky-400" />
                          <span className="tabular-nums font-medium text-slate-300">
                            {post.commentsCount.toLocaleString('tr-TR')}
                          </span>
                        </span>
                        {post.caption && (
                          <button
                            onClick={() => handleCopyCaption(post.id, post.caption)}
                            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors ml-auto cursor-pointer"
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
                        )}
                      </div>
                    </div>

                    {/* Streamlined Download Footer */}
                    <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                      {!post.isVideo && (
                        <label className="flex items-center justify-between px-3 py-2 bg-slate-900/70 hover:bg-slate-900 border border-slate-800/80 rounded-xl cursor-pointer text-xs select-none transition-colors">
                          <span className="text-slate-300 font-medium text-[11px] sm:text-xs">
                            Açıklama metnini görsel altına ekle
                          </span>
                          <input
                            type="checkbox"
                            checked={isPostEmbedCaption(post.id)}
                            onChange={() => togglePostEmbedCaption(post.id)}
                            className="accent-rose-500 w-4 h-4 rounded cursor-pointer"
                          />
                        </label>
                      )}

                      {post.isCarousel ? (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <button
                            onClick={() =>
                              onDownloadCarouselFolder(post, {
                                embedCaption: isPostEmbedCaption(post.id),
                                isDataSaver,
                                enhanceResolution,
                              })
                            }
                            disabled={isProcessing}
                            className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[42px]"
                          >
                            <FolderArchive className="w-4 h-4 shrink-0" />
                            <span>Tüm Albümü İndir ({post.mediaCount} Fotoğraf)</span>
                          </button>

                          <button
                            onClick={() =>
                              onDownloadSingleMedia(post, currentMedia, activeIndex, {
                                embedCaption: isPostEmbedCaption(post.id),
                                isDataSaver,
                                enhanceResolution,
                              })
                            }
                            disabled={isProcessing}
                            className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700/60 min-h-[42px]"
                          >
                            <Download className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>Kare {activeIndex + 1}'i İndir</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            onDownloadSingleMedia(post, currentMedia, 0, {
                              embedCaption: isPostEmbedCaption(post.id),
                              isDataSaver,
                              enhanceResolution,
                            })
                          }
                          disabled={isProcessing}
                          className={`w-full py-2.5 px-4 font-semibold text-xs rounded-xl transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[42px] ${
                            post.isVideo || currentMedia?.type === 'video'
                              ? 'bg-sky-600 hover:bg-sky-500 text-white'
                              : 'bg-rose-600 hover:bg-rose-500 text-white'
                          }`}
                        >
                          {post.isVideo || currentMedia?.type === 'video' ? (
                            <>
                              <Film className="w-4 h-4 shrink-0" />
                              <span>Videoyu İndir (MP4)</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 shrink-0" />
                              <span>
                                {isPostEmbedCaption(post.id)
                                  ? 'Açıklamalı Fotoğraf İndir (HD JPEG)'
                                  : 'Fotoğrafı İndir (HD JPEG)'}
                              </span>
                            </>
                          )}
                        </button>
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

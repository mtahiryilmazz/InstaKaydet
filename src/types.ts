export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl: string;
  originalUrl?: string;
  aspectRatio?: '1:1' | '4:5' | '16:9';
  width?: number;
  height?: number;
}

export interface InstagramPost {
  id: string;
  shortcode: string;
  username: string;
  userFullName: string;
  userAvatar: string;
  caption: string;
  timestamp: string; // ISO string
  dateKey: string;   // YYYY-MM-DD
  dateFormatted: string; // e.g. "12 Ekim 2026, Pazartesi"
  timeFormatted: string; // e.g. "18:45"
  isCarousel: boolean;
  mediaCount: number;
  media: MediaItem[];
  likesCount: number;
  commentsCount: number;
  postUrl: string;
  isVideo: boolean;
  location?: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor?: string | null;
  totalCount?: number;
  userId?: string | null;
}

export interface UserProfile {
  username: string;
  fullName: string;
  avatarUrl: string;
  bio: string;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isVerified: boolean;
  isPrivate: boolean;
  isRealInstagramData?: boolean;
  pageInfo?: PageInfo;
}

export interface DateGroup {
  dateKey: string;
  displayDate: string;
  posts: InstagramPost[];
  totalMediaCount: number;
}

export interface DownloadHistoryItem {
  id: string;
  type: 'single_photo' | 'single_video' | 'carousel_folder' | 'date_archive' | 'pdf_archive';
  title: string;
  username: string;
  thumbnailUrl: string;
  timestamp: string; // when downloaded
  fileCount: number;
  fileSizeEstimate: string;
  status: 'completed' | 'failed';
  downloadUrl?: string;
  postDate?: string;
  postTime?: string;
  note?: string;
}

export interface CloudBackupSnapshot {
  id: string;
  name: string;
  timestamp: string;
  itemCount: number;
  items?: DownloadHistoryItem[];
  settings?: Record<string, any>;
}

export interface PdfExportOptions {
  includeCaptions: boolean;
  includeStats: boolean;
  includeTimestamps: boolean;
  includeUserHeader: boolean;
  theme: 'clean' | 'dark';
  pageSize: 'a4';
  excludeVideos?: boolean;
  pdfMode?: 'per_post' | 'single_master';
}

export interface InstagramLogEntry {
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

export interface DiagnosticsData {
  logs: InstagramLogEntry[];
  stats: {
    totalRequests: number;
    successCount: number;
    rateLimitedCount: number;
    notFoundCount: number;
    activeSessionIdPresent: boolean;
    serverRegion: string;
    gatewayStatus: string;
  };
}

export interface ScheduledDownloadJob {
  id: string;
  createdAt: string;
  scheduledTime: string; // ISO string
  scheduledDisplay: string;
  username: string;
  totalPosts: number;
  postIds: string[];
  status: 'pending' | 'running' | 'completed' | 'paused' | 'failed';
  progress: number; // 0 - 100
  statusMessage?: string;
  downloadUrl?: string;
  options: {
    includeCsv: boolean;
    folderByDate: boolean;
    isDataSaver: boolean;
    enhanceResolution: boolean;
  };
}


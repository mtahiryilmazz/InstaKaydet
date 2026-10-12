export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl: string;
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
}

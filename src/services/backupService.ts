import { DownloadHistoryItem, CloudBackupSnapshot } from '../types';

const LOCAL_STORAGE_HISTORY_KEY = 'instaflow_download_history_v1';
const LOCAL_STORAGE_SETTINGS_KEY = 'instaflow_app_settings_v1';
const LOCAL_STORAGE_OFFLINE_BACKUPS_KEY = 'instaflow_offline_backups_v1';

// Seed sample initial history items so the history & cloud screen looks alive immediately
const SEED_HISTORY: DownloadHistoryItem[] = [
  {
    id: 'seed_dl_1',
    type: 'carousel_folder',
    title: '@natgeo - Kapadokya Balonları Klasörü (4 Fotoğraf)',
    username: 'natgeo',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511765224389-37f0e77cf0eb?w=400&auto=format&fit=crop&q=80',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    fileCount: 4,
    fileSizeEstimate: '~5.8 MB',
    status: 'completed',
    postDate: '12 Ekim 2026',
    postTime: '14:15',
    note: 'Klasör: 2026-10-12_14-15_C_d1a1415/',
  },
  {
    id: 'seed_dl_2',
    type: 'pdf_archive',
    title: '@burakozcivit - 12 Ekim Günlük Arşivi (Tek Dosya PDF)',
    username: 'burakozcivit',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&auto=format&fit=crop&q=80',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    fileCount: 3,
    fileSizeEstimate: '~3.4 MB PDF',
    status: 'completed',
    postDate: '12 Ekim 2026',
    postTime: 'PDF Tek Dosya',
    note: 'PDF: burakozcivit_instagram_arsiv_2026.pdf',
  },
  {
    id: 'seed_dl_3',
    type: 'single_video',
    title: '@apple - Gece Şehir Işıkları (Reels 1080p)',
    username: 'apple',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
    fileCount: 1,
    fileSizeEstimate: '~8.2 MB',
    status: 'completed',
    postDate: '11 Ekim 2026',
    postTime: '20:45',
    note: 'apple_2026-10-11_20-45.mp4',
  }
];

const LOCAL_STORAGE_INIT_KEY = 'instaflow_history_initialized_v2';

export function getLocalHistory(): DownloadHistoryItem[] {
  try {
    const isInit = localStorage.getItem(LOCAL_STORAGE_INIT_KEY);
    const raw = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    if (!isInit && !raw) {
      localStorage.setItem(LOCAL_STORAGE_INIT_KEY, 'true');
      saveLocalHistory(SEED_HISTORY);
      return SEED_HISTORY;
    }
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalHistory(items: DownloadHistoryItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Local history save error:', err);
  }
}

export function addHistoryItem(item: DownloadHistoryItem): DownloadHistoryItem[] {
  const current = getLocalHistory();
  const updated = [item, ...current];
  saveLocalHistory(updated);
  return updated;
}

export function clearLocalHistory(): void {
  saveLocalHistory([]);
}

/**
 * Cloud Backup to Server API with local fallback
 */
export async function createCloudBackup(
  backupName: string,
  items: DownloadHistoryItem[],
  settings: Record<string, any> = {}
): Promise<CloudBackupSnapshot> {
  const payload = {
    backupName: backupName || `Bulut Yedeklemesi ${new Date().toLocaleDateString('tr-TR')}`,
    items,
    settings,
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch('/api/backup/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      return data.backup;
    }
  } catch (err) {
    console.warn('Backend cloud backup unreachable, storing in offline cloud sync cache:', err);
  }

  // Fallback to local storage cloud cache
  const fallbackBackup: CloudBackupSnapshot = {
    id: `local_cloud_${Date.now()}`,
    name: payload.backupName,
    timestamp: payload.timestamp,
    itemCount: items.length,
    items,
    settings,
  };

  try {
    const existingRaw = localStorage.getItem(LOCAL_STORAGE_OFFLINE_BACKUPS_KEY);
    const existing: CloudBackupSnapshot[] = existingRaw ? JSON.parse(existingRaw) : [];
    localStorage.setItem(LOCAL_STORAGE_OFFLINE_BACKUPS_KEY, JSON.stringify([fallbackBackup, ...existing]));
  } catch (err) {
    console.error('Offline cloud cache error:', err);
  }

  return fallbackBackup;
}

const LOCAL_STORAGE_CLOUD_INIT_KEY = 'instaflow_cloud_initialized_v2';

/**
 * List all available cloud backups
 */
export async function listCloudBackups(): Promise<CloudBackupSnapshot[]> {
  try {
    const res = await fetch('/api/backup/list');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.backups)) {
        return data.backups;
      }
    }
  } catch (err) {
    console.warn('Backend list unreachable, using cached backups:', err);
  }

  try {
    const existingRaw = localStorage.getItem(LOCAL_STORAGE_OFFLINE_BACKUPS_KEY);
    if (existingRaw) {
      return JSON.parse(existingRaw);
    }
  } catch {}

  const isCloudInit = localStorage.getItem(LOCAL_STORAGE_CLOUD_INIT_KEY);
  if (isCloudInit) {
    return [];
  }

  localStorage.setItem(LOCAL_STORAGE_CLOUD_INIT_KEY, 'true');
  return [];
}

/**
 * Restore history from a selected cloud backup
 */
export async function restoreCloudBackup(backupId: string): Promise<DownloadHistoryItem[]> {
  try {
    const res = await fetch(`/api/backup/${backupId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        saveLocalHistory(data.items);
        return data.items;
      }
    }
  } catch (err) {
    console.warn('Backend restore failed, checking local cloud snapshots:', err);
  }

  try {
    const existingRaw = localStorage.getItem(LOCAL_STORAGE_OFFLINE_BACKUPS_KEY);
    if (existingRaw) {
      const existing: CloudBackupSnapshot[] = JSON.parse(existingRaw);
      const target = existing.find(b => b.id === backupId);
      if (target && target.items) {
        saveLocalHistory(target.items);
        return target.items;
      }
    }
  } catch {}

  return getLocalHistory();
}

/**
 * Export backup as portable JSON file
 */
export function exportBackupAsJsonFile(items: DownloadHistoryItem[]): void {
  const data = {
    app: 'InstaFlow Media Archiver',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    itemCount: items.length,
    history: items,
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `instaflow_bulut_yedek_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Delete a specific cloud backup snapshot
 */
export async function deleteCloudBackup(backupId: string): Promise<boolean> {
  try {
    await fetch(`/api/backup/${encodeURIComponent(backupId)}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Backend delete backup error:', err);
  }

  try {
    const existingRaw = localStorage.getItem(LOCAL_STORAGE_OFFLINE_BACKUPS_KEY);
    if (existingRaw) {
      const existing: CloudBackupSnapshot[] = JSON.parse(existingRaw);
      const filtered = existing.filter(b => b.id !== backupId);
      localStorage.setItem(LOCAL_STORAGE_OFFLINE_BACKUPS_KEY, JSON.stringify(filtered));
    }
  } catch (err) {
    console.error('Offline backup deletion error:', err);
  }

  return true;
}

/**
 * Clear all cloud backup snapshots
 */
export async function clearAllCloudBackups(): Promise<boolean> {
  try {
    await fetch('/api/backup/clear', { method: 'POST' });
  } catch (err) {
    console.warn('Backend clear all backups error:', err);
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_OFFLINE_BACKUPS_KEY, JSON.stringify([]));
    localStorage.setItem(LOCAL_STORAGE_CLOUD_INIT_KEY, 'true');
  } catch (err) {
    console.error('Offline backup clear error:', err);
  }

  return true;
}

/**
 * Clear server-side profile & media cache
 */
export async function clearServerCache(): Promise<number> {
  try {
    const res = await fetch('/api/instagram/cache/clear', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      return data.count || 0;
    }
  } catch (err) {
    console.warn('Backend cache clear error:', err);
  }
  return 0;
}


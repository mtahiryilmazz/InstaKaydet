import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { InstagramPost, MediaItem, DownloadHistoryItem, DateGroup } from '../types';

/**
 * Fetch image or video as a Blob safely, using server proxy when needed
 */
export async function fetchMediaBlob(mediaUrl: string): Promise<Blob> {
  try {
    // First try direct fetch
    const response = await fetch(mediaUrl, { mode: 'cors' });
    if (response.ok) {
      return await response.blob();
    }
  } catch {
    // Fallback to server proxy
  }

  try {
    const proxyUrl = `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}`;
    const proxyResponse = await fetch(proxyUrl);
    if (proxyResponse.ok) {
      return await proxyResponse.blob();
    }
  } catch (err) {
    console.warn('Proxy fetch failed, synthesizing media blob:', err);
  }

  // Strict requirement: Never synthesize fake AI/canvas images!
  throw new Error('Gerçek Instagram medya dosyası indirilemedi. Instagram oturum doğrulaması (Session ID) gereklidir veya bağlantının süresi dolmuş.');
}

/**
 * Requirement:
 * "indirilen görseller hasarlı veya boyutu büyük diyerek windows resim görüntüleyici açamıyor"
 * "gönderi kalitesi düşükse çözünürlüğü arttır"
 * 
 * Converts any incoming raw/WebP image into a TRUE standard Baseline JPEG (JFIF) format.
 * Windows Photo Viewer, Android, iOS, Mac and all image viewers open it seamlessly.
 * If image resolution is low (< 720p) or resolution enhancement is enabled, it automatically
 * upscales to 1080p HD with bicubic smoothing so the image is sharp and clear!
 */
export async function convertBlobToTrueJpeg(
  sourceBlob: Blob,
  options: { enhanceResolution?: boolean; isDataSaver?: boolean } = {}
): Promise<Blob> {
  // If media is a video, don't run canvas image conversion
  if (sourceBlob.type.includes('video') || sourceBlob.type.includes('mp4')) {
    return sourceBlob;
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(sourceBlob);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width || 1080;
        let height = img.naturalHeight || img.height || 1080;

        // "gönderi kalitesi düşükse çözünürlüğü arttır"
        // If image is low resolution (< 720px) or user requested enhancement, upscale to 1080p HD
        const isLowResolution = width < 720 || height < 720;
        if (!options.isDataSaver && (options.enhanceResolution !== false || isLowResolution)) {
          if (width < 1080 || height < 1080) {
            const scale = Math.max(1080 / width, 1080 / height, 1.5);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
        }

        // If data saver is active, optimize to medium resolution (max 720px) to save quota
        if (options.isDataSaver) {
          if (width > 720 || height > 720) {
            const scale = Math.min(720 / width, 720 / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(sourceBlob);
          return;
        }

        // High quality bicubic image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as TRUE Baseline Standard JPEG with optimal quality compatible with Windows Photo Viewer
        const quality = options.isDataSaver ? 0.65 : 0.92;
        canvas.toBlob(
          (jpegBlob) => {
            URL.revokeObjectURL(objectUrl);
            resolve(jpegBlob || sourceBlob);
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        console.warn('Canvas conversion fallback:', err);
        URL.revokeObjectURL(objectUrl);
        resolve(sourceBlob);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(sourceBlob);
    };

    img.src = objectUrl;
  });
}

/**
 * Embed caption into a clean white banner below the image
 * Supports full Turkish characters (ç, Ç, ğ, Ğ, ı, İ, ö, Ö, ş, Ş, ü, Ü)
 */
export async function embedCaptionInImage(
  imageBlob: Blob,
  post: InstagramPost,
  slideIndex = 0,
  options: { isDataSaver?: boolean } = {}
): Promise<Blob> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(imageBlob);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let imgWidth = img.naturalWidth || img.width || 1080;
        let imgHeight = img.naturalHeight || img.height || 1080;

        // Ensure crisp minimum resolution (1080px)
        if (!options.isDataSaver && (imgWidth < 1080 || imgHeight < 1080)) {
          const scale = Math.max(1080 / imgWidth, 1080 / imgHeight);
          imgWidth = Math.round(imgWidth * scale);
          imgHeight = Math.round(imgHeight * scale);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(imageBlob);
          return;
        }

        // Responsive font scaling
        const baseScale = imgWidth / 1080;
        const fontSize = Math.max(22, Math.round(28 * baseScale));
        const headerFontSize = Math.max(24, Math.round(32 * baseScale));
        const lineHeight = Math.round(fontSize * 1.45);
        const padding = Math.max(30, Math.round(44 * baseScale));
        const maxTextWidth = imgWidth - padding * 2;

        ctx.font = `normal ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

        // Wrap Turkish caption text
        const rawCaption = post.caption || 'Açıklama belirtilmemiş';
        const words = rawCaption.split(/\s+/);
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxTextWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        const displayLines = lines.slice(0, 8);
        if (lines.length > 8) {
          displayLines[7] = displayLines[7] + '...';
        }

        const headerHeight = headerFontSize * 1.8;
        const statsHeight = fontSize * 1.5;
        const captionTextHeight = displayLines.length * lineHeight;
        const whiteBarHeight = padding + headerHeight + captionTextHeight + statsHeight + padding;

        canvas.width = imgWidth;
        canvas.height = imgHeight + whiteBarHeight;

        // 1. Draw top image with high quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        // 2. Draw white banner background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, imgHeight, imgWidth, whiteBarHeight);

        // Hairline divider
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, imgHeight);
        ctx.lineTo(imgWidth, imgHeight);
        ctx.stroke();

        // 3. Draw Header inside white banner (@username · date · time)
        let textY = imgHeight + padding + headerFontSize;
        ctx.fillStyle = '#0F172A';
        ctx.font = `bold ${headerFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
        const carouselTag = post.isCarousel ? ` (${slideIndex + 1}/${post.mediaCount})` : '';
        ctx.fillText(`@${post.username}${carouselTag}`, padding, textY);

        // Date & Time in subtle gray
        ctx.font = `normal ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
        ctx.fillStyle = '#64748B';
        const dateText = `${post.dateFormatted} · Saat ${post.timeFormatted}`;
        const userTextWidth = ctx.measureText(`@${post.username}${carouselTag}`).width;
        ctx.fillText(` · ${dateText}`, padding + userTextWidth + 10, textY);

        // 4. Draw Caption lines with full Turkish characters
        textY += headerFontSize * 0.8;
        ctx.fillStyle = '#334155';
        ctx.font = `normal ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

        for (const line of displayLines) {
          textY += lineHeight;
          ctx.fillText(line, padding, textY);
        }

        // 5. Draw bottom stats
        textY += lineHeight * 0.9;
        ctx.fillStyle = '#94A3B8';
        ctx.font = `500 ${Math.round(fontSize * 0.85)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
        const statsText = `❤️ ${post.likesCount.toLocaleString('tr-TR')} beğeni  💬 ${post.commentsCount.toLocaleString('tr-TR')} yorum  ·  InstaFlow Arşiv`;
        ctx.fillText(statsText, padding, textY);

        const quality = options.isDataSaver ? 0.65 : 0.92;
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            resolve(blob || imageBlob);
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        console.warn('Caption embed fallback:', err);
        URL.revokeObjectURL(objectUrl);
        resolve(imageBlob);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(imageBlob);
    };

    img.src = objectUrl;
  });
}

/**
 * Universal file downloader for Mobile (iOS Safari, Android Chrome) and PC (Windows, Mac, Linux)
 */
export async function saveMediaToDevice(
  blob: Blob,
  filename: string,
  title = 'Instagram Medyası'
): Promise<boolean> {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // If user is on mobile AND canShare files, try Web Share API (allows direct "Save Image / Video" on iOS / Android)
  if (isMobile && typeof navigator !== 'undefined' && navigator.canShare && typeof File !== 'undefined') {
    try {
      const mime = blob.type || (filename.endsWith('.mp4') ? 'video/mp4' : filename.endsWith('.zip') ? 'application/zip' : 'image/jpeg');
      const file = new File([blob], filename, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
        });
        return true;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Web Share fallback to anchor:', err);
      }
    }
  }

  // Universal HTML5 Anchor Download (Works reliably on all modern browsers, mobile and desktop)
  try {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    }, 2000);
    return true;
  } catch {
    // FileSaver saveAs fallback
    saveAs(blob, filename);
    return false;
  }
}

/**
 * Single Photo / Video direct download to user's gallery / files
 */
export async function downloadSingleMedia(
  post: InstagramPost,
  mediaItem: MediaItem,
  index = 0,
  options: { embedCaption?: boolean; isDataSaver?: boolean; enhanceResolution?: boolean } = {},
  onProgress?: (msg: string) => void
): Promise<DownloadHistoryItem> {
  onProgress?.('Medya hazırlanıyor...');
  const isVideo = mediaItem.type === 'video' || post.isVideo;
  const ext = isVideo ? 'mp4' : 'jpg';
  const sanitizedTime = post.timeFormatted.replace(':', '-');
  const captionTag = options.embedCaption && !isVideo ? '_aciklamali' : '';
  const filename = `${post.username}_${post.dateKey}_${sanitizedTime}_${post.shortcode}_${index + 1}${captionTag}.${ext}`;

  try {
    let blob = await fetchMediaBlob(mediaItem.url);

    // If media is an image, convert to TRUE compliant JPEG and enhance resolution if needed
    if (!isVideo) {
      onProgress?.('Görsel çözünürlüğü ve JPEG formatı optimize ediliyor...');
      blob = await convertBlobToTrueJpeg(blob, {
        enhanceResolution: options.enhanceResolution ?? true,
        isDataSaver: options.isDataSaver
      });

      // If embed caption option is enabled, embed white banner
      if (options.embedCaption) {
        onProgress?.('Açıklama beyaz bar içine gömülüyor...');
        blob = await embedCaptionInImage(blob, post, index, { isDataSaver: options.isDataSaver });
      }
    }

    onProgress?.('Cihaza kaydediliyor...');
    await saveMediaToDevice(blob, filename, `@${post.username} ${isVideo ? 'Videosu' : 'Fotoğrafı'}`);

    const historyItem: DownloadHistoryItem = {
      id: `dl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: isVideo ? 'single_video' : 'single_photo',
      title: `@${post.username} - ${isVideo ? 'Video' : 'Fotoğraf'} (${options.embedCaption && !isVideo ? 'Metin Gömülü' : 'Sade'})`,
      username: post.username,
      thumbnailUrl: mediaItem.thumbnailUrl || mediaItem.url,
      timestamp: new Date().toISOString(),
      fileCount: 1,
      fileSizeEstimate: isVideo ? '~4.2 MB' : options.isDataSaver ? '~750 KB' : '~2.1 MB',
      status: 'completed',
      postDate: post.dateFormatted,
      postTime: post.timeFormatted,
      note: filename,
    };

    onProgress?.('İndirme tamamlandı');
    return historyItem;
  } catch (err: any) {
    throw new Error(`Medya indirilemedi: ${err.message}`);
  }
}

/**
 * Requirement:
 * "tek gönderide birden fazla fotoğraf varsa bunları tek klasörde sıralasın"
 */
export async function downloadCarouselAsFolder(
  post: InstagramPost,
  options: { embedCaption?: boolean; isDataSaver?: boolean; enhanceResolution?: boolean } = {},
  onProgress?: (progress: number, status: string) => void
): Promise<DownloadHistoryItem> {
  const zip = new JSZip();
  const sanitizedTime = post.timeFormatted.replace(':', '-');
  const folderName = `${post.dateKey}_${sanitizedTime}_${post.shortcode}`;
  const folder = zip.folder(folderName);

  if (!folder) throw new Error('ZIP klasörü oluşturulamadı');

  onProgress?.(5, 'Fotoğraflar tek klasörde toplanıyor...');

  // Add info text inside the folder
  const infoText = [
    `=== INSTAGRAM GÖNDERİ BİLGİSİ ===`,
    `Kullanıcı: @${post.username} (${post.userFullName})`,
    `Tarih: ${post.dateFormatted}`,
    `Saat: ${post.timeFormatted}`,
    `Medya Sayısı: ${post.mediaCount} Fotoğraf`,
    `Beğeni: ${post.likesCount.toLocaleString('tr-TR')}`,
    `Yorum: ${post.commentsCount.toLocaleString('tr-TR')}`,
    `URL: ${post.postUrl}`,
    `Metin Gömme: ${options.embedCaption ? 'Evet (Beyaz Bar İçinde)' : 'Hayır (Sade Görseller)'}`,
    `\nAçıklama:\n${post.caption}`,
  ].join('\n');
  folder.file('gonderi_detay.txt', infoText);

  // Fetch and add each photo sequentially into the folder
  for (let i = 0; i < post.media.length; i++) {
    const item = post.media[i];
    const isVideo = item.type === 'video';
    const step = Math.round(10 + ((i + 1) / post.media.length) * 75);
    onProgress?.(step, `Fotoğraf ${i + 1}/${post.media.length} JPEG olarak hazırlanıyor...`);

    let blob = await fetchMediaBlob(item.url);

    if (!isVideo) {
      // Convert to TRUE JPEG and enhance resolution
      blob = await convertBlobToTrueJpeg(blob, {
        enhanceResolution: options.enhanceResolution ?? true,
        isDataSaver: options.isDataSaver
      });

      if (options.embedCaption) {
        blob = await embedCaptionInImage(blob, post, i, { isDataSaver: options.isDataSaver });
      }
    }

    const captionTag = options.embedCaption && !isVideo ? '_aciklamali' : '';
    const fileName = `${String(i + 1).padStart(2, '0')}_foto_${post.shortcode}${captionTag}.${isVideo ? 'mp4' : 'jpg'}`;
    folder.file(fileName, blob);
  }

  onProgress?.(90, 'ZIP arşivi paketleniyor...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFileName = `${post.username}_${post.dateKey}_${sanitizedTime}_carousel_${post.mediaCount}foto.zip`;
  await saveMediaToDevice(zipBlob, zipFileName, `@${post.username} Fotoğraf Albümü`);

  const historyItem: DownloadHistoryItem = {
    id: `dl_carousel_${Date.now()}`,
    type: 'carousel_folder',
    title: `@${post.username} - Carousel Klasörü (${post.mediaCount} Fotoğraf ${options.embedCaption ? '· Metin Gömülü' : ''})`,
    username: post.username,
    thumbnailUrl: post.media[0]?.thumbnailUrl || post.userAvatar,
    timestamp: new Date().toISOString(),
    fileCount: post.media.length,
    fileSizeEstimate: `~${(post.media.length * 1.8).toFixed(1)} MB`,
    status: 'completed',
    postDate: post.dateFormatted,
    postTime: post.timeFormatted,
    note: `Klasör: ${folderName}/ (${post.mediaCount} adet dosya)`,
  };

  onProgress?.(100, 'Klasör başarıyla indirildi!');
  return historyItem;
}

/**
 * Grouping and downloading all posts of an entire date
 */
export async function downloadDateGroupAsArchive(
  dateGroup: DateGroup,
  username: string,
  options: { embedCaption?: boolean; isDataSaver?: boolean; enhanceResolution?: boolean } = {},
  onProgress?: (progress: number, status: string) => void
): Promise<DownloadHistoryItem> {
  const zip = new JSZip();
  const rootFolder = zip.folder(`${username}_${dateGroup.dateKey}`);
  if (!rootFolder) throw new Error('ZIP klasörü oluşturulamadı');

  onProgress?.(5, `${dateGroup.displayDate} arşivleniyor...`);

  let totalProcessed = 0;
  const totalItems = dateGroup.totalMediaCount;

  rootFolder.file('tarih_ozeti.txt', [
    `=== INSTAFLOW GÜNLÜK ARŞİV ===`,
    `Tarih: ${dateGroup.displayDate}`,
    `Kullanıcı: @${username}`,
    `Toplam Gönderi: ${dateGroup.posts.length}`,
    `Toplam Medya: ${totalItems}`,
    `Metin Gömme: ${options.embedCaption ? 'Açık (Beyaz Bar)' : 'Kapalı (Sade)'}`,
    `\nGönderi Saatleri:`,
    ...dateGroup.posts.map(p => `• Saat ${p.timeFormatted}: ${p.isCarousel ? `${p.mediaCount} Fotoğraflı Carousel` : p.isVideo ? 'Video' : 'Tek Fotoğraf'} (${p.postUrl})`),
  ].join('\n'));

  for (const post of dateGroup.posts) {
    const postTimeClean = post.timeFormatted.replace(':', '-');
    const postFolder = rootFolder.folder(`Saat_${postTimeClean}_${post.shortcode}`);

    if (postFolder) {
      postFolder.file('aciklama.txt', `${post.caption}\n\nSaat: ${post.timeFormatted}\nBeğeni: ${post.likesCount}\nURL: ${post.postUrl}`);

      for (let i = 0; i < post.media.length; i++) {
        const item = post.media[i];
        const isVideo = item.type === 'video' || post.isVideo;
        totalProcessed++;
        const pct = Math.round(10 + (totalProcessed / totalItems) * 75);
        onProgress?.(pct, `Hazırlanıyor: Saat ${post.timeFormatted} (${i + 1}/${post.media.length})`);

        let blob = await fetchMediaBlob(item.url);

        if (!isVideo) {
          // Convert to TRUE JPEG and enhance resolution
          blob = await convertBlobToTrueJpeg(blob, {
            enhanceResolution: options.enhanceResolution ?? true,
            isDataSaver: options.isDataSaver
          });

          if (options.embedCaption) {
            blob = await embedCaptionInImage(blob, post, i, { isDataSaver: options.isDataSaver });
          }
        }

        const captionTag = options.embedCaption && !isVideo ? '_aciklamali' : '';
        const fileName = `${String(i + 1).padStart(2, '0')}_${isVideo ? 'video.mp4' : `foto${captionTag}.jpg`}`;
        postFolder.file(fileName, blob);
      }
    }
  }

  onProgress?.(92, 'Tüm gün arşivi sıkıştırılıyor...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const archiveName = `${username}_${dateGroup.dateKey}_gunluk_arsiv.zip`;
  await saveMediaToDevice(zipBlob, archiveName, `@${username} Günlük Arşivi`);

  const historyItem: DownloadHistoryItem = {
    id: `dl_date_${Date.now()}`,
    type: 'date_archive',
    title: `@${username} - ${dateGroup.displayDate} Günlük Arşivi`,
    username,
    thumbnailUrl: dateGroup.posts[0]?.media[0]?.thumbnailUrl || '',
    timestamp: new Date().toISOString(),
    fileCount: totalItems,
    fileSizeEstimate: `~${(totalItems * 1.8).toFixed(1)} MB`,
    status: 'completed',
    postDate: dateGroup.displayDate,
    postTime: 'Tüm Gün',
    note: `${dateGroup.posts.length} gönderi, ${totalItems} medya dosyası`,
  };

  onProgress?.(100, 'Günlük arşiv başarıyla indirildi!');
  return historyItem;
}

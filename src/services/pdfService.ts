import { jsPDF } from 'jspdf';
import { InstagramPost, PdfExportOptions, DownloadHistoryItem, UserProfile } from '../types';
import { fetchMediaBlob, saveMediaToDevice } from './downloadService';
import JSZip from 'jszip';

/**
 * Convert a blob into a base64 data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get image natural dimensions to calculate proportional fit
 */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width || 1080,
        height: img.naturalHeight || img.height || 1080
      });
    };
    img.onerror = () => {
      resolve({ width: 1080, height: 1080 });
    };
    img.src = dataUrl;
  });
}

/**
 * Load UTF-8 LiberationSans font into jsPDF for 100% full Turkish character support
 * Supports: ç, Ç, ğ, Ğ, ı, İ, ö, Ö, ş, Ş, ü, Ü
 */
async function loadTurkishFont(doc: jsPDF): Promise<boolean> {
  try {
    const res = await fetch('/fonts/LiberationSans-Regular.ttf');
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fontBase64 = btoa(binary);
      doc.addFileToVFS('LiberationSans.ttf', fontBase64);
      doc.addFont('LiberationSans.ttf', 'LiberationSans', 'normal');

      // Also try to load bold if available
      try {
        const resBold = await fetch('/fonts/LiberationSans-Bold.ttf');
        if (resBold.ok) {
          const bufferBold = await resBold.arrayBuffer();
          let binaryBold = '';
          const bytesBold = new Uint8Array(bufferBold);
          for (let i = 0; i < bytesBold.byteLength; i++) {
            binaryBold += String.fromCharCode(bytesBold[i]);
          }
          doc.addFileToVFS('LiberationSans-Bold.ttf', btoa(binaryBold));
          doc.addFont('LiberationSans-Bold.ttf', 'LiberationSans', 'bold');
        }
      } catch {}

      doc.setFont('LiberationSans', 'normal');
      return true;
    }
  } catch (err) {
    console.warn('LiberationSans font loading notice:', err);
  }
  return false;
}

/**
 * Requirements fulfilled:
 * 1. "toplu indirmede her sayfaya bir görsel olacak şekilde sığdır" (Her sayfaya 1 görsel tam sığdırma)
 * 2. "toplu olarak pdf yaptığında alta metinler ekleme onu da seçime bağlı bırak" (Metinler seçime bağlı, varsayılan kapalı)
 * 3. "türkçe karakter desteği" (ç, Ç, ğ, Ğ, ı, İ, ö, Ö, ş, Ş, ü, Ü tam destek)
 */
export async function generateSinglePdfArchive(
  posts: InstagramPost[],
  userProfile: UserProfile,
  options: PdfExportOptions = {
    includeCaptions: false,
    includeStats: false,
    includeTimestamps: true,
    includeUserHeader: true,
    theme: 'clean',
    pageSize: 'a4',
    excludeVideos: false,
  },
  onProgress?: (progress: number, status: string) => void,
  saveToDevice = true
): Promise<{ pdfDoc: jsPDF; pdfBlob: Blob; filename: string; historyItem: DownloadHistoryItem }> {
  // A4 dimensions in mm: 210 x 297
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180mm

  onProgress?.(5, 'Yazı tipleri ve Türkçe karakter desteği yükleniyor...');
  const hasTurkishFont = await loadTurkishFont(doc);
  const fontName = hasTurkishFont ? 'LiberationSans' : 'helvetica';

  // Count total media items across all posts (applying excludeVideos if requested)
  const allMediaItems: { post: InstagramPost; mediaIndex: number; totalInPost: number }[] = [];
  for (const post of posts) {
    if (options.excludeVideos && post.isVideo) {
      continue;
    }
    for (let m = 0; m < post.media.length; m++) {
      const media = post.media[m];
      if (options.excludeVideos && media.type === 'video') {
        continue;
      }
      allMediaItems.push({
        post,
        mediaIndex: m,
        totalInPost: post.media.length,
      });
    }
  }

  const totalPages = allMediaItems.length;
  onProgress?.(10, `Toplam ${totalPages} görsel her sayfaya bir adet olacak şekilde hazırlanıyor...`);

  // Render each media item on its own dedicated page
  for (let idx = 0; idx < totalPages; idx++) {
    const { post, mediaIndex, totalInPost } = allMediaItems[idx];
    const media = post.media[mediaIndex];
    const pageNum = idx + 1;

    const progressPct = Math.round(10 + ((idx + 1) / totalPages) * 85);
    onProgress?.(
      progressPct,
      `Sayfa ${pageNum}/${totalPages} işleniyor: @${post.username} (${post.dateFormatted})`
    );

    // If not the very first page, add a new page
    if (idx > 0) {
      doc.addPage();
    }

    // --- 1. Top Header Bar (Metadata & Timestamp) ---
    let topBarHeight = 0;
    if (options.includeTimestamps || options.includeUserHeader) {
      topBarHeight = 16;
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(margin, 10, contentWidth, 10, 'F');

      // Thin accent bar
      doc.setFillColor(225, 29, 72); // rose-600
      doc.rect(margin, 20, contentWidth, 1, 'F');

      doc.setFont(fontName, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);

      const slideTag = totalInPost > 1 ? ` · Karusel (${mediaIndex + 1}/${totalInPost})` : post.isVideo ? ' · [Video / Reels]' : '';
      const headerTitle = `@${post.username}${slideTag} · ${post.dateFormatted} · Saat ${post.timeFormatted}`;
      doc.text(headerTitle, margin + 4, 16.5);
    }

    // --- 2. Calculate Available Area for Image ---
    const topOffset = topBarHeight > 0 ? 25 : margin;
    let bottomReserved = 15; // bottom margin + page number

    // User choice: If includeCaptions is enabled, reserve bottom space for captions
    const showCaption = options.includeCaptions && post.caption && mediaIndex === 0;
    const captionHeight = showCaption ? 36 : 0;
    if (showCaption) {
      bottomReserved += captionHeight;
    }

    const availableImgWidth = contentWidth;
    const availableImgHeight = pageHeight - topOffset - bottomReserved;

    // --- 3. Fetch Media & Calculate Proportional Fit ---
    try {
      const blob = await fetchMediaBlob(media.url);
      const dataUrl = await blobToDataUrl(blob);
      const imgDim = await getImageDimensions(dataUrl);

      // Maintain aspect ratio
      const aspect = imgDim.width / imgDim.height;
      let targetW = availableImgWidth;
      let targetH = targetW / aspect;

      if (targetH > availableImgHeight) {
        targetH = availableImgHeight;
        targetW = targetH * aspect;
      }

      // Center horizontally on page
      const posX = (pageWidth - targetW) / 2;
      // Center vertically within available space
      const posY = topOffset + (availableImgHeight - targetH) / 2;

      // Draw image
      doc.addImage(dataUrl, 'JPEG', posX, posY, targetW, targetH, undefined, 'FAST');

      // Video watermark indicator if media is a video
      if (post.isVideo || media.type === 'video') {
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(posX + 4, posY + 4, 34, 7, 1.5, 1.5, 'F');
        doc.setFont(fontName, 'bold');
        doc.setFontSize(7);
        doc.setTextColor(244, 63, 94);
        doc.text('🎬 Video Önizleme', posX + 6, posY + 8.5);
      }
    } catch (err) {
      console.warn('Image fetch failed for page:', err);
      // Fallback placeholder box
      const fallbackH = Math.min(availableImgHeight, 120);
      const posX = margin;
      const posY = topOffset + (availableImgHeight - fallbackH) / 2;
      doc.setFillColor(241, 245, 249);
      doc.rect(posX, posY, contentWidth, fallbackH, 'F');
      doc.setFont(fontName, 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Medya Yüklenemedi (@${post.username})`, posX + 40, posY + fallbackH / 2);
    }

    // --- 4. Optional Caption at Bottom (Only when user explicitly selected it!) ---
    if (showCaption) {
      const captionY = pageHeight - bottomReserved + 4;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, captionY, contentWidth, 26, 'FD');

      doc.setFont(fontName, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      const splitText = doc.splitTextToSize(`Açıklama: ${post.caption}`, contentWidth - 8);
      doc.text(splitText.slice(0, 4), margin + 4, captionY + 5.5);

      if (options.includeStats) {
        doc.setFont(fontName, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `❤️ ${post.likesCount.toLocaleString('tr-TR')} beğeni   💬 ${post.commentsCount.toLocaleString('tr-TR')} yorum`,
          margin + 4,
          captionY + 23
        );
      }
    }

    // --- 5. Page Footer (Page Number with Turkish Character Support) ---
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `InstaFlow Arşiv Sistemi  ·  Sayfa ${pageNum} / ${totalPages}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
  }

  onProgress?.(98, 'PDF dosyası kaydediliyor...');

  const cleanUser = userProfile.username.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanUser}_arsiv_${new Date().toISOString().slice(0, 10)}.pdf`;

  // Output PDF Blob
  const pdfBlob = doc.output('blob');

  if (saveToDevice) {
    const downloadUrl = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    }, 2000);
  }

  const historyItem: DownloadHistoryItem = {
    id: `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'pdf_archive',
    title: `@${userProfile.username} - Tek Dosya PDF (${totalPages} Sayfa · Her Sayfada 1 Görsel)`,
    username: userProfile.username,
    thumbnailUrl: posts[0]?.media[0]?.thumbnailUrl || posts[0]?.media[0]?.url || '',
    timestamp: new Date().toISOString(),
    fileCount: totalPages,
    fileSizeEstimate: `~${Math.round((totalPages * 0.8) + 1.2)} MB`,
    status: 'completed',
    note: `${filename} (Türkçe Karakter Destekli, Her Sayfaya 1 Görsel)`,
  };

  return { pdfDoc: doc, pdfBlob, filename, historyItem };
}

/**
 * Generates a dedicated PDF document for a single Instagram post.
 * If the post has multiple images (carousel), all images for THIS POST
 * are merged into this single PDF file (each image on its own page).
 * Fulfills requirement:
 * "400 küsür gönderiyi tek pdf değil her gönderiyi tek pdf yapacak,
 * bir gönderi içinde fazla resim varsa onlarıda tek pdf içinde birleştirecek"
 */
export async function generateSinglePostPdf(
  post: InstagramPost,
  userProfile: UserProfile,
  options: PdfExportOptions = {
    includeCaptions: false,
    includeStats: false,
    includeTimestamps: true,
    includeUserHeader: true,
    theme: 'clean',
    pageSize: 'a4',
    excludeVideos: true,
  },
  postIndex?: number
): Promise<{ pdfDoc: jsPDF; pdfBlob: Blob; filename: string; pageCount: number } | null> {
  // If excluding videos and post is pure video, skip
  if (options.excludeVideos && post.isVideo) {
    return null;
  }

  // Filter media items for images (skip video items if excludeVideos is true)
  const mediaItems = post.media.filter(m => {
    if (options.excludeVideos && m.type === 'video') return false;
    return true;
  });

  if (mediaItems.length === 0) {
    return null;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180mm

  const hasTurkishFont = await loadTurkishFont(doc);
  const fontName = hasTurkishFont ? 'LiberationSans' : 'helvetica';

  const totalPagesInPost = mediaItems.length;

  for (let m = 0; m < totalPagesInPost; m++) {
    const media = mediaItems[m];
    const pageNum = m + 1;

    if (m > 0) {
      doc.addPage();
    }

    // Top Header Bar
    let topBarHeight = 0;
    if (options.includeTimestamps || options.includeUserHeader) {
      topBarHeight = 16;
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(margin, 10, contentWidth, 10, 'F');

      doc.setFillColor(225, 29, 72); // rose-600
      doc.rect(margin, 20, contentWidth, 1, 'F');

      doc.setFont(fontName, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);

      const slideTag = totalPagesInPost > 1 ? ` · Karusel (${pageNum}/${totalPagesInPost})` : '';
      const headerTitle = `@${post.username}${slideTag} · ${post.dateFormatted} · Saat ${post.timeFormatted}`;
      doc.text(headerTitle, margin + 4, 16.5);
    }

    const topOffset = topBarHeight > 0 ? 25 : margin;
    let bottomReserved = 15;

    const showCaption = options.includeCaptions && post.caption && m === 0;
    const captionHeight = showCaption ? 36 : 0;
    if (showCaption) {
      bottomReserved += captionHeight;
    }

    const availableImgWidth = contentWidth;
    const availableImgHeight = pageHeight - topOffset - bottomReserved;

    try {
      const blob = await fetchMediaBlob(media.url);
      const dataUrl = await blobToDataUrl(blob);
      const imgDim = await getImageDimensions(dataUrl);

      const aspect = imgDim.width / imgDim.height;
      let targetW = availableImgWidth;
      let targetH = targetW / aspect;

      if (targetH > availableImgHeight) {
        targetH = availableImgHeight;
        targetW = targetH * aspect;
      }

      const posX = (pageWidth - targetW) / 2;
      const posY = topOffset + (availableImgHeight - targetH) / 2;

      doc.addImage(dataUrl, 'JPEG', posX, posY, targetW, targetH, undefined, 'FAST');
    } catch (err) {
      console.warn('Image fetch failed for single post page:', err);
      const fallbackH = Math.min(availableImgHeight, 100);
      const posX = margin;
      const posY = topOffset + (availableImgHeight - fallbackH) / 2;
      doc.setFillColor(241, 245, 249);
      doc.rect(posX, posY, contentWidth, fallbackH, 'F');
      doc.setFont(fontName, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Medya Yüklenemedi (@${post.username})`, posX + 40, posY + fallbackH / 2);
    }

    // Optional caption at bottom
    if (showCaption) {
      const captionY = pageHeight - bottomReserved + 4;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, captionY, contentWidth, 26, 'FD');

      doc.setFont(fontName, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      const splitText = doc.splitTextToSize(`Açıklama: ${post.caption}`, contentWidth - 8);
      doc.text(splitText.slice(0, 4), margin + 4, captionY + 5.5);

      if (options.includeStats) {
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `❤️ ${post.likesCount.toLocaleString('tr-TR')} beğeni   💬 ${post.commentsCount.toLocaleString('tr-TR')} yorum`,
          margin + 4,
          captionY + 23
        );
      }
    }

    // Page footer
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `InstaFlow Arşiv  ·  Sayfa ${pageNum} / ${totalPagesInPost}  ·  @${post.username}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
  }

  const pdfBlob = doc.output('blob');
  const indexPrefix = postIndex !== undefined ? `${String(postIndex).padStart(3, '0')}_` : '';
  const carTag = totalPagesInPost > 1 ? `_karusel_${totalPagesInPost}_sayfa` : '';
  const cleanCode = (post.shortcode || 'post').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${indexPrefix}${post.dateKey}_${cleanCode}${carTag}.pdf`;

  return { pdfDoc: doc, pdfBlob, filename, pageCount: totalPagesInPost };
}

/**
 * Compiles each post into its OWN separate PDF (merging carousel images of that post into that post's PDF),
 * and bundles all individual PDFs into a single ZIP file for 1-click download!
 * Fulfills requirement:
 * "400 küsür gönderiyi tek pdf değil her gönderiyi tek pdf yapacak,
 * bir gönderi içinde fazla resim varsa onlarıda tek pdf içinde birleştirecek"
 */
export async function generatePerPostPdfZipArchive(
  posts: InstagramPost[],
  userProfile: UserProfile,
  options: PdfExportOptions = {
    includeCaptions: false,
    includeStats: false,
    includeTimestamps: true,
    includeUserHeader: true,
    theme: 'clean',
    pageSize: 'a4',
    excludeVideos: true,
  },
  onProgress?: (progress: number, status: string) => void
): Promise<{ zipBlob: Blob; zipFilename: string; totalPdfCount: number; historyItem: DownloadHistoryItem }> {
  const zip = new JSZip();

  // Filter posts
  const effectivePosts = posts.filter(p => {
    if (options.excludeVideos && p.isVideo) return false;
    return true;
  });

  const total = effectivePosts.length;
  onProgress?.(5, `${total} gönderi için ayrı ayrı PDF dosyaları oluşturuluyor...`);

  let generatedPdfCount = 0;
  let totalPagesRendered = 0;

  for (let i = 0; i < total; i++) {
    const post = effectivePosts[i];
    const progressPct = Math.round(5 + ((i + 1) / total) * 85);
    onProgress?.(
      progressPct,
      `[${i + 1}/${total}] PDF hazırlanıyor: @${post.username} (${post.dateFormatted}) ${post.isCarousel ? `[${post.mediaCount} slayt tek PDF]` : ''}`
    );

    try {
      const res = await generateSinglePostPdf(post, userProfile, options, i + 1);
      if (res) {
        // Place into pdf_gonderiler/ inside ZIP
        zip.file(`pdf_gonderiler/${res.filename}`, res.pdfBlob);
        generatedPdfCount++;
        totalPagesRendered += res.pageCount;
      }
    } catch (err) {
      console.warn(`Post PDF generation failed for post #${i + 1}:`, err);
    }

    // Yield small delay
    await new Promise(r => setTimeout(r, 40));
  }

  // Add CSV metadata summary
  const csvHeader = 'Sıra,Kullanıcı,Tarih,Saat,Kısa Kod,Sayfa Sayısı,Tür,Beğeni,Yorum,Gönderi Linki,PDF Dosyası,Açıklama\n';
  const csvRows = effectivePosts.map((p, idx) => {
    const cleanCap = (p.caption || '').replace(/"/g, '""').replace(/\n/g, ' ');
    const carTag = p.mediaCount > 1 ? `_karusel_${p.mediaCount}_sayfa` : '';
    const pdfName = `${String(idx + 1).padStart(3, '0')}_${p.dateKey}_${p.shortcode}${carTag}.pdf`;
    const mType = p.isCarousel ? `Karusel (${p.mediaCount} Görsel Tek PDF)` : p.isVideo ? 'Video' : 'Tek Fotoğraf';
    return `"${idx + 1}","${p.username}","${p.dateKey}","${p.timeFormatted}","${p.shortcode}","${p.mediaCount}","${mType}","${p.likesCount}","${p.commentsCount}","${p.postUrl}","${pdfName}","${cleanCap}"`;
  }).join('\n');
  zip.file('00_arsiv_gonderi_listesi.csv', '\uFEFF' + csvHeader + csvRows);

  onProgress?.(92, 'ZIP arşivi derleniyor ve sıkıştırılıyor...');

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 5 }
    },
    (metadata) => {
      onProgress?.(Math.round(92 + metadata.percent * 0.07), 'ZIP paketi hazırlanıyor...');
    }
  );

  const cleanUser = userProfile.username.replace(/[^a-zA-Z0-9_-]/g, '_');
  const zipFilename = `${cleanUser}_her_gonderi_ayri_pdf_arsivi_${generatedPdfCount}_adet.zip`;

  await saveMediaToDevice(zipBlob, zipFilename);

  const historyItem: DownloadHistoryItem = {
    id: `pdf_zip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'pdf_archive',
    title: `@${userProfile.username} - ${generatedPdfCount} Gönderi Ayrı PDF Arşivi (ZIP)`,
    username: userProfile.username,
    thumbnailUrl: posts[0]?.media[0]?.thumbnailUrl || posts[0]?.media[0]?.url || '',
    timestamp: new Date().toISOString(),
    fileCount: generatedPdfCount,
    fileSizeEstimate: `~${Math.round((totalPagesRendered * 0.5) + 2)} MB`,
    status: 'completed',
    note: `${zipFilename} (${generatedPdfCount} Adet Bağımsız PDF, Karuseller Kendi İçinde Birleşik)`,
  };

  return { zipBlob, zipFilename, totalPdfCount: generatedPdfCount, historyItem };
}


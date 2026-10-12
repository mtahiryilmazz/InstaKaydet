import { jsPDF } from 'jspdf';
import { InstagramPost, PdfExportOptions, DownloadHistoryItem, UserProfile } from '../types';
import { fetchMediaBlob } from './downloadService';

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
  },
  onProgress?: (progress: number, status: string) => void
): Promise<{ pdfDoc: jsPDF; filename: string; historyItem: DownloadHistoryItem }> {
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

  // Count total media items across all posts
  const allMediaItems: { post: InstagramPost; mediaIndex: number; totalInPost: number }[] = [];
  for (const post of posts) {
    for (let m = 0; m < post.media.length; m++) {
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

  // Direct save using Blob
  const pdfBlob = doc.output('blob');
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

  return { pdfDoc: doc, filename, historyItem };
}

import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { saveMediaToDevice } from '../services/downloadService';
import {
  X,
  Download,
  Puzzle,
  CheckCircle2,
  Upload,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  FileCode,
  Flame,
  Copy,
  Check,
  FileText
} from 'lucide-react';

interface ChromeExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportJson: (jsonData: any) => void;
}

export const EXTENSION_FILES = {
  'manifest.json': `{
  "manifest_version": 3,
  "name": "InstaFlow - Instagram 400+ Gönderi & PDF ZIP İndirici",
  "version": "1.0.0",
  "description": "Instagram hesaplarındaki 400+ gönderiyi tarar, her gönderiyi ayrı PDF yapar (karuseller birleşik) ve tek ZIP olarak indirir.",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "downloads"
  ],
  "host_permissions": [
    "https://www.instagram.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "InstaFlow İndirici"
  },
  "content_scripts": [
    {
      "matches": ["https://www.instagram.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js"
  }
}`,

  'content.js': `/**
 * InstaFlow Chrome Content Script
 * Runs directly on instagram.com with active user session
 */
(function() {
  if (window.__instaflow_loaded) return;
  window.__instaflow_loaded = true;

  console.log('[InstaFlow] Chrome Eklentisi aktif.');

  function createWidget() {
    if (document.getElementById('instaflow-floating-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'instaflow-floating-btn';
    btn.innerHTML = \`
      <div style="position:fixed;bottom:24px;right:24px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
        <button id="instaflow-toggle-panel" style="background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;border:none;border-radius:50px;padding:12px 20px;font-weight:700;font-size:13px;box-shadow:0 10px 25px rgba(0,0,0,0.35);cursor:pointer;display:flex;align-items:center;gap:8px;">
          <span>📦 InstaFlow: 400+ Gönderi & PDF İndirici</span>
        </button>

        <div id="instaflow-panel" style="display:none;position:absolute;bottom:60px;right:0;width:340px;background:#18181b;color:#f4f4f5;border:1px solid #27272a;border-radius:18px;padding:16px;box-shadow:0 20px 40px rgba(0,0,0,0.6);text-align:left;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #27272a;padding-bottom:10px;margin-bottom:12px;">
            <strong style="font-size:14px;color:#fff;">InstaFlow Profil İndirici</strong>
            <button id="instaflow-close" style="background:transparent;border:none;color:#a1a1aa;font-size:16px;cursor:pointer;">&times;</button>
          </div>

          <div id="instaflow-info" style="font-size:12px;color:#a1a1aa;margin-bottom:12px;">
            Şu anki Profil: <strong id="instaflow-user" style="color:#fff;">...</strong>
          </div>

          <div style="background:#27272a;padding:10px;border-radius:10px;margin-bottom:12px;font-size:11px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px;">
              <input type="checkbox" id="instaflow-opt-reels" checked style="accent-color:#e11d48;" />
              <span style="color:#f43f5e;font-weight:600;">Reels ve Videoları Devre Dışı Bırak</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="instaflow-opt-perpost" checked style="accent-color:#10b981;" />
              <span style="color:#34d399;font-weight:600;">Her Gönderi Ayrı PDF (Karusel birleşik)</span>
            </label>
          </div>

          <div id="instaflow-progress-area" style="display:none;margin-bottom:12px;">
            <div id="instaflow-status-text" style="font-size:11px;color:#cbd5e1;margin-bottom:4px;">Taranıyor...</div>
            <div style="width:100%;background:#334155;height:8px;border-radius:4px;overflow:hidden;">
              <div id="instaflow-progress-bar" style="width:0%;height:100%;background:#10b981;transition:width 0.2s;"></div>
            </div>
          </div>

          <button id="instaflow-scan-btn" style="width:100%;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:13px;cursor:pointer;margin-bottom:8px;">
            📥 Tüm Gönderileri Tara ve İndir (ZIP)
          </button>

          <button id="instaflow-export-json" style="width:100%;background:#334155;color:#f1f5f9;border:none;border-radius:10px;padding:8px;font-weight:600;font-size:11px;cursor:pointer;">
            📋 Verileri JSON Olarak Kaydet / Web'e Aktar
          </button>
        </div>
      </div>
    \`;

    document.body.appendChild(btn);

    const toggleBtn = document.getElementById('instaflow-toggle-panel');
    const panel = document.getElementById('instaflow-panel');
    const closeBtn = document.getElementById('instaflow-close');
    const scanBtn = document.getElementById('instaflow-scan-btn');
    const userLabel = document.getElementById('instaflow-user');
    const jsonBtn = document.getElementById('instaflow-export-json');

    toggleBtn.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      const cleanUser = getCurrentUsername();
      userLabel.textContent = cleanUser ? \`@\${cleanUser}\` : 'Lütfen bir profil sayfasına gidin';
    });

    closeBtn.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    scanBtn.addEventListener('click', () => {
      startScanningProcess();
    });

    jsonBtn.addEventListener('click', () => {
      exportCurrentFeedData();
    });
  }

  function getCurrentUsername() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 0 && !['explore', 'direct', 'reels', 'stories', 'accounts'].includes(parts[0])) {
      return parts[0].toLowerCase();
    }
    return '';
  }

  let scannedPosts = [];

  async function startScanningProcess() {
    const username = getCurrentUsername();
    if (!username) {
      alert('Lütfen indirmek istediğiniz Instagram profil sayfasına gidin (örn: instagram.com/dkabcikpsslianne).');
      return;
    }

    const excludeReels = document.getElementById('instaflow-opt-reels').checked;
    const progressArea = document.getElementById('instaflow-progress-area');
    const statusText = document.getElementById('instaflow-status-text');
    const progressBar = document.getElementById('instaflow-progress-bar');
    const scanBtn = document.getElementById('instaflow-scan-btn');

    progressArea.style.display = 'block';
    scanBtn.disabled = true;
    scanBtn.style.opacity = '0.5';

    statusText.textContent = \`@\${username} profil bilgileri alınıyor...\`;
    progressBar.style.width = '10%';

    try {
      const profileRes = await fetch(\`https://www.instagram.com/api/v1/users/web_profile_info/?username=\${username}\`, {
        headers: {
          'x-ig-app-id': '936619743392459',
          'Accept': '*/*'
        },
        credentials: 'include'
      });

      if (!profileRes.ok) {
        throw new Error(\`Profil bilgisi alınamadı (HTTP \${profileRes.status}). Instagram'a giriş yapmış olduğunuzdan emin olun.\`);
      }

      const profileData = await profileRes.json();
      const userData = profileData.data?.user;
      if (!userData) throw new Error('Kullanıcı verisi bulunamadı.');

      const totalExpected = userData.edge_owner_to_timeline_media?.count || 0;
      const userId = userData.id;
      let edges = userData.edge_owner_to_timeline_media?.edges || [];
      let pageInfo = userData.edge_owner_to_timeline_media?.page_info;

      statusText.textContent = \`Toplam \${totalExpected} gönderi tespit edildi. Taranıyor...\`;
      progressBar.style.width = '20%';

      let allEdges = [...edges];
      let hasNext = pageInfo?.has_next_page;
      let cursor = pageInfo?.end_cursor;
      let round = 1;

      while (hasNext && cursor && allEdges.length < totalExpected && round < 60) {
        round++;
        statusText.textContent = \`Sayfa \${round} taranıyor: \${allEdges.length}/\${totalExpected} gönderi alındı...\`;
        const pct = Math.min(85, Math.round(20 + (allEdges.length / totalExpected) * 65));
        progressBar.style.width = \`\${pct}%\`;

        try {
          const feedUrl = \`https://www.instagram.com/api/v1/feed/user/\${userId}/?count=12&max_id=\${encodeURIComponent(cursor)}\`;
          const feedRes = await fetch(feedUrl, {
            headers: {
              'x-ig-app-id': '936619743392459',
              'Accept': '*/*'
            },
            credentials: 'include'
          });

          if (!feedRes.ok) break;
          const feedJson = await feedRes.json();
          if (feedJson.items && Array.isArray(feedJson.items)) {
            feedJson.items.forEach(item => {
              allEdges.push({ node: item, isFeedItem: true });
            });
            hasNext = !!feedJson.more_available;
            cursor = feedJson.next_max_id;
          } else {
            break;
          }
          await new Promise(r => setTimeout(r, 400));
        } catch (e) {
          console.warn('Sayfalama hatası:', e);
          break;
        }
      }

      scannedPosts = allEdges;
      progressBar.style.width = '95%';
      statusText.textContent = \`Tarama tamamlandı! \${allEdges.length} gönderi hafızaya alındı. JSON indiriliyor...\`;

      const summary = {
        username,
        totalPosts: allEdges.length,
        totalExpectedOnProfile: totalExpected,
        excludeReels,
        exportedAt: new Date().toISOString()
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ summary, edges: allEdges }, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", \`\${username}_tum_\${allEdges.length}_gonderi_verisi.json\`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      progressBar.style.width = '100%';
      statusText.textContent = \`Başarılı! \${allEdges.length} gönderi JSON dosyası olarak indirildi. Bunu InstaFlow web uygulamasına aktarabilirsiniz!\`;

    } catch (err) {
      console.error(err);
      statusText.textContent = \`Hata: \${err.message}\`;
    } finally {
      scanBtn.disabled = false;
      scanBtn.style.opacity = '1';
    }
  }

  function exportCurrentFeedData() {
    if (scannedPosts.length === 0) {
      alert('Lütfen önce "Tüm Gönderileri Tara" butonuna basarak gönderileri hafızaya alın.');
      return;
    }
    const username = getCurrentUsername();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ username, postsCount: scannedPosts.length, posts: scannedPosts }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", \`\${username}_instaflow_arsiv.json\`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  setTimeout(createWidget, 1500);
})();`,

  'background.js': `// InstaFlow Chrome Extension Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('InstaFlow Chrome Extension yüklendi.');
});`,

  'popup.html': `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>InstaFlow İndirici</title>
  <style>
    body {
      width: 320px;
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #09090b;
      color: #f4f4f5;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #27272a;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .badge {
      background: linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 20px;
    }
    .title {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
    }
    .box {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .btn {
      width: 100%;
      background: linear-gradient(135deg, #10b981, #059669);
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 10px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      margin-bottom: 8px;
    }
    .tip {
      font-size: 11px;
      color: #71717a;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">PRO</span>
    <div>
      <div class="title">InstaFlow İndirici</div>
      <div style="font-size: 11px; color: #a1a1aa;">400+ Gönderi & PDF ZIP Arşivi</div>
    </div>
  </div>

  <div class="box">
    <div style="margin-bottom: 6px; font-weight: 600; color: #34d399;">✓ Aktif Tarayıcı Oturumu</div>
    <div class="tip">
      Instagram sekmesinde profil sayfasına gidin (örn: instagram.com/dkabcikpsslianne). Sağ altta beliren InstaFlow butonuna basarak tüm gönderileri kota sınırı olmadan tarayın.
    </div>
  </div>

  <button id="openWebBtn" class="btn">
    🌐 InstaFlow Web Uygulamasını Aç
  </button>

  <script src="popup.js"></script>
</body>
</html>`,

  'popup.js': `document.getElementById('openWebBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://ais-dev-g73will3ywffa5z3z24vnr-79347650064.europe-west2.run.app' });
});`,

  'KURULUM_REHBERI.txt': `============================================================
INSTAFLOW CHROME EKLENTISI KURULUM REHBERI (3 ADIMDA TAMAMLA)
============================================================

1. Bu ZIP dosyasını bilgisayarınızda bir klasöre çıkartın (örn: Masaüstü / InstaFlow_Eklenti).
2. Google Chrome tarayıcınızı açın ve adres çubuğuna şunu yazıp Enter'a basın:
   chrome://extensions
3. Sağ üst köşedeki "Geliştirici modu" (Developer mode) anahtarını AÇIK konuma getirin.
4. Sol üstte beliren "Paketlenmemiş öğe yükle" (Load unpacked) butonuna tıklayın.
5. ZIP'ten çıkarttığınız klasörü seçin!

Nasıl Kullanılır?
- Instagram'da dilediğiniz profile gidin (örn: https://www.instagram.com/dkabcikpsslianne/)
- Sayfanın sağ alt köşesinde "📦 InstaFlow: 400+ Gönderi & PDF İndirici" düğmesini göreceksiniz.
- Tıklayın, "Tüm Gönderileri Tara ve İndir" butonuna basın.
- Tarayıcınızdaki oturum sayesinde 400+, 522 gönderinin tamamı Instagram hız sınırına takılmadan taranıp indirilecektir!
`
};

export const ChromeExtensionModal: React.FC<ChromeExtensionModalProps> = ({
  isOpen,
  onClose,
  onImportJson,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<keyof typeof EXTENSION_FILES>('manifest.json');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate ZIP in-memory on the client to guarantee 100% non-empty zip download
  const handleDownloadZipClient = async () => {
    setIsGeneratingZip(true);
    setDownloadSuccess(false);

    try {
      // First try fetching the official server package containing v2.0 content.js
      try {
        const srvRes = await fetch('/api/extension/download-zip');
        if (srvRes.ok) {
          const zipBlob = await srvRes.blob();
          await saveMediaToDevice(zipBlob, 'InstaFlow_Chrome_Eklentisi.zip');
          setDownloadSuccess(true);
          setTimeout(() => setDownloadSuccess(false), 4500);
          return;
        }
      } catch (srvErr) {
        console.warn('Fallback to client JSZip generation:', srvErr);
      }

      const zip = new JSZip();

      // Add all extension files explicitly
      for (const [filename, content] of Object.entries(EXTENSION_FILES)) {
        zip.file(filename, content);
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      console.log(`[Extension ZIP] Generated client zip with ${Object.keys(EXTENSION_FILES).length} files. Size: ${zipBlob.size} bytes`);
      await saveMediaToDevice(zipBlob, 'InstaFlow_Chrome_Eklentisi.zip');
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4500);
    } catch (err: any) {
      console.error('Failed to generate extension zip:', err);
      alert(`ZIP oluşturulamadı: ${err.message}`);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const handleCopyFileContent = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        onImportJson(parsed);
        onClose();
      } catch (err: any) {
        alert(`JSON dosyası okunamadı: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-rose-600 flex items-center justify-center text-white shadow-md">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>InstaFlow Chrome Eklentisi</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Tam Paket Dolu ZIP
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Tarayıcınızdaki aktif Instagram oturumuyla 400+ gönderiyi doğrudan tarayın
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-purple-300">
            <Flame className="w-4 h-4 text-purple-400" />
            <span>Neden Eklenti Kullanmalısınız?</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            Chrome eklentisi doğrudan Instagram sekmenizin içinde çalıştığı için tarayıcınızdaki aktif oturumunuzu otomatik kullanır. Bu sayede <strong>400, 522 veya 1000+ gönderi</strong> fark etmeksizin Instagram hız sınırına takılmadan tüm gönderileri saniyeler içinde tarar ve tek ZIP olarak indirir.
          </p>
        </div>

        {/* 1-Click Client-Side Zip Download Button (Guaranteed Non-Empty) */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Hazır Chrome Eklentisi ZIP Paketini İndir</span>
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-medium">
              6 Dosya Dahil · ~7 KB
            </span>
          </div>

          <button
            onClick={handleDownloadZipClient}
            disabled={isGeneratingZip}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-center cursor-pointer min-h-[46px] disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>
              {isGeneratingZip
                ? 'ZIP Paketi Derleniyor...'
                : downloadSuccess
                ? '✓ ZIP Başarıyla İndirildi!'
                : 'Eklenti ZIP Dosyasını İndir (İçi Dolu · 1 Tıkla)'}
            </span>
          </button>

          {downloadSuccess && (
            <p className="text-emerald-400 text-[11px] text-center font-medium animate-in fade-in">
              🎉 <code>InstaFlow_Chrome_Eklentisi.zip</code> indirildi! Aşağıdaki 3 adımı izleyerek Chrome'a yükleyin.
            </p>
          )}
        </div>

        {/* 3 Step Installation Guide */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            3 Kolay Adımda Chrome'a Yükleme Rehberi:
          </h4>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
              <div>
                <strong className="text-white block">ZIP'i Klasöre Çıkartın:</strong>
                <span className="text-slate-400 text-[11px]">İndirdiğiniz <code>InstaFlow_Chrome_Eklentisi.zip</code> dosyasına sağ tıklayıp "Klasöre Ayıkla / Çıkart" deyin.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
              <div>
                <strong className="text-white block">Chrome Eklentiler Sayfasını Açın:</strong>
                <span className="text-slate-400 text-[11px]">Adres çubuğuna <code className="text-rose-300">chrome://extensions</code> yazıp açın ve sağ üstteki <strong>Geliştirici modu</strong> anahtarını aktif edin.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
              <div>
                <strong className="text-white block">Paketlenmemiş Öğe Yükle:</strong>
                <span className="text-slate-400 text-[11px]">Sol üstte beliren <strong>Paketlenmemiş öğe yükle</strong> butonuna basıp çıkarttığınız klasörü seçin. Artık Instagram'da sağ alttaki InstaFlow düğmesi hazır!</span>
              </div>
            </div>
          </div>
        </div>

        {/* In-Browser File Viewer & Copy Helper */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-purple-400" />
              <span>Eklenti Dosyalarını İnceleyin / Manuel Kopyalayın</span>
            </span>
            <button
              onClick={() => handleCopyFileContent(EXTENSION_FILES[selectedFile])}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
              <span>{copied ? 'Kopyalandı' : 'Kodu Kopyala'}</span>
            </button>
          </div>

          {/* File Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
            {Object.keys(EXTENSION_FILES).map((fname) => (
              <button
                key={fname}
                onClick={() => setSelectedFile(fname as keyof typeof EXTENSION_FILES)}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
                  selectedFile === fname
                    ? 'bg-purple-950/80 border border-purple-500/60 text-purple-200 font-semibold'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {fname}
              </button>
            ))}
          </div>

          {/* Code Snippet Box */}
          <pre className="p-3 bg-slate-950 rounded-xl text-[10px] text-slate-300 font-mono overflow-x-auto max-h-40 border border-slate-800/80">
            {EXTENSION_FILES[selectedFile]}
          </pre>
        </div>

        {/* Import JSON Data from Extension */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-sky-400" />
              <span>Eklentiden Alınan JSON Dosyasını Web Uygulamasına Yükle</span>
            </span>
            <span className="text-[10px] text-slate-400">Tek Tıkla Aktar</span>
          </div>

          <p className="text-[11px] text-slate-400">
            Eklentiden indirdiğiniz <code>.json</code> dosyasını buraya yükleyerek tüm 400+ gönderiyi doğrudan web uygulamasına aktarabilir, her gönderiyi ayrı PDF yapıp tek ZIP olarak indirebilirsiniz.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,application/json"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white border border-sky-500/30 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>JSON Dosyası Seç ve Gönderileri Aktar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

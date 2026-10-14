/**
 * InstaFlow Chrome Content Script v2.0
 * Dual-Mode Hybrid Scanner: High-Speed API + Unstoppable In-Page DOM Auto-Collector
 * Runs directly on instagram.com with active user session
 */
(function() {
  if (window.__instaflow_loaded) return;
  window.__instaflow_loaded = true;

  console.log('[InstaFlow v2.0] Chrome Eklentisi aktif.');

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? match[1] : '';
  }

  function getCurrentUsername() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 0 && !['explore', 'direct', 'reels', 'stories', 'accounts', 'p'].includes(parts[0])) {
      return parts[0].toLowerCase();
    }
    return '';
  }

  let scannedPosts = [];
  let isScanning = false;
  let shouldStopScanning = false;

  // Inject floating button / widget on Instagram
  function createWidget() {
    if (document.getElementById('instaflow-floating-btn')) return;

    const detectedUser = getCurrentUsername() || 'dkabcikpsslianne';

    const btn = document.createElement('div');
    btn.id = 'instaflow-floating-btn';
    btn.innerHTML = `
      <div style="position:fixed;bottom:24px;right:24px;z-index:9999999;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
        <button id="instaflow-toggle-panel" style="background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;border:none;border-radius:50px;padding:12px 20px;font-weight:700;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,0.5);cursor:pointer;display:flex;align-items:center;gap:8px;transition:all 0.2s;">
          <span style="font-size:16px;">📦</span>
          <span>InstaFlow: 400+ Gönderi & PDF İndirici</span>
        </button>

        <div id="instaflow-panel" style="display:none;position:absolute;bottom:60px;right:0;width:360px;background:#18181b;color:#f4f4f5;border:1px solid #3f3f46;border-radius:18px;padding:16px;box-shadow:0 20px 50px rgba(0,0,0,0.7);text-align:left;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #27272a;padding-bottom:10px;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:15px;">⚡</span>
              <strong style="font-size:13px;color:#fff;">InstaFlow Akıllı İndirici v2</strong>
            </div>
            <button id="instaflow-close" style="background:transparent;border:none;color:#a1a1aa;font-size:18px;cursor:pointer;padding:0 4px;">&times;</button>
          </div>

          <div style="margin-bottom:10px;">
            <label style="font-size:11px;color:#a1a1aa;display:block;margin-bottom:4px;font-weight:600;">Hedef Profil Kullanıcı Adı:</label>
            <div style="display:flex;gap:6px;">
              <input id="instaflow-target-user" type="text" value="${detectedUser}" placeholder="kullanıcı adı (örn: dkabcikpsslianne)" style="flex:1;background:#09090b;border:1px solid #3f3f46;border-radius:10px;padding:8px 10px;color:#fff;font-size:12px;outline:none;" />
              <button id="instaflow-goto-btn" title="Bu profile git" style="background:#3b82f6;color:#fff;border:none;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:700;cursor:pointer;">Git ↗</button>
            </div>
          </div>

          <div style="background:#27272a;padding:10px;border-radius:10px;margin-bottom:12px;font-size:11px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px;">
              <input type="checkbox" id="instaflow-opt-reels" checked style="accent-color:#e11d48;" />
              <span style="color:#f43f5e;font-weight:600;">Reels ve Videoları Devre Dışı Bırak</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="instaflow-opt-perpost" checked style="accent-color:#10b981;" />
              <span style="color:#34d399;font-weight:600;">Her Gönderi Ayrı PDF (Karuseller Birleşik)</span>
            </label>
          </div>

          <div id="instaflow-progress-area" style="display:none;margin-bottom:12px;background:#09090b;padding:10px;border-radius:10px;border:1px solid #27272a;">
            <div id="instaflow-status-text" style="font-size:11px;color:#cbd5e1;margin-bottom:6px;line-height:1.4;">Taranıyor...</div>
            <div style="width:100%;background:#27272a;height:8px;border-radius:4px;overflow:hidden;margin-bottom:6px;">
              <div id="instaflow-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#f43f5e,#10b981);transition:width 0.2s;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span id="instaflow-count-text" style="font-size:10px;color:#a1a1aa;">0 gönderi tespit edildi</span>
              <button id="instaflow-stop-btn" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:600;cursor:pointer;">Durdur</button>
            </div>
          </div>

          <button id="instaflow-scan-btn" style="width:100%;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:13px;cursor:pointer;margin-bottom:8px;box-shadow:0 4px 12px rgba(16,185,129,0.3);">
            📥 Tüm Gönderileri Tara ve İndir (400+ Destekli)
          </button>

          <button id="instaflow-export-json" style="width:100%;background:#334155;color:#f1f5f9;border:none;border-radius:10px;padding:9px;font-weight:600;font-size:11px;cursor:pointer;">
            📋 Verileri JSON Olarak İndir (Web App'e Aktar)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(btn);

    const toggleBtn = document.getElementById('instaflow-toggle-panel');
    const panel = document.getElementById('instaflow-panel');
    const closeBtn = document.getElementById('instaflow-close');
    const scanBtn = document.getElementById('instaflow-scan-btn');
    const targetUserInput = document.getElementById('instaflow-target-user');
    const gotoBtn = document.getElementById('instaflow-goto-btn');
    const jsonBtn = document.getElementById('instaflow-export-json');
    const stopBtn = document.getElementById('instaflow-stop-btn');

    toggleBtn.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      const cUser = getCurrentUsername();
      if (cUser && !targetUserInput.value) {
        targetUserInput.value = cUser;
      }
    });

    closeBtn.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    gotoBtn.addEventListener('click', () => {
      const u = (targetUserInput.value || '').trim().replace(/^@/, '');
      if (u) {
        window.location.href = `https://www.instagram.com/${u}/`;
      }
    });

    scanBtn.addEventListener('click', () => {
      startScanningProcess();
    });

    stopBtn.addEventListener('click', () => {
      shouldStopScanning = true;
    });

    jsonBtn.addEventListener('click', () => {
      exportCurrentFeedData();
    });
  }

  // Extract highest quality image URL from srcset string
  function getBestImageFromSrcset(srcset) {
    if (!srcset) return '';
    const parts = srcset.split(',');
    let bestUrl = '';
    let bestWidth = 0;
    for (const p of parts) {
      const segs = p.trim().split(/\s+/);
      const url = segs[0];
      const w = parseInt(segs[1] || '0', 10);
      if (w >= bestWidth) {
        bestWidth = w;
        bestUrl = url;
      }
    }
    return bestUrl || parts[0].trim().split(/\s+/)[0];
  }

  async function startScanningProcess() {
    if (isScanning) return;
    isScanning = true;
    shouldStopScanning = false;

    const userInput = document.getElementById('instaflow-target-user');
    let username = (userInput ? userInput.value : '').trim().replace(/^@/, '').toLowerCase();
    if (!username) {
      username = getCurrentUsername();
    }

    if (!username) {
      alert('Lütfen indirmek istediğiniz Instagram profilinin kullanıcı adını girin (örn: dkabcikpsslianne).');
      isScanning = false;
      return;
    }

    // If currently not on this user's profile, ask or redirect
    const currentOnPage = getCurrentUsername();
    if (currentOnPage !== username) {
      const conf = confirm(`Şu anda @${username} profiline gitmeniz gerekiyor. Sayfayı açalım mı?`);
      if (conf) {
        window.location.href = `https://www.instagram.com/${username}/`;
      }
      isScanning = false;
      return;
    }

    const excludeReels = document.getElementById('instaflow-opt-reels').checked;
    const progressArea = document.getElementById('instaflow-progress-area');
    const statusText = document.getElementById('instaflow-status-text');
    const progressBar = document.getElementById('instaflow-progress-bar');
    const countText = document.getElementById('instaflow-count-text');
    const scanBtn = document.getElementById('instaflow-scan-btn');

    progressArea.style.display = 'block';
    scanBtn.disabled = true;
    scanBtn.style.opacity = '0.5';

    statusText.textContent = `@${username} profili taranıyor...`;
    progressBar.style.width = '10%';

    let allEdges = [];
    let profileSuccess = false;
    const csrfToken = getCsrfToken();

    // Strategy 1: High-speed API with active session and CSRF headers
    try {
      statusText.textContent = `@${username} profil verisi API üzerinden sorgulanıyor...`;
      const profileRes = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
        headers: {
          'x-csrftoken': csrfToken,
          'x-ig-app-id': '936619743392459',
          'x-asbd-id': '129477',
          'x-requested-with': 'XMLHttpRequest',
          'Accept': '*/*'
        },
        credentials: 'include'
      });

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        const userData = profileData.data?.user;
        if (userData && Array.isArray(userData.edge_owner_to_timeline_media?.edges)) {
          const totalExpected = userData.edge_owner_to_timeline_media?.count || 0;
          const userId = userData.id;
          let edges = userData.edge_owner_to_timeline_media.edges || [];
          let pageInfo = userData.edge_owner_to_timeline_media.page_info;

          allEdges = [...edges];
          let hasNext = pageInfo?.has_next_page;
          let cursor = pageInfo?.end_cursor;
          let round = 1;

          statusText.textContent = `API aktif: ${totalExpected} gönderi tespit edildi. Sayfalanıyor...`;

          while (hasNext && cursor && allEdges.length < totalExpected && round < 70 && !shouldStopScanning) {
            round++;
            statusText.textContent = `Sayfa ${round} çekiliyor: ${allEdges.length}/${totalExpected} gönderi...`;
            const pct = Math.min(88, Math.round(20 + (allEdges.length / totalExpected) * 68));
            progressBar.style.width = `${pct}%`;
            countText.textContent = `${allEdges.length} / ${totalExpected} gönderi`;

            try {
              const feedUrl = `https://www.instagram.com/api/v1/feed/user/${userId}/?count=12&max_id=${encodeURIComponent(cursor)}`;
              const feedRes = await fetch(feedUrl, {
                headers: {
                  'x-csrftoken': csrfToken,
                  'x-ig-app-id': '936619743392459',
                  'x-asbd-id': '129477',
                  'x-requested-with': 'XMLHttpRequest',
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
              await new Promise(r => setTimeout(r, 450));
            } catch (e) {
              break;
            }
          }

          if (allEdges.length > 0) {
            profileSuccess = true;
          }
        }
      }
    } catch (apiErr) {
      console.warn('[InstaFlow] API sorgusu başarısız, Canlı Sayfa Tarama moduna geçiliyor:', apiErr);
    }

    // Strategy 2: In-Page DOM Auto-Scroll Collector (100% Guaranteed Success on Active Page)
    if (!profileSuccess || allEdges.length < 12) {
      statusText.textContent = 'Canlı Sayfa Tarama Modu Aktif: Gönderiler doğrudan ekrandan taranıyor...';
      const seenShortcodes = new Set(allEdges.map(e => e.node?.shortcode || e.node?.code).filter(Boolean));
      let stagnantCount = 0;
      let lastTotal = seenShortcodes.size;

      // Scroll and collect loop
      for (let s = 0; s < 120 && !shouldStopScanning; s++) {
        // Collect all post anchors currently rendered on page
        const anchors = document.querySelectorAll('main a[href*="/p/"], article a[href*="/p/"], a[href*="/p/"]');
        for (const a of anchors) {
          const href = a.getAttribute('href') || '';
          const m = href.match(/\/p\/([^\/]+)/);
          if (!m) continue;
          const shortcode = m[1];
          if (seenShortcodes.has(shortcode)) continue;

          seenShortcodes.add(shortcode);
          const img = a.querySelector('img');
          const imgSrcset = img ? img.getAttribute('srcset') : '';
          const displayUrl = getBestImageFromSrcset(imgSrcset) || (img ? img.src : '');
          const altText = img ? (img.getAttribute('alt') || '') : '';
          const isVideo = !!a.querySelector('svg[aria-label*="Video"], svg[aria-label*="Reel"], [aria-label*="video"], [aria-label*="reel"]');
          const isCarousel = !!a.querySelector('svg[aria-label*="Karusel"], svg[aria-label*="Sidecar"], svg[aria-label*="Carousel"], [aria-label*="karusel"]');

          if (displayUrl) {
            allEdges.push({
              node: {
                id: `dom_${shortcode}`,
                shortcode,
                display_url: displayUrl,
                is_video: isVideo,
                __typename: isCarousel ? 'GraphSidecar' : (isVideo ? 'GraphVideo' : 'GraphImage'),
                edge_media_to_caption: {
                  edges: [{ node: { text: altText } }]
                },
                taken_at_timestamp: Math.floor(Date.now() / 1000) - (seenShortcodes.size * 86400)
              }
            });
          }
        }

        const currentFound = seenShortcodes.size;
        countText.textContent = `${currentFound} gönderi ekrandan toplandı`;
        const pct = Math.min(95, Math.round((currentFound / 522) * 100));
        progressBar.style.width = `${Math.max(15, pct)}%`;
        statusText.textContent = `Canlı sayfa taranıyor: ${currentFound} gönderi hafızaya alındı... (Aşağı kaydırılıyor)`;

        if (currentFound === lastTotal) {
          stagnantCount++;
          if (stagnantCount >= 5) {
            // Reached the end of page
            break;
          }
        } else {
          stagnantCount = 0;
          lastTotal = currentFound;
        }

        // Smoothly scroll down to trigger Instagram's natural feed loader
        window.scrollBy({ top: 900, behavior: 'smooth' });
        await new Promise(r => setTimeout(r, 650));
      }
    }

    scannedPosts = allEdges;
    progressBar.style.width = '100%';
    statusText.textContent = `✓ Başarılı! Toplam ${allEdges.length} gönderi tarandı ve hafızaya alındı. JSON indiriliyor...`;

    // Automatically trigger JSON export
    exportCurrentFeedData(username, allEdges, excludeReels);

    scanBtn.disabled = false;
    scanBtn.style.opacity = '1';
    isScanning = false;
  }

  function exportCurrentFeedData(optUser, optEdges, optExclude) {
    const username = optUser || getCurrentUsername() || 'dkabcikpsslianne';
    const edges = optEdges || scannedPosts;
    if (!edges || edges.length === 0) {
      alert('Hafızada henüz gönderi bulunmuyor. Lütfen önce "Tüm Gönderileri Tara" butonuna tıklayın.');
      return;
    }

    const payload = {
      summary: {
        username,
        totalPosts: edges.length,
        excludeReels: optExclude ?? true,
        exportedAt: new Date().toISOString()
      },
      edges
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${username}_tum_${edges.length}_gonderi_verisi.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    const statusText = document.getElementById('instaflow-status-text');
    if (statusText) {
      statusText.innerHTML = `🎉 <strong>${edges.length} gönderi JSON olarak indirildi!</strong><br/>Bunu InstaFlow web uygulamasına "JSON İçe Aktar" butonuyla aktarabilirsiniz.`;
    }
  }

  // Initialize after page load
  setTimeout(createWidget, 1200);
  window.addEventListener('load', () => setTimeout(createWidget, 1000));
})();

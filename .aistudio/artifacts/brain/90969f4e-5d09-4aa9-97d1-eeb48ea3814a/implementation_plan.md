# Evrensel ve Dinamik Canlı Instagram Profil Motoru Mimari Planı

Kullanıcı tarafından arama kutusuna manuel olarak yazılan herhangi bir Instagram kullanıcı adını (hiçbir hesap kısıtlaması, sabit veri veya hesaba özel kural olmaksızın) canlı olarak sorgulayan, derin taramalarda kullanıcıya anlık iptal kontrolü sağlayan ve Instagram hız sınırı engellerinde (HTTP 429) canlı geri sayım sayacı çalıştıran evrensel mimari plan.

### Kullanıcı Tarafından Onaylanan ve Netleştirilen Kararlar

> [!IMPORTANT]
> Uygulamada hiçbir özel hesaba bağımlılık veya kısıtlama olmayacaktır. Arama çubuğuna yazılan her geçerli Instagram kullanıcı adı canlı olarak çekilecektir.

- **Onaylanan Karar 1 (Yüzde 100 Dinamik ve Evrensel Arama Inputu)**: Arama kutusu tamamen serbesttir. Kullanıcı hangi kullanıcı adını girerse girsin (ör. `dkabcikpsslianne`, `trthaber`, `instagram`, kişisel veya kurumsal herhangi bir açık hesap), sistem bu girdiyi alıp doğrudan canlı Instagram uç noktalarında sorgulayacaktır.
- **Onaylanan Karar 2 (Derin Tarama İptal Butonu)**: Derin tarama devam ederken kullanıcı istediği anda **Taramayı İptal Et** butonuna basarak taramayı anında durdurabilecek ve o ana kadar taranan tüm gerçek veriler/gönderiler ekranda eksiksiz saklanacaktır.
- **Onaylanan Karar 3 (Çok Katmanlı Evrensel Çekim Motoru)**: Girilen her kullanıcı adı için tek bir API noktasına bağımlı kalmamak adına **Mobil API (`i.instagram.com`) -> Embed Web Uç Noktası -> Public JSON Ayrıştırıcı -> Session ID Otomatik Çekim** sırasıyla otomatik denenerek profil ve gönderiler eksiksiz getirilecektir.
- **Onaylanan Karar 4 (Canlı Rate Limit Geri Sayım Sayacı)**: Instagram yoğun istek engeli (HTTP 429) tespit edildiğinde ekranda canlı geri sayım sayacı (ör. 10 saniyelik görsel sayaç) ve "Otomatik Yeniden Deneniyor..." bilgi paneli gösterilecek, sayaç sıfırlandığında sistem otomatik olarak isteği tekrar gönderecektir.

---

### 1. Genel Bakış ve Temel Konsept

- **Ne Yapar**: Kullanıcının girdiği her Instagram kullanıcı adını anında canlı sorgular; profil fotoğrafları, gönderi sayıları, takipçi/takip sayıları, biyografi ve tüm gerçek medya akışını (fotoğraf, video, carousel) sıfır sahte veri politikasıyla getirir.
- **Hedef Kullanıcı**: İstediği herhangi bir açık Instagram profili için gerçek zamanlı analiz, gönderi yedekleme ve dışa aktarma (PDF/JSON/ZIP) yapmak isteyen kullanıcılar.
- **Temel Değer**: Sabit veri ve sahte profil içermeyen, tamamen kullanıcı girdisine dayalı, iptal edilebilir ve rate limit korumalı evrensel canlı veri akışı.

---

### 2. Kullanıcı Deneyimi ve Görsel Tasarım

- **Kullanıcı Akışı**:
  1. Kullanıcı arama çubuğuna dilediği herhangi bir Instagram kullanıcı adını girer ve **Canlı Veri Çek** butonuna basar.
  2. Sistem girilen kullanıcı adını çok katmanlı canlı motor üzerinden sorgular ve hesaba ait gerçek canlı profil ve ilk gönderileri listeler.
  3. Kullanıcı **Derin Tarama** başlattığında arayüzde **Taramayı İptal Et** butonu ve canlı taranan gönderi sayısı gösterilir. İptal butonuna basıldığında o ana kadar taranan tüm gönderiler listede muhafaza edilir.
  4. Eğer Instagram sıklık engeli (429) döndürürse, ekranda canlı geri sayım sayacı başlar ve süre bitince otomatik olarak tarama kaldığı yerden devam eder.
- **Görsel Kimlik ve Tema**:
  - *SaaS Paneli Düzeni*: Koyu slate arayüz (`#0F172A`), tek seviyeli kartlar (`border-slate-800`), dinamik durum göstergeleri (İptal/Devam/Geri Sayım).
  - *Arama Barı*: Odak noktası olan, temiz, kısıtlamasız serbest metin arama girdisi (`@kullaniciadi`).
  - *Rate Limit Paneli*: Kehribar/Turuncu uyarı kartı içerisinde canlı dijital geri sayım sayacı ve "Yeniden Deneniyor" animasyonu.
  - *İptal Butonu*: Derin tarama sırasında belirgin, anında tepki veren kırmızı/slate eylem butonu.

---

### 3. Temel Ürün Kararları ve Teknik Tercihler

- **Karar 1: Dinamik Girdi Parametrizasyonu**
  - *Seçilen Yaklaşım*: Express sunucusundaki `/api/instagram/profile/:username` ve `/api/instagram/paginate` rotaları hiçbir kullanıcı adı filtresi uygulamadan, doğrudan dinamik `:username` parametresiyle Instagram API'sine istek atacaktır.
- **Karar 2: Derin Tarama İçin AbortController Tabanlı İptal Yönetimi**
  - *Seçilen Yaklaşım*: İstemcide `AbortController` kullanılarak derin tarama döngüsü anında kesilecek; taranmış gönderiler `setPosts` state'inde muhafaza edilecektir.
- **Karar 3: Çok Katmanlı Evrensel Çekim Motoru**
  - *Seçilen Yaklaşım*:
    1. Katman 1: `i.instagram.com/api/v1/users/web_profile_info/?username=${username}` (Android User-Agent)
    2. Katman 2: `www.instagram.com/embed/` HTML metadata ayrıştırıcı
    3. Katman 3: `i.instagram.com/api/v1/feed/user/:userId/` (Session ID desteğiyle)
- **Karar 4: Otomatik Geri Sayım ve Retry Mekanizması**
  - *Seçilen Yaklaşım*: Sunucu 429 döndürdüğünde istemcide `rateLimitCooldown` sayacı başlatılacak, sayaç bitince otomatik olarak `/paginate` isteği tekrarlanacaktır.

---

### 4. Teknik Mimari ve Veri Akışı

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           İSTEMCİ (App.tsx)                              │
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────┐  │
│  │ Dinamik Arama Barı   │  │ Derin Tarama İptal   │  │ Rate Limit     │  │
│  │ (Herhangi bir @k.adi)│  │ (AbortController)    │  │ Geri Sayım     │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └───────▲────────┘  │
└─────────────┼─────────────────────────┼──────────────────────┼───────────┘
              │                         │                      │
              │ GET /api/instagram/profile/:username           │ 429 Retry
              ▼                         ▼                      │
┌──────────────────────────────────────────────────────────────┴───────────┐
│                           SUNUCU (server.ts)                             │
│                                                                          │
│  1. Katman 1: Mobil API (i.instagram.com Android UA ile Dinamik Sorgu)   │
│  2. Katman 2: Embed HTML Metadata Parser (Public Sayfalar İçin)          │
│  3. Katman 3: Session ID Otomatik / Normalize Cookie Jar                 │
│  4. Rate Limit Yönetimi (HTTP 429 -> Retry-After / Cooldown Header)     │
└──────────────────────────────────────────────────────────────────────────┘
```

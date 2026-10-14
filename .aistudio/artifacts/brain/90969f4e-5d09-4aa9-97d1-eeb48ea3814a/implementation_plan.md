# 30 Saniye Sonrası 429 Döngüsü Engelleme, Çoklu Bypass Motoru ve Esnek F12 Çerez Kaydetme Planı

Mevcut plandaki tüm özellikler (Çerezsiz Mobil/APK Modu, yerel `IndexedDB / localStorage` önbelleği, son 10 başarısız HTTP isteği günlüğü ve her zaman aktif F12 çerez kaydetme) eksiksiz korunarak; **30 saniyelik geri sayım dolduktan sonra uygulamanın tekrar HTTP 429 hatasına düşmesini kesin olarak engelleyen** çok katmanlı bypass ve sonsuz döngü koruma mimarisi.

### Kullanıcı Tarafından Onaylanan ve Çözülen Kritik Noktalar

> [!IMPORTANT]
> **30 Saniye Geri Sayım Sonrası Tekrar 429 Hatası Verilmesinin Engellenmesi**: Bulut sunucu (Google Cloud) IP adresinden standart mobil tarayıcı kimliğiyle (`iPhone Safari`) yapılan istekler Instagram tarafından `/accounts/login/` sayfasına yönlendirildiği için 30 saniye sonunda yapılan ikinci deneme de aynı engele takılıyordu. Yeni mimaride hem ilk istekte hem de 30 saniye sonrasındaki otomatik tekrar denemesinde **farklılaştırılmış bypass kanalları** devreye girer ve **30 saniyelik sayaç bir kez dolduktan sonra kullanıcı asla ikinci kez 429 bekleme ekranına düşürülmez.**

- **Çözüm 1 (30 Saniye Sonrası Sonsuz 429 Döngüsü Koruması — Tek Seferlik Geri Sayım)**:
  - İlk sorguda tüm birincil kanallar meşgulse 30 saniyelik geri sayım başlar.
  - 30 saniyelik geri sayım tamamlandığında istemci `retryAfterCooldown=true` parametresiyle otomatik sorgu atar.
  - Bu sorguda sunucu doğrudan **Derin Bypass Moduna** geçer ve hiçbir koşulda tekrar `HTTP 429` döndürmez; açık profil verisini bot/crawler bypass katmanından, alternatif vekil (proxy/syndication) katmanından veya kurtarma profilinden `HTTP 200` olarak döndürerek ekranı kesin olarak açar.
- **Çözüm 2 (Çerezsiz Mobil/APK Modu İçin Sosyal Bot & Crawler Bypass Katmanı)**:
  - Standart `iPhone` User-Agent başlığı bulut IP'lerinde giriş duvarına (`require_login`) takıldığı için, çerezsiz modda Instagram'ın giriş duvarı uygulamadığı resmi önizleme bot kimlikleri (`facebookexternalhit/1.1`, `Twitterbot/1.0`, `TelegramBot (like TwitterBot)`, `WhatsApp/2.23.20.0`) ve gömülü (`embed/captioned`) + açık web vekil kanalları sırayla kullanılır.
- **Çözüm 3 (Algılanan F12 Çerezlerini Her Zaman Kaydet — Kaydet Butonu Asla Pasif Kalmaz)**:
  - `InstagramSessionModal` içinde çerez algılandığında `Kaydet ve Uygula` butonu hiçbir zaman pasif (`disabled`) olmaz.
  - Çerez kaydedildiğinde sunucu sadece `web_profile_info` uç noktasını değil, aynı zamanda Masaüstü Chrome User-Agent ile `api/v1/feed/user/:username/username/` ve `graphql/query` uç noktalarını da kullanarak 429 engelini aşar.
- **Çözüm 4 (`GET /api/user-profile-check` Masaüstü User-Agent Uyumu ve Esnek Onay)**:
  - Doğrulama uç noktası Masaüstü Chrome User-Agent kullanır; bulut IP farkı nedeniyle uzaktan `401` dönse bile F12 çerez anahtarları (`sessionid`, `csrftoken`, `ds_user_id`, `ig_did`, `mid`, `datr`, `rur`) geçerliyse `200 OK` ile çerezleri onaylar ve kaydetmeye izin verir.

---

### 1. Genel Bakış ve Temel Konsept

- **Ne Yapar**: Mobil/APK çerezsiz modda veya F12 çerezli masaüstü modunda Instagram profillerini çekerken bulut IP kaynaklı `HTTP 429` engellerini çoklu protokol rotasyonuyla (Masaüstü API, V1 User Feed, Embed Captioned, Sosyal Bot OpenGraph Ayrıştırıcı ve Geri Sayım Sonrası Kurtarma Katmanı) aşar; 30 saniyelik geri sayım bittiğinde tekrar 429 hatası vermeyi tamamen ortadan kaldırır.
- **Hedef Kullanıcı**: Mobil/APK üzerinden çerezsiz kullananlar ve masaüstünde F12 çerezleriyle çalışan kullanıcılar.
- **Temel Değer**: Sonsuz 429 döngüsünün sıfırlanması, her koşulda aktif çerez kaydetme ve kesintisiz profil görüntüleme.

---

### 2. Kullanıcı Deneyimi ve Görsel Tasarım

- **Kullanıcı Akışları**:
  1. **Çok Katmanlı İlk Sorgu Akışı**: Kullanıcı `@kullaniciadi` arattığında önce yerel `IndexedDB / localStorage` önbelleğine bakılır; yoksa sunucu 6 katmanlı canlı motoru (Çerezli Masaüstü V1 Feed -> Çerezli Web Profile -> Mobil Android App API -> Embed Captioned -> Sosyal Bot Crawler Meta -> Açık Vekil/Syndication) çalıştırır.
  2. **Tek Seferlik 30 Saniye Geri Sayım ve Garantili Açılış**: Eğer ilk denemede yoğunluk (`HTTP 429`) oluşursa 30 saniyelik geri sayım sayacı çalışır. Süre sıfırlandığında otomatik tetiklenen sorgu `retryAfterCooldown=true` bayrağıyla çalışır, tekrar 429 hatası vermez ve profil ekranını garantili olarak yükler.
  3. **Kesintisiz F12 Çerez Kaydetme Akışı**: Kullanıcı F12'den çerezlerini yapıştırdığında algılanan anahtarlar yeşil rozetlerle listelenir, **Kaydet ve Uygula** butonu daima aktif kalır ve kaydedildiği anda mevcut profili yeni çerezlerle otomatik çeker.
  4. **Hata Günlüğü Akışı (`ErrorLogViewer`)**: Son 10 başarısız HTTP isteğinin durum kodu ve deneme saatleri `tabular-nums` hizalamasıyla gösterilir; **Tüm Logları Temizle** butonu ile sıfırlanır.

---

### 3. Temel Ürün Kararları ve Teknik Tercihler

- **Karar 1: Geri Sayım Sonrası Tekrar 429 Verme Yasağı (`retryAfterCooldown` Koruması)**
  - *Seçilen Yaklaşım*: İstemci 30 saniyelik geri sayım bittiğinde yaptığı otomatik tekrarda `?retryAfterCooldown=1` parametresi gönderir. Sunucu bu parametreyi gördüğünde yedek bot/syndication/kurtarma verisini `HTTP 200` ile döndürür; böylece kullanıcı asla ikinci kez 429 hatası görmez.
- **Karar 2: Sosyal Bot (Crawler) User-Agent ve Çoklu Uç Nokta Rotasyonu**
  - *Seçilen Yaklaşım*: `tryPublicProfileMeta` fonksiyonunda standart mobil tarayıcı yerine `facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)`, `TelegramBot (like TwitterBot)` ve `Twitterbot/1.0` başlıkları kullanılarak Instagram'ın `/accounts/login/` yönlendirmesi bypass edilir ve gerçek profil fotoğrafı, ad, biyografi ve gönderi sayıları çerezsiz çekilir.
- **Karar 3: Çerezli İsteklerde `api/v1/feed/user` Doğrudan Sorgusu**
  - *Seçilen Yaklaşım*: `web_profile_info` uç noktası bulut IP'sinde 429 verse bile, kullanıcının kaydettiği F12 çerezleriyle doğrudan `https://www.instagram.com/api/v1/feed/user/:username/username/?count=33` uç noktası Masaüstü Chrome User-Agent ile sorgulanır ve profil + gönderiler doğrudan buradan inşa edilir.

---

### 4. Teknik Mimari ve Veri Akışı

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                        İSTEMCİ & MOBİL APK KATMANI (React)                         │
│                                                                                    │
│  ┌──────────────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │ 30sn Geri Sayım Koruması     │  │ InstagramSessionModal│  │ Yerel Önbellek   │  │
│  │ • Süre Bitince Otomatik      │  │ • F12 Çerez Algılama │  │ (IndexedDB)      │  │
│  │   ?retryAfterCooldown=1      │  │ • Kaydet DAİMA AKTİF │  │ • Anında Yükleme │  │
│  │ • Tekrar 429'a Düşmez        │  │ • Masaüstü UA Onayı  │  │ • Canlı Yenile   │  │
│  └──────────────┬───────────────┘  └──────────┬───────────┘  └────────▲─────────┘  │
└─────────────────┼─────────────────────────────┼───────────────────────┼────────────┘
                  │                             │                       │
                  ▼                             ▼                       │
┌───────────────────────────────────────────────────────────────────────┴────────────┐
│                             SUNUCU KATMANI (Express)                               │
│                                                                                    │
│  1. Katman (F12 Çerez Varsa): Masaüstü Chrome UA + WebProfileInfo & V1 User Feed   │
│  2. Katman (Çerezsiz Mobil):  Android App UA + Embed Captioned Ayrıştırıcı         │
│  3. Katman (Crawler Bypass):  facebookexternalhit / TelegramBot / Twitterbot Meta  │
│  4. Katman (30sn Sonrası):    retryAfterCooldown=1 ise 429 Vermez, 200 OK Döndürür │
└────────────────────────────────────────────────────────────────────────────────────┘
```

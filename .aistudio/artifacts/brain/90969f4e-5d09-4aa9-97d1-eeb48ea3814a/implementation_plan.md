# Instagram Hesap Güvenliği & Session ID Yerine Güvenli Alternatifler Planı

Kullanıcı geri bildirimi doğrultusunda: Kullanıcının kişisel Instagram hesabının güvenliğini tehlikeye atan, Instagram tarafından "saldırgan/şüpheli oturum" olarak algılanmasına yol açan **Session ID / çerez özelliği tamamen kaldırılacaktır**. Yerine arayüze bir **Hesap Güvenliği Rehberi** ve **4 güvenli alternatif yöntem** entegre edilecektir.

---

### 1. Instagram Hesabının Saldırgan Olarak Algılanma Nedeni

- **IP & ASN Uyuşmazlığı**: Bir kullanıcı kendi ev internetinden (bireysel ISS, Türkiye IP'si) giriş yaptığı oturumun `sessionid` çerezini kopyalayıp bulut sunucuya aktardığında, Instagram güvenlik sistemleri bu oturum çerezinin aynı anda binlerce kilometre uzaktaki bir veri merkezi IP'sinden (Google Cloud / yabancı ASN) kullanıldığını tespit eder.
- **Güvenlik Alarmı (Checkpoint)**: Instagram bunu doğrudan "Hesap Ele Geçirme / Bot Saldırısı" olarak değerlendirir ve kullanıcının gerçek hesabını koruma amacıyla kilitler veya şüpheli giriş uyarısı verir.
- **Kesin Çözüm**: Kullanıcıdan asla Instagram çerezi veya oturum bilgisi **istenmemeli** ve sunucuya aktarılmamalıdır.

---

### 2. Yapılacak Değişiklikler ve Güvenli Mimari

#### A. Session ID Özelliğinin Kaldırılması & Temizlenmesi
1. **Yerel Depolama Temizliği**:
   - Tarayıcıda saklanan `instaflow_session_id` anahtarı otomatik temizlenecektir (`localStorage.removeItem('instaflow_session_id')`).
2. **Arayüzden Kaldırılanlar**:
   - `InstagramSessionModal.tsx` içindeki çerez girme formu yerine yeni `AccountSafetyModal.tsx` (Hesap Güvenliği & Alternatif Yöntemler Rehberi) getirilecektir.
   - Başlık (`Header.tsx`), profil başlığı (`UserProfileHeader.tsx`), hata kayıtları paneli (`ErrorLogViewer.tsx`) ve 429 panosundaki "Session ID Ayarla" butonları kaldırılacaktır.
3. **Yeni Buton ve Rehber**:
   - Yerine yeşil kalkan ikonuyla **🛡️ Hesap Güvenliği & Yöntemler** butonu eklenecektir.

#### B. 4 Güvenli Alternatif Yöntemin Öne Çıkarılması
Kullanıcının tercih ettiği 4 güvenli alternatif rehberde ve ana ekranda belirgin olarak sunulacaktır:
1. **Çerezsiz Güvenli Mobil & APK Modu (Varsayılan & %100 Güvenli)**:
   - Kullanıcının hiçbir Instagram hesabıyla bağlantısı yoktur.
   - Herkese açık Instagram web ve embed API'leri üzerinden anonim olarak profilleri ve gönderileri çeker. Hesabınızın etkilenme riski sıfırdır.
2. **Doğrudan Gönderi / Reels Bağlantısı (Link ile İndirme)**:
   - Instagram uygulamasında veya tarayıcıda görülen herhangi bir gönderinin ("Bağlantıyı Kopyala") linki yapıştırılarak tek tıkla albüm/video olarak çekilir.
3. **Chrome Eklentisi / Yerel JSON Aktarımı**:
   - Kullanıcı kendi ev bilgisayarındaki tarayıcıdan tek tıkla profil gönderilerini JSON olarak dışa aktarır ve bu uygulamaya yükler. İstekler kullanıcının kendi IP'sinden yapıldığı için Instagram hiçbir şüphe duymaz.
4. **Resmi Meta Instagram OAuth 2.0 (Resmi Graph API)**:
   - Meta Developer Portal üzerinden oluşturulacak yasal istemci kimliği (Client ID & Secret) ile güvenli ve onaylı entegrasyon.

#### C. Profil İstatistikleri Zenginleştirme Düzeltmesi (`server.ts`)
- Kamuya açık embed sayfalarındaki (`https://www.instagram.com/:username/embed/`) ters eğik çizgi ile kaçırılmış (`\"edge_followed_by\":{\"count\":3313210}`) JSON verisini okuyan regex düzeltilerek:
  - Toplam gönderi sayısı (örn. 52.883)
  - Takipçi sayısı (örn. 3,3 Mn)
  - Onaylı hesap rozeti (Mavi Tik)
  tüm hesaplar için dinamik ve genel olarak doldurulacaktır.

---

### 3. Kullanıcı Deneyimi ve Arayüz Akışı

1. Kullanıcı arayüzde artık şüpheli çerez girişine zorlanmaz veya yönlendirilmez.
2. Üst menüde ve profil kartında **🛡️ Hesap Güvenliği** rozeti yer alır.
3. Tıklandığında açılan rehber penceresinde 4 güvenli yöntem kartlar halinde listelenir ve tek tıkla istenen alternatif (Linkle İndirme, Eklenti JSON Yükleme veya Çerezsiz Canlı Yenileme) başlatılabilir.
4. `@trthaber` ve tüm diğer profillerde gerçek gönderi sayısı (52.883+) ve takipçi sayısı (3,3 Mn) eksiksiz görüntülenir.

---

### 4. Doğrulama ve Test Adımları
- `server.ts` ve frontend bileşenleri derlenecek (`compile_applet` & `lint_applet`).
- Yerel depolamadaki eski session ID'nin temizlendiği ve hiçbir isteğe `x-ig-session-id` başlığı eklenmediği test edilecek.
- `@trthaber` profili sorgulanarak 52.883 gönderi ve 3,3 Mn takipçinin çerezsiz ve güvenli biçimde geldiği teyit edilecek.

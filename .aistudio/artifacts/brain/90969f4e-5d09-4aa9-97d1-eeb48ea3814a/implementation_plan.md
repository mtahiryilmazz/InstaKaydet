# Kişisel Verisiz Açık Profil ve Canlı İstatistik Entegrasyon Planı

Kullanıcının *"kişisel hiçbir veriyi toplama, kullanıcı hesabı bilgilerini de alma, zaten aradığım tüm profiller herkese açık"* talebi ve anket yanıtları doğrultusunda; tüm oturum/çerez istemleri ve kişisel veri alanları kaldırılacak, yerine **%100 anonim, şifresiz, herkese açık profil tarayıcısı** ve **canlı profil istatistik motoru** entegre edilecektir.

---

## 1. Mimari ve Temel Değişiklikler

### A. Kişisel Veri & Oturum (Session ID) Temizliği
- **Kişisel Veri ve Çerez İstemlerinin Tamamen Kaldırılması**:
  - `src/App.tsx`, `UserProfileHeader.tsx` ve bileşenlerdeki Session ID giriş kutuları, çerez doğrulama pencereleri ve yerel depolama (`instaflow_session_id`) tamamen devre dışı bırakılacak.
  - Varsa oturum istemi içeren uyarı kutuları kaldırılacak; yerine **"Herkese Açık Profil Modu: Sıfır Kişisel Veri, Tam Gizlilik"** prensibi benimsenecek.
  - Kullanıcıdan hiçbir hesap şifresi, çerez veya kişisel bilgi talep edilmeyecek; tüm işlemler Instagram'ın herkese açık uç noktaları üzerinden anonim olarak yürütülecek.

### B. Canlı Profil İstatistikleri (Takipçi, Takip, Toplam Gönderi)
- **Dinamik ve Genel Veri Zenginleştirme (`enrichUniversalProfileStats`)**:
  - Hesaplara özel sabit kodlama yapılmaksızın; `@kozanbel` (1.531 gönderi, 12,2 B takipçi, 28 takip), `@trthaber` (52.844 gönderi, 3,3 Mn takipçi, 3 takip) ve diğer tüm açık hesapların anlık canlı sayıları tespit edilecek.
  - Instagram'ın bulut IP kısıtlamalarına takılmayan arama motoru OpenGraph/Snippet okuyucusu üzerinden `Followers`, `Following`, `Posts` ve biyografi bilgisi parse edilerek profile eklenecek.
  - Profil başlığında `12 gönderi · 0 takipçi` hatası yerine gerçek rakamlar (örn. `1.531 gönderi · 12,2 B takipçi · 28 takip`) gösterilecek.

### C. Çoklu Sayfa ve Kesintisiz Gönderi Akışı (12 Gönderi Sınırını Aşma)
- **İlk Yüklemede Zenginleştirilmiş Ön Yükleme**:
  - Kullanıcı profili ilk açtığında yalnızca ilk 12 gönderiyle sınırlı kalmayacak; arka planda 2. sayfa otomatik birleştirilerek anında 24 gönderi sunulacak.
- **Şifresiz Sayfa Yükleme & Derin Tarama**:
  - Sayfa sonundaki **`[Sonraki Gönderileri Yükle (+12)]`** butonu ve **`[Tüm Gönderileri Otomatik Tara]`** derin tarama motoru oturumsuz/şifresiz olarak sonraki `max_id` sayfalarını çekecek.
  - Gönderi listesi altında anlık durum sayacı:
    `Şu anda {posts.length} / {profile.postsCount.toLocaleString('tr-TR')} gönderi yüklü`
    olarak net biçimde gösterilecek.

---

## 2. Kullanıcı Arayüzü & Görsel Düzenlemeler (Tasarım Standartları)

1. **Profil Başlığı (`UserProfileHeader.tsx`)**:
   - Statik etiketlerde pill/rozet kirliliği olmadan, şık tipografik ayraçlarla (`·`) unboxed metin hiyerarşisi:
     `1.531 gönderi · 12,2 B takipçi · 28 takip · 24 yüklü`
   - Biyografi ve doğrulanmış rozetleri tam ve temiz görünecek.
2. **Hesap Güvenliği & Gizlilik Bilgilendirmesi**:
   - Eski Session ID ekleme çağrıları kaldırılarak yerine:
     *🛡️ Herkese Açık & Güvenli Mod: Hesabınıza veya kişisel verilerinize asla erişilmez.*
     bilgisi yer alacak.
3. **Akıcı Sayfalama Kontrolleri**:
   - Tek tıkla sonraki sayfaları çekme veya hesaptaki yüzlerce gönderiyi duraklatılabilir derin taramayla hafızaya alma özellikleri belirgin olacak.

---

## 3. Doğrulama ve Test Adımları

1. **`kozanbel` Hesabı Testi**:
   - Profil detaylarının (1.531 gönderi, 12,2 B takipçi, 28 takip) canlı olarak doğrulanması.
   - İlk açılışta 12 yerine doğrudan 24 gönderinin listelenmesi.
   - "Sonraki Gönderileri Yükle" butonuna tıklandığında sonraki sayfaların hatasız eklenmesi.
2. **`trthaber` Hesabı Testi**:
   - Toplam gönderi ve takipçi sayısının doğru yansıması.
3. **Gizlilik Testi**:
   - Arayüzde hiçbir oturum/şifre kutusu veya kişisel veri kaydedici bulunmadığının teyidi.
4. **Derleme Kontrolü**:
   - `compile_applet` ve `lint_applet` ile sıfır hata doğrulaması.

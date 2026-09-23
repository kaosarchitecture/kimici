# Güvenlik ve Uyum

## 1. Tehdit modeli

| Tehdit | Etki | Önlem |
|---|---|---|
| Merkez ele geçirilir | Sahaya kötü niyetli kural gönderilir | Kural paketi imzası ve özel anahtar ayrı secret olarak tutulur. Merkezden kod veya SQL gönderilemez. Yeni paketler önce gölge modda çalışır. Yazmayı durdurma komutu yerel kullanıcıya da verilir |
| Ajan cihazı çalınır | Yerel öğrenme deposu okunur | SQLite şifreli, anahtar Windows DPAPI (makine kapsamı) ile korunur. Merkezden ajan iptali (`revoked`) yapılabilir |
| Ağ dinlenir | Telemetri okunur | Yalnızca TLS üzerinden WSS. Telemetride içerik yok |
| Sahte ajan kaydı | Kiracıya yabancı cihaz bağlanır | Tek kullanımlık, 15 dakika geçerli ve hash'lenmiş kayıt kodu. Cihaz anahtar çifti ve kısa ömürlü belirteç |
| Yanlış kural ETA'yı bozar | Hatalı yevmiye kaydı | Önemlilik kapısı, borç/alacak doğrulaması, tek transaction, geri alma kaydı, otomatik yazma için açık yerel izin |
| Gizlilik filtresi atlanır | Muhasebe verisi merkeze sızar | Mesaj şeması izin listesi, yasaklı alan birim testleri, merkezde de şema doğrulama. Bilinmeyen alan içeren mesaj reddedilir |
| Denetim izi değiştirilir | Geriye dönük inkâr | Hash zinciri, append-only trigger, günlük zincir başı merkezde |

## 2. Kimlik ve yetki

- Merkez yönetim paneli: operatör hesapları, MFA zorunlu. Kimlik sağlayıcı seçimi
  onaya bağlı (Cloudflare Access ya da ayrı bir IdP).
- Ajan: cihaz anahtar çifti ile kayıt, kısa ömürlü erişim belirteci, periyodik yenileme.
- ETA SQL erişimi iki ayrı kullanıcıyla yapılır:
  - `eta_reader`: yalnızca `SELECT`, öğrenme ve izleme için.
  - `eta_writer`: yalnızca yazma stratejisi B seçilirse, yalnızca gereken tablolarda.
  Bu kullanıcıları müşterinin sistem yöneticisi oluşturur. Ajan `sa` ile çalışmaz.

## 3. Secret yönetimi

- Kod ve git deposunda hiçbir secret bulunmaz. Örnek değişken adları `.env.example`
  dosyasındadır.
- Merkez: Cloudflare secrets (`wrangler secret put`). Paket imzalama özel anahtarı yalnız
  imzalama yapan Worker'a bağlanır.
- Ajan: ETA SQL parolaları Windows Credential Manager / DPAPI ile saklanır, yapılandırma
  dosyasına düz metin olarak yazılmaz.

## 4. KVKK ve mevzuat notları

Bu notlar hukuki görüş değildir. Hukuk danışmanıyla teyit edilmelidir.

- Muhasebe verisi (cari adı, TCKN, adres) kişisel veri içerir. Verinin müşteri
  bilgisayarından çıkmaması, veri sorumlusu ve işleyen rollerini sadeleştirir. Yine de
  telemetri ve destek süreçleri için aydınlatma metni ve sözleşme gerekir.
- Yurt dışı aktarım: Cloudflare kullanılırsa merkeze yalnızca kişisel veri içermeyen
  telemetri gider. Bu varsayım gizlilik filtresi testleriyle sürekli doğrulanmalıdır.
- Defter ve belge saklama süreleri denetim izi saklama süresini belirler (bkz. `volume.md`).
- ETA'ya doğrudan SQL ile yazmanın ETA lisans ve destek şartlarına uygunluğu ETA veya
  yetkili bayi ile yazılı olarak teyit edilmelidir.

## 5. Geri alınamaz işlemler

Aşağıdakiler her zaman açık onay ister ve otomatik yapılmaz:

- Müşteri ETA veritabanına ilk yazma yetkisinin açılması
- Bir kuralın `OtomatikYazma` durumuna alınması
- Ajan iptali ve yerel verinin silinmesi
- Merkez D1 production migration'ı (önce staging)

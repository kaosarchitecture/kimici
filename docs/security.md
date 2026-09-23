# Güvenlik ve Uyum

## 1. Yön: makine bize gelir, biz makineye gitmeyiz

DENK sunucusu müşteri ağına, ofis SQL'ine veya herhangi bir masaüstüne **bağlanmaz**.
Ajan (kullanıcının kendi kurduğu program) **bizim** kontrol düzlemine WSS ile bağlanır.
Kayıt kodu olmayan bağlantı kabul edilmez. Merkezden sahaya keyfi kod, SQL veya kabuk
komutu gönderilmez.

Arşivdeki eski otomasyon notları yalnızca ETA fiş mantığını anlatır. Oradaki hesap adları
ve parolalar DENK ürününün parçası değildir ve bu depoda yoktur.

## 2. Tehdit modeli

| Tehdit | Etki | Önlem |
|---|---|---|
| Merkez ele geçirilir | Sahaya kötü niyetli kural gönderilir | Kural paketi imzası. Merkezden kod veya SQL gönderilemez. Yeni paketler önce gölge modda çalışır |
| Sahte ajan kaydı | Kiracıya yabancı cihaz bağlanır | Tek kullanımlık kayıt kodu, cihaz anahtar çifti, kısa ömürlü belirteç |
| Ağ dinlenir | Telemetri okunur | Yalnızca TLS üzerinden WSS. Telemetride içerik yok |
| Yanlış kural yerel defteri bozar | Hatalı yevmiye (yalnızca kullanıcı yazmayı açtıysa) | Plan onayı, borç/alacak, tek transaction, geri alma |
| Gizlilik filtresi atlanır | Muhasebe verisi merkeze sızar | Mesaj şeması izin listesi, bilinmeyen alan reddi |
| Denetim izi değiştirilir | Geriye dönük inkâr | Hash zinciri, append-only, günlük zincir başı |

## 3. Kimlik

- Merkez paneli: operatör hesapları, MFA. Kimlik sağlayıcı onaya bağlı.
- Ajan: cihaz anahtarı + kayıt kodu. Kullanıcı kendi makinesinden bize bağlanır.
- Windows onayı: ajan yerelde etkileşimli oturumu okur (`DOMAIN\kullanıcı` + SID).
  Parola, NTLM özeti ve `sa` sunucuya gelmez. Onaylanan alanlar kısa ömürlü görünümdür.
- Yerel ETA: isteğe bağlı. Kullanıcı kendi makinesinde kendi bağlantısını yazarsa çalışır.
  DENK bir SQL kullanıcısı açmaz, ofis hesabı istemez, `sa` / ortak uygulama hesabı kullanmaz.

## 4. Secret yönetimi

- Kod ve git deposunda secret yoktur. Örnek adlar yalnız `.env.example` içindedir.
- Merkez: Cloudflare secrets. Paket imza anahtarı yalnız imzalayan Worker'dadır.
- Kullanıcının kendi makinesinde tuttuğu yerel bilgiler merkeze gönderilmez.

## 5. KVKK notları

Bu notlar hukuki görüş değildir.

- Varsayılan: muhasebe içeriği merkeze gelmez. Telemetri yalnız sayaç ve kural kimliğidir.
- Windows onaylı görünüm: kullanıcı tiklediği alanları, süre bitene kadar web arayüzünde
  görmeyi kabul eder. Defter olarak saklanmaz.
- Aydınlatma metni ve sözleşme yine de gerekir.
- Cloudflare kullanılırsa merkeze kişisel veri gitmediği varsayımı, gizlilik filtresi
  testleriyle doğrulanmalıdır.

## 6. Geri alınamaz işlemler

Aşağıdakiler açık onay ister:

- Kullanıcının kendi makinesinde yerel yazmayı ilk kez açması
- Windows oturumuyla izinli görünüm açılması (her istekte yeniden)
- Bir kuralın `OtomatikYazma` durumuna alınması
- Ajan iptali ve yerel verinin silinmesi
- Merkez D1 production migration'ı (önce staging)

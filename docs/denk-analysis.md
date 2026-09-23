# DENK Materyal Analizi

Tarih: 2026-09-23. Kaynak: kullanıcının Google Drive'ındaki DENK arşivleri (kural seti,
doğru işlem audit/log paketleri, yapay zeka kılavuzu, FaturaCekme, DENKWEB arayüz yaması).

> Bu depo **herkese açıktır**. Bu dokümanda müşteri adı, VKN/TCKN, sunucu adı, kullanıcı
> adı, parola ve portal hesabı **bilerek yer almaz**. Şirketler "Şirket A", "Şirket B" diye
> anılır. Ham DENK dosyaları bu depoya hiçbir zaman eklenmemelidir.

## 1. Envanter

| Paket | İçerik | Değer |
|---|---|---|
| ETA SQL Kurallar ve Çözümler | 00-19 numaralı ofis kuralları, F09 banka denemeleri | Kural kaynağı. Çelişkiler var (bkz. 4. bölüm) |
| Doğru İşlemler Audit / Log | Onaylanan 1 alış faturası ve 1 banka çeyreği için log, audit raporu, PowerShell scriptleri, onay diyalogları | Altın örnek (golden case) kaynağı |
| Yapay zekaya kılavuz | Önceki asistanın özet tarifi (JS kod parçaları) | Faydalı ama kural setiyle çelişen yerleri var |
| FaturaCekme | Entegratör portallarından e-fatura indirme (Intecon HTTP akışı kanıtlı, eLogo tarayıcı ile) | Kaynak katmanı. ETA'ya yazmaz |
| DENKWEB UI yaması + notlar | Mevcut DENKWEB (Node.js) arayüz revizyonu ve bulgular | Mevcut uygulamanın durumu hakkında bilgi |
| DENKWEB tam arşiv (~85 MB) | Uygulama kaynağı | **İncelenemedi.** Drive aracının 10 MB indirme sınırını aşıyor |

## 2. Doğrulanmış ETA gerçekleri (canlı sistemden gelen kanıt)

Bunlar önceki tasarımdaki "doğrulanamadı" maddelerinin cevabıdır (ETA V.8 SQL):

| Konu | Gerçek |
|---|---|
| Master veritabanı | `ETA_MASTERV8`, şirket listesi `SIRKET` tablosu (`SIRKOD`, `SIRDONEM`, `SIRDBNAME`, `SIRPATH`, `SIRDBLOCATION`, `SIRCALFLAG`, `SIRVKNTCKN`) |
| Şirket veritabanı | `ETA_{SIRKOD}_{YIL}` |
| Muhasebe fişi | `MUHFIS` (başlık), `MUHHAR` (satır), `MUHFISIPTAL` / `MUHHARIPTAL` (iptal arşivi) |
| Mizan | `MUHMIZDEGER` (`MUHKOD`, `MUHYIL`, `MUHAY`, `MUHRAKTIP`, `MUHDOVKOD`, `MUHBORC`, `MUHALACAK`). SQL ile fiş yazıldıktan sonra yeniden hesaplanmazsa ETA bakiyeyi eski gösterir |
| Hesap planı | `MUHHESAP` (`MUHKOD`, `MUHADI1`, `MUHVERGIKIMLIKNO`, `MUHTCKIMLIKNO`) |
| Hesap kodu biçimi | Boşlukla ayrılmış seviyeler: `191 02 20`, `320 A=014`. Üst hesaplar boşluğa göre bulunur |
| Karakter seti | Tek baytlık Windows-1254 (CP1254). UTF-8 bayt yazılırsa ETA ekranında `Ä°`, `Åž` görünür |
| Görünürlük | `MUHFISISYKOD = 'MERKEZ'` boşsa fiş Muhasebe 4 listesinde görünmez |
| Borç/alacak | `MUHHARBATIPI`: 1 = borç, 2 = alacak |
| Fiş numarası | `MA-000000` biçimi, 6 hane |
| Bordro | `BORSICIL` (işe giriş), `PERSONEL` |
| E-fatura sabitleri | `SABITLER` modül 14 (GİB kullanıcı, şirket kodu, VKN, e-fatura klasör yolları) |
| Log | `SIRKETLOG` tablosu var |

## 3. Altın örnekler (onaylanmış işlemler)

### 3.1 Alış faturası: binek araç bakım/onarım (Şirket A)

Kullanıcı bu işlemi açıkça "genel fatura işleme mantığı olarak kaydet" diyerek standart ilan
etmiş. Script, log ve audit raporu **birbiriyle tutarlı**.

| Girdi | Değer |
|---|---|
| Matrah | 50.709,11 |
| KDV (%20) | 10.141,83 |
| Ödenecek (payable) | 60.850,94 |
| Cari | mevcut `320 …` |

| Sıra | Hesap | B/A | Tutar | Açıklama | Özel kod |
|---:|---|:---:|---:|---|---|
| 1 | `770 13` | B | 35.496,38 | tedarikçi adı | `INDKDV` |
| 2 | `689 01` | B | 18.255,28 | tedarikçi adı | `INDKDV` |
| 3 | `191 02 20` | B | 7.099,28 | `İND. KDV` | `INDKDV` |
| 4 | `320 …` | A | 60.850,94 | `N.FT İLE ALIŞ` | |
| 5 | `950 01` | B | 18.255,28 | `K.K.E.GİDERLER` | |
| 6 | `951 01` | A | 18.255,28 | `K.K.E.GİDERLER` | |

Toplam borç = toplam alacak = 79.106,22. Bu örnek `packages/eta-core` testlerinde kuruşu
kuruşuna yeniden üretilir.

**Yazma tekniği (asıl değerli bulgu):** Script fişi sıfırdan kurmuyor. Aynı şirketin daha
önceki sağlam bir fişini (başlık + ilk satır) şablon olarak okuyor, **tüm kolonları o
şablondan kopyalıyor** ve yalnızca anlamlı alanları değiştiriyor. Bu sayede ETA'nın
bilmediğimiz kolonları da o şirkette nasıl doluysa öyle doluyor.

### 3.2 Banka ekstresi: üç aylık dönem (Şirket B)

Log ve audit raporu: ayda **tek** DEK fişi, fiş tarihi (`MUHFISTAR`) ayın son günü,
satır tarihleri (`MUHHARTAR`, `MUHHAREVRAKTAR`) işlemin kendi tarih ve saati, kronolojik.
3 fiş, mizan her ay denk. Satırlara ayın son günü basılmaz.

**Kritik tutarsızlık:** Arşivde bu işlemin kodu diye saklanan script (iki klasörde aynı
dosya, md5 eşit) bunu **yapmıyor**. Kod hareketleri `tarih + işlem no` ile grupluyor, her
grup için **ayrı** bir DEK fişi açıyor ve fiş tarihini işlem günü yapıyor. Ayrıca her ekstre
satırı için iki fiş satırı yazıyor. Log ise "1.100 Excel satırı → 1.100 MUHHAR satırı"
diyor. Bu ikisi aynı anda doğru olamaz.

Sonuç: Banka altın örneği **canlı veritabanından doğrulanmadan** referans alınmamalı.
Doğrulama sorgusu (salt okunur): Şirket B veritabanında ilgili üç REF için `MUHFIS`
başlıkları ve `MUHHAR` satır sayıları.

## 4. Çelişkiler ve önerilen çözüm

Onayınız olmadan hiçbiri kesinleşmez. "Öneri" sütunu, onaylanmış işlemin yaptığı şeyi esas
alır.

| # | Konu | Kaynak 1 | Kaynak 2 | Öneri |
|---|---|---|---|---|
| Ç1 | Bankada eşleşmeyen satır | `100 01` (kural 02, 14, 15 ve banka scripti) | `331 01` ortaklar cari (yapay zeka kılavuzundaki JS) | `100 01`. `331 01` yalnızca şirkete özel eşleme kuralıyla |
| Ç2 | Sıradaki REF | `max(MUHFIS, MUHFISIPTAL) + 1` (kural 02) | `max(MUHFIS, MUHHAR) + 1` (fatura scripti), `max(MUHFIS) + 1` (kural 19) | Üçünün en büyüğü + 1 |
| Ç3 | Sıradaki fiş no | en büyük sayı, canlı + iptal (banka scripti) | son REF'teki numara + 1 (fatura scripti) | Canlı ve iptalde en büyük `MA-` sayısı + 1 |
| Ç4 | KDV satır açıklaması | `İND. KDV` (onaylanan fatura) | `İND.KDV.` (kural 13, 16) | Onaylanan: `İND. KDV`. Şirket geçmişinde hangisi kullanılıyorsa o |
| Ç5 | Türkçe karakter yazımı | `NVarChar` parametre (kural 01) | CP1254 bayt + `CAST(... AS varchar)` (kural 19, onaylanan) | CP1254 bayt, yazım sonrası hex kontrolü |
| Ç6 | KKEG oranı | Binek bakım: matrah %70 gider, KDV %70, genel toplam %30 KKEG (kural 19) | Akaryakıt: ~%34 KKEG / %66 kabul, KDV yalnız kabul kısmından (kural 16) | İki ayrı kural. Akaryakıt oranının kesin tanımı sizden gelmeli |
| Ç7 | Tevkifat satırları | `151` + `191 02 xx` + `192 01` + `360 09` (kural 13) | `153 08` + `191 02 20` + `360 07`, `192` yok (kural 16) | Şirket geçmişinden öğrenilmeli; kesin kalıp onayı gerekli |
| Ç8 | Banka fiş gruplaması | Ayda tek fiş, başlık ayın son günü (kural 18, onaylanan log) | Önceki ay stili "çok sayıda küçük DEK" (kural 14, aynı şirket) ve arşivdeki script | Şirket bazında geçmişten öğrenilir, ön kontrolde (preflight) kullanıcıya gösterilir |
| Ç9 | Başlık kontrol/onay kodu | `MUHFISKONTKOD = '01'`, `MUHFISONAYKOD = '01'` zorunlu (kural 08, 19) | Banka scriptinde boş yazılmış | Sabit kodlanmaz. Şirketin aynı fiş tipindeki son fişlerinden şablon alınır |
| Ç10 | Mizan yeniden hesaplama | Scriptler ayın **tüm** `MUHMIZDEGER` satırlarını siliyor | Yalnızca `MUHRAKTIP = 1`, döviz boş satırlarını geri yazıyor | Otomasyona almadan önce canlı veritabanında başka `MUHRAKTIP` / döviz satırı var mı bakılmalı; varsa veri kaybı riski |

## 5. Önceki başarısızlıkların ortak nedeni

Arşivin elediği hatalı işlemler (çift fiş, 30.000 TL üstünün kasaya kapatılması, tüm
satırlara aynı tarih, geri yükleme kazası, 100 kat tutar hatası, ön kontrolsüz 100 01
yığını) incelendiğinde ortak nokta şu: **yapay zeka yazma anında doğaçlama yapmış.**
Başarılı iki işlemde ise deterministik bir script, sabit kurallar, tek transaction, yazma
sonrası denetim ve kullanıcı onayı var.

Bu yüzden rafine yöntemin ilkesi şudur: **Yapay zeka SQL yazmaz, plan önerir. Yazmayı
yalnızca test edilmiş deterministik çekirdek yapar.** Ayrıntı: `docs/method.md`.

## 6. Güvenlik bulguları (acil)

| Bulgu | Risk | Öneri |
|---|---|---|
| Ortak ETA uygulama kullanıcısının parolası ~10 script dosyasında düz metin, Drive arşivlerinde | Arşive erişen herkes tüm şirket veritabanlarına erişir | Scriptlerden parolayı çıkarın, arşiv paylaşımını daraltın. Kural 01 bu parolanın değiştirilmesini yasaklıyor (tüm ofis bilgisayarları kopar). Bu yüzden önerim: DENK için **ayrı, dar yetkili** bir SQL kullanıcısı açmak |
| Bu kullanıcı `sysadmin` yetkisinde | Bir hata tüm şirketleri, yedekleri ve sunucuyu etkiler | DENK kullanıcısı yalnızca gereken tablolarda okuma/yazma |
| FaturaCekme içinde portal kimlik dosyaları | Portal hesapları ele geçirilir | Windows Credential Manager veya ortam değişkeni, dosyada değil |
| DENKWEB girişi sunucuda doğrulama yapmıyor, yönetici PIN'i varsayılan, ayar cevabı yapılandırmayı döndürüyor (DENKWEB kendi notlarından) | İnternete açılırsa muhasebe verisine yetkisiz erişim | Açık internete yayımlanmamalı. Yeni katmanda kimlik doğrulama baştan tasarlanır |
| `SABITLER` konu 39'da GİB portal şifresi saklanıyor (ETA'nın kendi tasarımı) | Şirket klonlarken başka mükellefe taşınır (kural 17 vakaları) | Yeni şirket açılış denetiminde bu alan kontrol edilir; DENK bu alanı hiçbir zaman okumaz ve loglamaz |

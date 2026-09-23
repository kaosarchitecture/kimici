# Yol Haritası

Fazlar bağımlılık sırasına göre dizildi. Her faz bir önceki fazın çıktısına dayanır.

```mermaid
flowchart LR
    F0["Faz 0<br/>ETA keşfi"] --> F1["Faz 1<br/>Salt okunur ajan<br/>+ merkez iskeleti"]
    F1 --> F2["Faz 2<br/>Öğrenme + gölge mod"]
    F2 --> F3["Faz 3<br/>Onaylı yazma"]
    F3 --> F4["Faz 4<br/>Otomatik yazma<br/>+ federe öğrenme"]
```

## Faz 0: ETA keşfi (kısmen tamam)

DENK ofis arşivinden tablo adları, kolonlar, CP1254, REF/`MA-` üretimi ve onaylı iki işlem
doğrulandı (`docs/denk-analysis.md`). `packages/eta-core` bu kanıta göre yazıldı.

Kalan keşif (arşiv + kullanıcının kendi makinesinde, isterse, doğruladığı şeyler;
DENK bir ofis SQL'ine bağlanmaz):

- Banka altın örneğinin fiş gruplaması (script ile log çelişiyor).
- `MUHMIZDEGER` döviz / `MUHRAKTIP` çeşitleri.
- `volume.md` disk ve hız tahminleri (kullanıcı kendi makinesinde ölçerse).
- ETA/bayi yazılı teyidi (doğrudan SQL yazımı; kullanıcı bu yolu açarsa).

## Faz 1: Salt okunur ajan ve merkez iskeleti

- Merkez: API Worker, TenantHub Durable Object, D1 migration'ları (staging), ajan kaydı,
  Türkçe yönetim paneli iskeleti.
- Ajan: Windows servisi, enrollment, **bizim sunucuya** WSS, gizlilik filtresi, telemetri.
  Yerel ETA (şema keşfi / geçmiş / artımlı okuma) yalnız kullanıcı kendi makinesinde
  açarsa.
- `packages/protocol` şemaları.

Kabul ölçütü: herhangi bir makinedeki ajan merkeze bağlanır, yalnız sayaç gönderir.
Gizlilik filtresi testleri yasaklı alanların hiçbirinin çıkmadığını kanıtlar. Yerel ETA
zorunlu değildir.

## Faz 2: Öğrenme ve gölge mod

- Merkez: kural editörü, örnek fiş seti, simülasyon, paket imzalama ve yayınlama.
- Ajan: `gecmis.profil`, `fatura.planla` / `banka.planla` (eta-core), gölge mod
  karşılaştırması, yerel onay arayüzünde plan önizlemesi.

Kabul ölçütü: gölge modda, kullanıcıların gerçekte girdiği fişlerle karşılaştırılan
isabet oranı kural bazında raporlanır.

## Faz 3: Onaylı yazma

- `fis.yaz` (şablon klon + CP1254 + mizan), önemlilik kapısı, öneri kuyruğu, geri alma.
- Hash zincirli denetim izi ve günlük zincir başı gönderimi.
- ETA'daki düzeltme ve iptallerden geri bildirim döngüsü.

Kabul ölçütü: onaylanan fişler ETA'da borç/alacak dengeli oluşur, geri alma çalışır,
düzeltmeler kural güvenini düşürür.

## Faz 4: Otomatik yazma ve federe öğrenme

- Kullanıcı izniyle otomatik yazma, düzeltme oranı artınca otomatik düşürme.
- İsteğe bağlı: Flower ile müşteriler arasında veri paylaşmadan model ağırlığı birleştirme.
  Yalnızca açık izin veren kiracılar katılır.
- İsteğe bağlı: belirsiz sınıflandırma için yerel LLM (Ollama).

## Onay bekleyen kararlar

1. Merkez nerede çalışacak: Cloudflare (önerilen) veya sizin bilgisayarınız + Cloudflare Tunnel.
2. Desteklenecek ETA sürümleri: ETA:SQL, V.8-SQL, V.11-SQL, hepsi mi?
3. ETA'ya yazma yolu: ofis pratiği doğrudan SQL; ETA/bayi teyidi hâlâ gerekli.
4. Ajan herhangi bir makinede çalışır; bağlanan taraf her zaman ajan → bizim sunucu.
   Yerel ETA yalnız kullanıcı isterse. (Karar: bu model.)
5. Operatör kimlik doğrulaması: Cloudflare Access mi, ayrı IdP mi?
6. Banka fiş gruplaması ve mizan tipleri: kullanıcı kendi makinesinde doğrulamak isterse
   bakar. DENK için SQL kullanıcısı açılmaz; ofis hesabı istenmez.
7. Ajan çalışma zamanı: Node.js (önerilen, `eta-core` ile aynı) mı, .NET mi?
8. Yapay zeka nerede çalışacak: bulut model mi, kullanıcının kendi makinesinde yerel model mi?

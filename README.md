# ETA Saha Öğrenme Platformu (tasarım aşaması)

Muhasebe kurallarını operatörün verdiği örneklerden ve müşterinin ETA programındaki geçmiş
davranışlarından (fiş, log, audit) öğrenen, bu kuralları **müşteri verisini merkeze
taşımadan** müşterinin kendi bilgisayarında uygulayan SaaS.

Bu depo şu an yalnızca tasarım dokümanlarını içerir. Kod, kararlar onaylandıktan sonra
`docs/architecture.md` içindeki iskelete göre yazılacak.

## Özet

- **Hazır repo yok.** Bu kombinasyonu yapan olgun bir açık kaynak proje bulunamadı. En yakın
  aday AGPL lisanslı ve çok genç. Ayrıntılar: [docs/research.md](docs/research.md).
- **Mimari:** İnce bir merkez (Cloudflare Workers + Durable Objects + D1 + R2) ve müşteri
  makinesinde çalışan bir .NET Windows servisi (saha ajanı). Öğrenme, karar ve ETA'ya yazma
  sahada yapılır. Merkeze yalnızca içeriksiz sayaçlar gider.
- **Hacim:** Merkez yükü fiş sayısıyla değil, ajan sayısıyla büyür. 10.000 ajanda bile
  merkezde darboğaz yok. Asıl kapasite riski büyük bürolarda yerel disk ve geçmiş yükleme
  süresi.

## Dokümanlar

| Doküman | İçerik |
|---|---|
| [docs/research.md](docs/research.md) | Açık kaynak aday değerlendirmesi, ETA hakkında doğrulanan ve doğrulanamayan bilgiler |
| [docs/architecture.md](docs/architecture.md) | Bileşenler, veri egemenliği sınırı, öğrenme hattı, kural yaşam döngüsü, sıra diyagramları, depo iskeleti |
| [docs/volume.md](docs/volume.md) | İşlem hacmi modeli: saha profilleri, geçmiş yükleme, otomasyon hunisi, merkez ölçek senaryoları, platform sınırları |
| [docs/protocol-and-data.md](docs/protocol-and-data.md) | Kural formatı, imzalı paket, ajan ↔ merkez mesajları, telemetri izin listesi, D1 ve yerel SQLite şemaları |
| [docs/security.md](docs/security.md) | Tehdit modeli, kimlik, secret yönetimi, KVKK notları, geri alınamaz işlemler |
| [docs/roadmap.md](docs/roadmap.md) | Fazlar, kabul ölçütleri, onay bekleyen kararlar |

Diyagramlar Mermaid formatındadır ve GitHub üzerinde doğrudan görüntülenir.

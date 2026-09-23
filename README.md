# DENK — ETA saha öğrenme platformu

Muhasebe kurallarını operatörün verdiği örneklerden ve müşterinin ETA programındaki geçmiş
davranışlarından öğrenen, bu kuralları **müşteri verisini merkeze taşımadan** müşterinin
kendi bilgisayarında uygulayan SaaS.

## Durum

- Tasarım dokümanları hazır.
- DENK ofis arşivi incelendi; onaylı alış faturası ve banka işleminden yöntem çıkarıldı.
- İlk kod: `packages/eta-core` — veritabanı bağlantısı olmayan, test edilmiş kural çekirdeği.

```bash
cd packages/eta-core && npm install && npm test
```

## Özet

- **Hazır repo yok.** Bu kombinasyonu yapan olgun bir açık kaynak proje bulunamadı.
- **Yöntem:** Yapay zeka SQL yazmaz. Plan önerir; yazmayı yalnız `eta-core` yapar.
  Ayrıntı: [docs/method.md](docs/method.md).
- **Mimari:** İnce merkez (Cloudflare Workers + Durable Objects + D1 + R2) ve kullanıcının
  kendi makinesindeki saha ajanı. Ajan **bizim sunucuya** bağlanır; biz makineye gitmeyiz.
  Öğrenme ve (kullanıcı açarsa) yerel ETA yazımı sahada. Merkeze yalnız sayaç gider.
- **Ajan çalışma zamanı (öneri):** Node.js / TypeScript. DENKWEB ve `eta-core` ile aynı
  dil. Karar onayınıza bağlı.

## Dokümanlar

| Doküman | İçerik |
|---|---|
| [docs/method.md](docs/method.md) | Rafine yöntem: yetenek kataloğu, plan → onay → yaz → denetle |
| [docs/denk-analysis.md](docs/denk-analysis.md) | DENK arşivi: doğrulanan ETA tabloları, çelişkiler, güvenlik |
| [docs/research.md](docs/research.md) | Açık kaynak aday değerlendirmesi |
| [docs/architecture.md](docs/architecture.md) | Bileşenler, veri sınırı, öğrenme hattı, sıra diyagramları |
| [docs/volume.md](docs/volume.md) | İşlem hacmi modeli |
| [docs/protocol-and-data.md](docs/protocol-and-data.md) | Kural formatı, mesaj sözleşmesi, şemalar |
| [docs/security.md](docs/security.md) | Tehdit modeli, secret, KVKK notları |
| [docs/roadmap.md](docs/roadmap.md) | Fazlar ve onay bekleyen kararlar |

Bu depo herkese açıktır. Müşteri adı, VKN, parola veya portal hesabı burada yer almaz.

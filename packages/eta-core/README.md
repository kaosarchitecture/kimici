# `@denk/eta-core`

ETA V.8 SQL için deterministik muhasebe çekirdeği. Veritabanına bağlanmaz, SQL üretmez,
yapay zeka çağırmaz. Tutarlar kuruş cinsinden tam sayıdır.

## Ne yapar

- Alış faturası planı (Kural 13 kapanış, Kural 16 binek oto, Kural 18/19 tarih ve görünürlük)
- Banka ekstresi planı (Kural 02 DEK, Kural 15 cari eşleme, ayda tek fiş)
- Yazmadan önce değişmez kurallar (`validatePlan`)
- Önceki fiş şablonunu klonlayıp yalnızca plan alanlarını üzerine yazma (`buildVoucher`)
- Windows-1254 kodlama, Türkçe tutar ayrıştırma, REF / `MA-` fiş no, mizan rollup

## Çalıştırma

```bash
cd packages/eta-core
npm install
npm test
npx tsc --noEmit
```

Yapay zeka bu paketi çağırır; SQL yazmaz. Yöntem: [docs/method.md](../../docs/method.md).

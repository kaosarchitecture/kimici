# DENK çalışma alanı

Sıfırdan yazılmış Türkçe operatör arayüzü. DENKWEB değildir; onun ekranları kopyalanmadı.

- `/#/` Çalışma: AI izin ister, izinli fiş tablosu burada görünür.
- `/#/onay` Windows onay yüzeyi (canlıda ajanın yerelde açtığı pencere).
- `/#/ajan` Bağlantı yönü. SQL / parola formu yok.

```bash
npm install && npm run build
```

API ile birlikte: `packages/consent-view` içinde `npm run demo` → http://127.0.0.1:8788

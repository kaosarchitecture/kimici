# DENK ajanı (Windows saha)

SaaS yönü: **iş bu makinede**, bilgi bizim sunucudan.

```
Windows (müşteri)
  DENK ajanı  ← GET /api/knowledge  ←  denk-app (ince merkez)
  evrak + ETA burada okunur / işlenir
```

Onlarca kullanıcı bağlanınca fiş bizim Worker’da kuyruğa girmez. Her PC kendi işini yapar. Merkez yalnız kural paketi verir (İND.KDV., 100 01, eşikler). Müşteri defteri merkeze gelmez.

```bash
export DENK_HUB_URL=https://denk-app.<hesap>.workers.dev
npm run process -- evrak.xml
```

Grok çağrısı varsa o da **bu** Windows’taki `C:\DENK\secrets\xai.env` ile yapılır; bizim sunucu kotası paylaşılmaz.

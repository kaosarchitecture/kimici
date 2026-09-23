# denk-app (Cloudflare Worker)

Evrak yükleme + Workers AI + fiş yazdır. **denk-central** ve **denkmuhasebe.com** değildir.

## AI nerede, nasıl bağlanır?

Tarayıcı modele gitmez. Akış:

1. Kullanıcı evrakı `POST /api/evrak` ile **denk-app** Worker’a yükler.
2. Kullanıcı yazınca tarayıcı `POST /api/ai` çağırır (metin + evrak özeti).
3. Worker `env.AI.run("@cf/meta/llama-3.1-8b-instruct")` ile **Cloudflare Workers AI** çalıştırır.
4. Cevap aynı Worker’dan UI’ye döner.

Müşteri Windows’una, ETA SQL’ine veya `denk-central`’a bağlanılmaz. API anahtarı koda yazılmaz; binding `wrangler.jsonc` içinde `ai.binding = "AI"`.

```bash
cd ../admin-ui && npm run build
cd ../denk-app && npx wrangler deploy
```

Yalnız `denk-app.<hesap>.workers.dev`. Ana site route’u eklenmez.

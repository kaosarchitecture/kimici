# denk-app (Cloudflare Worker)

Evrak yükleme + Grok 4.5 + fiş yazdır. **denk-central** ve **denkmuhasebe.com** değildir.

## Model

Windows DENK sunucusunda `C:\DENK\secrets\xai.env` okunur. Bu anahtarın canlı kataloğunda çalışan sohbet modeli: **`grok-4.20-0309-reasoning`**. Anahtar koda ve git’e yazılmaz.

```
Tarayıcı → POST /api/ai → denk-app
  1) xai.env / XAI_API_KEY → https://api.x.ai/v1/chat/completions
  2) yoksa → env.AI.run("xai/<seçilen-model>")
```

```bash
cd ../admin-ui && npm run build
cd ../denk-app && npx wrangler deploy
```

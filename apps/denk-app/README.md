# denk-app (Cloudflare Worker)

Evrak yükleme + Grok 4.5 + fiş yazdır. **denk-central** ve **denkmuhasebe.com** değildir.

## Model

**Grok 4.5** (`grok-4.5` / Cloudflare id `xai/grok-4.5`). Llama bağlı değil.

```
Tarayıcı → POST /api/ai → denk-app
  1) XAI_API_KEY varsa → https://api.x.ai/v1/chat/completions  model=grok-4.5
  2) yoksa → env.AI.run("xai/grok-4.5", …, { gateway: { id: "default" } })
```

Anahtar koda yazılmaz: `npx wrangler secret put XAI_API_KEY`. Müşteri makinesine gidilmez.

```bash
cd ../admin-ui && npm run build
cd ../denk-app && npx wrangler deploy
```

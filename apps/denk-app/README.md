# denk-app (Cloudflare Worker)

Yeni evrak + fiş yazdır uygulaması. **denk-central** ve **denkmuhasebe.com** değildir.

- `workers_dev: true` — yalnızca `denk-app.<hesap>.workers.dev`
- Ana siteye, `C:\DENK\data` klasörüne ve Windows görevlerine bağlanmaz
- `app.denkmuhasebe.com` route’u buraya yazılmaz

```bash
cd ../admin-ui && npm run build
cd ../denk-app && npx wrangler deploy
```

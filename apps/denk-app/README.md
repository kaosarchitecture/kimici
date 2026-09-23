# denk-app (ince merkez)

Müşteri defteri burada işlenmez. Bağlanan bilgisayar `GET /api/knowledge` ile kural paketini alır ve kendi log, audit veya XML dosyasını kendi üstünde işler.

`POST /api/ai` ve `POST /api/evrak` evrak kabul etmez.

```bash
cd ../admin-ui && npm run build
cd ../denk-app && npm install && npm run dev
```

Yerel adres: `http://127.0.0.1:8788`

## Canlı

xAI anahtarı bağlanan Windows bilgisayarında `C:\DENK\secrets\xai.env` içindedir. Cloudflare'e konmaz. `denk@kaosarc.com` ile `wrangler login` yap, sonra deploy et.

```bash
npx wrangler login
cd apps/admin-ui && npm run build
cd ../denk-app && npx wrangler deploy
```

`denk-central` ve `denkmuhasebe.com` bu komutun hedefi değildir. Yayın `app.denkmuhasebe.com` içindir. İlk üretim kaydı olduğu için geri alma: `npx wrangler rollback` veya Worker `denk-app` silinir. Durable Object `MachineHub` yeni sınıftır; taşınacak eski kayıt yoktur. Fiş yine bağlanan bilgisayarda kurulur. İndirilen ajan xAI çağrısını o bilgisayarda, `C:\DENK\secrets\xai.env` ile yapar. Worker xAI çağırmaz.

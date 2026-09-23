# denk-app (ince merkez)

Müşteri defteri burada işlenmez. Bağlanan bilgisayar `GET /api/knowledge` ile kural paketini alır ve kendi log, audit veya XML dosyasını kendi üstünde işler.

`POST /api/ai` ve `POST /api/evrak` evrak kabul etmez.

```bash
cd ../admin-ui && npm run build
cd ../denk-app && npm install && npm run dev
```

Yerel adres: `http://127.0.0.1:8788`

## Canlı

xAI API anahtarları `C:\DENK\secrets\xai.env` içinde. Cloudflare için token isteme; `denk@kaosarc.com` ile `wrangler login` yap, sonra deploy et.

```bash
npx wrangler login
```

Secret dosyadan okunur, sohbete veya gite yazılmaz:

```powershell
$envLine = Get-Content 'C:\DENK\secrets\xai.env' | Where-Object { $_ -match '^XAI_API_KEY=' } | Select-Object -First 1
$secret = $envLine -replace '^XAI_API_KEY=', ''
$secret | npx wrangler secret put XAI_API_KEY
Remove-Variable secret, envLine
```

```bash
cd apps/admin-ui && npm run build
cd ../denk-app && npx wrangler deploy
```

`denk-central` ve `denkmuhasebe.com` bu komutun hedefi değildir. Yayın `app.denkmuhasebe.com` içindir. İlk üretim kaydı olduğu için geri alma: `npx wrangler rollback` veya Worker `denk-app` silinir. Durable Object `MachineHub` yeni sınıftır; taşınacak eski kayıt yoktur. Fiş yine bağlanan bilgisayarda kurulur. Worker xAI çağırmaz.

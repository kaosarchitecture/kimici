# denk-app (ince merkez)

Müşteri defteri burada işlenmez. Bağlanan bilgisayar `GET /api/knowledge` ile kural paketini alır ve kendi log, audit veya XML dosyasını kendi üstünde işler.

`POST /api/ai` ve `POST /api/evrak` evrak kabul etmez.

```bash
cd ../admin-ui && npm run build
cd ../denk-app && npm install && npm run dev
```

Yerel adres: `http://127.0.0.1:8788`

# denk-app (ince merkez)

Müşteri defteri burada işlenmez. Ajan `GET /api/knowledge` ile kural paketini çeker.
Web yalnız kiracı başına `TenantHub` içinde, Windows onayıyla itilen alanları gösterir.

`POST /api/evrak` ve Worker üzerinden evraklı Grok yolu kaldırıldı (410).

Operatör masası (`admin-ui`) ayrı. **denk-central** / **denkmuhasebe.com** değildir.

```bash
cd ../admin-ui && npm run build
cd ../denk-app && npx wrangler deploy
```

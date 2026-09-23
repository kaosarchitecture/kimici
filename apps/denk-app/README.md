# denk-app (ince merkez)

Müşteri defteri burada işlenmez. Ajan `GET /api/knowledge` ile kural paketini çeker.

Operatör masası (`admin-ui`) ayrı. **denk-central** / **denkmuhasebe.com** değildir.

```bash
cd ../admin-ui && npm run build
cd ../denk-app && npx wrangler deploy
```

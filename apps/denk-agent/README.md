# DENK ajanı (bağlanan bilgisayar)

Kurallar bizim sunucuda. İş bu makinede.

```
bu bilgisayar  --WSS-->  denk-app  GET /api/knowledge
log, audit, XML burada okunur
fiş burada kurulur
```

Kim bağlanırsa fiş onun klasöründen çıkar. ETA SQL'ine buradan gidilmez. Kaynak dosya sunucuya yüklenmez.

```bash
export DENK_HUB_URL=http://127.0.0.1:8788
export DENK_LOCAL=./inbox
npm run connect
```

`inbox` içine `*.xml`, `*.audit.json` veya `*.log` koyun. Tek dosya için: `npm run process -- evrak.xml`.

Model çağrısı varsa o da bu makinedeki `XAI_API_KEY` veya Windows'ta `C:\DENK\secrets\xai.env` ile yapılır. Anahtar yoksa fişi kural motoru kurar.

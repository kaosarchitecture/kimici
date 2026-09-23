# DENK ajanı (bağlanan bilgisayar)

Kurallar bizim sunucuda. Ajan bu Windows oturumunda çalışır. PowerShell tarayıcıyı açar; onay sitedeki Bağla düğmesidir. SQL hedefini kendisi arar: ODBC kaydı, yerel SQL örneği, sonra `SIRKET` / `MUHFIS` / `MUHHAR` tablosu. xAI çağrısı da bu bilgisayardadır; anahtar `C:\DENK\secrets\xai.env` içindedir ve merkeze gitmez.

SQL ve ETA bu bilgisayardaysa bağlantı Integrated Security ile açılır. Parola okunmaz, sunucuya gitmez. Şablon fiş okunabilirse build bu makinede açıktır.

```bash
export DENK_HUB_URL=http://127.0.0.1:8788
npm run connect
```

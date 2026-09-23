# Windows onayı ve izinli web görünümü

Bu, DENK'in **asıl gösterim yoludur**. Sunucudaki AI kullanıcının makinesine bağlanmaz.
Kullanıcının ajanı zaten **bize** WSS ile bağlıdır. AI izin ister; kullanıcı kendi Windows
oturumuyla onaylar; ajan yalnız tiklenen alanları iter; bizim web arayüzümüz o dilimi gösterir.

## 1. Yön

```
Bizim AI / web  →  TenantHub  →  (zaten açık WSS)  →  ajan
ajan Windows onayı alır
ajan izinli satırları  →  TenantHub  →  bizim web arayüzü
```

DENK bir ofis PC'sine, SQL'e veya RDP ile gitmez. Windows parolası sunucuya gelmez.
Windows Auth **kullanıcının kendi makinesinde** olur: o anki oturum (`DOMAIN\kullanıcı` + SID).

## 2. Ne istenir, ne onaylanır

AI bir **kapsam** ve **alan listesi** ister, gerekçeyle:

- Kapsam örneği: `plan.preview` (fiş planı önizlemesi)
- Alanlar: `account`, `side`, `amountText`, `description`, `lineDate`, `ruleId`
- Süre: varsayılan 15 dakika

Kullanıcı Windows onayında alanların bir kısmını kaldırabilir. Hub, grant'te olmayan
anahtarı düşürür. `password` / `parola` / `secret` anahtarı her durumda reddedilir.

## 3. Windows Auth (yerel, parola yok)

Canlı ajan, onay penceresini **etkileşimli Windows oturumunda** açar:

1. İstek TenantHub üzerinden ajana düşer (`consent.request`).
2. Ajan yerelde `WindowsIdentity` okur (hesap + SID). Parola okunmaz.
3. Kullanıcı gerekçeyi ve alanları görür, onaylar veya reddeder.
4. Ajan `consent.granted` gönderir: SID, hesap, onaylanan alanlar, süre. İmza cihaz anahtarıyladır.
5. Ajan yalnızca o alanları okur ve `view.chunk` ile **bize iter**.

İsteğe bağlı yerelde (sunucuya gelmez): Windows Hello / PIN ile ikinci onay.
Bizim sunucu Windows parolası, NTLM özeti veya `sa` hesabı istemez.

Kullanıcı daha sonra kendi makinesinde yerel ETA'yı açarsa ajan, o Windows kullanıcısının
zaten erişebildiği kaynakları okuyabilir. Bu da bizim SQL kullanıcısı açmamız değildir.

## 4. Web arayüzünde gösterim

TenantHub (Durable Object) ajan ve operatör soketlerini tutar. Cloudflare Hibernation API
ile boşta bellekten atılır, bağlantılar kopmaz. Operatör soketi `ui`, ajan soketi `agent`
etiketiyle ayrılır.

Akış:

1. Operatör / AI `POST /views/request` → Hub `consent.request` yayınlar.
2. Ajan Windows diyaloğunu açar, `consent.prompted` döner. Web "Windows onayı açık" gösterir.
3. Onay gelince Hub grant'i bellek / kısa ömürlü DO deposunda tutar (defter olarak D1'e yazılmaz).
4. `view.chunk` gelince Hub operatör soketine `view.ready` basar.
5. Web tablosu yalnız `fieldSet` kolonlarını çizer.
6. Süre dolunca veya "Görünümü kapat" ile satırlar silinir.

Çalışan gösterim: `packages/consent-view` (`npm test`, `npm run demo`).

## 5. Mesajlar

| Yön | Tip | İçerik |
|---|---|---|
| Merkez → Ajan | `consent.request` | gerekçe, kapsam, alanlar, süre |
| Ajan → Merkez | `consent.prompted` | Windows hesap + SID (parola yok) |
| Ajan → Merkez | `consent.granted` / `consent.denied` | onaylanan alanlar veya ret |
| Ajan → Merkez | `view.chunk` | yalnız izinli alanlar |
| Merkez → Web | `view.ready` | satır sayısı, grant kimliği |
| İki yön | `consent.revoked` | görünüm silinir |

Merkezden ajana SQL, kabuk veya keyfi kod gitmez. İzin isteği sabit şemadır.

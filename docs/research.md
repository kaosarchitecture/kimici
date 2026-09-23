# Hazır Açık Kaynak Araştırması

Tarih: 2026-09-23. Yıldız, lisans ve son push bilgileri GitHub API'den çekildi.

## Sonuç

Aşağıdaki işlerin **hepsini birlikte** yapan olgun bir açık kaynak proje **yok**:

1. Kullanıcının verdiği örneklerden muhasebe kuralı tanımlamak,
2. Hedef bilgisayardaki ETA geçmişinden (fiş, log, audit) davranış öğrenip kural çıkarmak,
3. Kuralları merkezden sahaya dağıtıp, müşteri verisini merkeze taşımadan hedef bilgisayarda uygulamak,
4. ETA:SQL / ETA:V.8 / V.11 ile entegre olmak.

Muhasebe tarafındaki en yakın projeler ya çok genç, ya QuickBooks'a bağlı, ya da AGPL
lisanslı. AGPL lisanslı bir projeyi SaaS olarak işletirseniz, değiştirilmiş kaynak
kodunu ağ üzerinden erişen kullanıcılara açmanız gerekir. "Birebir üzerine gitmek" için
güvenli bir temel sunmuyorlar. Bu yüzden karar şu: **Sistemin iskeleti sıfırdan
tasarlanır, alt parçalarda olgun ve izin verici lisanslı kütüphaneler kullanılır.**

## Muhasebe / öğrenen ajan adayları

| Repo | Yıldız | Lisans | Ne yapıyor | Neden temel alınmıyor |
|---|---|---|---|---|
| [Unicorn-Commander/accounting-ops-community](https://github.com/Unicorn-Commander/accounting-ops-community) | 3 | AGPL-3.0 | Deterministik kural katmanı, isteğe bağlı LLM, önemlilik (materiality) kapısı, hash zincirli yevmiye | AGPL (SaaS'ta kaynak açma zorunluluğu), çok genç, merkezi mimari (veri sunucuda), ETA yok |
| [bbookmind/mcp](https://github.com/bbookmind/mcp) | 0 | MIT | Kullanıcı düzeltmelerinden kalıcı kategori kuralı öğrenen MCP sunucusu | Yalnızca QuickBooks Online, topluluk yok |
| [sheharyarmonnoo/gl-autopilot](https://github.com/sheharyarmonnoo/gl-autopilot) | 0 | MIT | Banka/kart hareketinden hesap kodu öğrenme, anomali tespiti | Tek kişilik demo, üretime hazır değil |

**Tasarıma alınan fikirler** (fikirler telif konusu değildir, kod kopyalanmayacak):

- Önce deterministik kural, yalnızca belirsiz kalanlarda model (accounting-ops).
- Her düzeltmenin kalıcı kurala dönüşmesi (BookMind).
- Tutara/önemliliğe göre otomatik kayıt, onaylı kayıt ve bloklu kayıt ayrımı (accounting-ops).
- Değiştirilemez (append-only) ve hash zincirli denetim izi (accounting-ops).

## Altyapı parçaları (izin verici lisanslı, olgun)

| Parça | Repo | Yıldız | Lisans | Kullanım yeri |
|---|---|---|---|---|
| Kural ifade dili | [jwadhams/json-logic-js](https://github.com/jwadhams/json-logic-js) | 1.4k | MIT | Merkez (TypeScript) tarafında kural doğrulama ve simülasyon |
| Kural ifade dili (.NET) | [json-everything/json-everything](https://github.com/json-everything/json-everything) | 1.2k | MIT | Ajan tarafında aynı JsonLogic kurallarının değerlendirilmesi |
| Makine öğrenmesi (.NET) | [dotnet/machinelearning](https://github.com/dotnet/machinelearning) | 9.3k | MIT | Ajanda karar ağacı / sınıflandırıcı eğitimi (yerel) |
| Kural motoru alternatifi | [microsoft/RulesEngine](https://github.com/microsoft/RulesEngine) | 4.3k | MIT | JsonLogic yetmezse yedek seçenek |
| Karar tablosu alternatifi | [gorules/zen](https://github.com/gorules/zen) | 2.0k | MIT | Görsel karar tablosu editörü gerekirse değerlendirilecek |
| Paket imzalama | [sigstore/cosign](https://github.com/sigstore/cosign) | 6.3k | Apache-2.0 | Ajan yükleyicisi ve sürüm imzası (isteğe bağlı) |
| Yerel LLM (isteğe bağlı) | [ollama/ollama](https://github.com/ollama/ollama) | 181k | MIT | Açıklama metni yorumlama; veri bilgisayardan çıkmaz |
| Federe öğrenme (ileri faz) | [flwrlabs/flower](https://github.com/flwrlabs/flower) | 7.1k | Apache-2.0 | Faz 4: veri paylaşmadan, müşteriler arası model ağırlığı birleştirme |

### Bilerek elenen altyapılar

| Repo | Neden elendi |
|---|---|
| [amidaware/tacticalrmm](https://github.com/amidaware/tacticalrmm) | Özel lisans (NOASSERTION); ticari/SaaS kullanımı kısıtlı |
| [Ylianst/MeshCentral](https://github.com/Ylianst/MeshCentral) | Apache-2.0 ama uzak masaüstü ve uzak kabuk veriyor. Muhasebe verisi olan bir makinede gereğinden fazla yetki, saldırı yüzeyi büyük |
| [osquery/osquery](https://github.com/osquery/osquery) | İşletim sistemi telemetrisi için; ETA/MSSQL iş mantığına uygun değil |
| [temporalio/temporal](https://github.com/temporalio/temporal), [hatchet-dev/hatchet](https://github.com/hatchet-dev/hatchet) | Sunucu tarafı iş akışı motorları; sahadaki tek bir Windows ajanı için fazla ağır |

## ETA hakkında doğrulanan / doğrulanamayan bilgiler

Doğrulanan (kamuya açık kaynaklar):

- ETA:SQL ve ETA:V.8/V.11-SQL, **Microsoft SQL Server** üzerinde çalışır ve ODBC ile dış
  erişime açık, "açık veritabanı" mimarisi olarak pazarlanır
  ([eylulyazilim](https://www.eylulyazilim.net/eta), [megabim](https://www.megabim.com/etasql/)).
- Bilinen tablo örnekleri: `STKKART`, `STKFIYAT`, `CARKART`, `FATFIS`
  ([ETA teknik not](https://silo.tips/download/13-mays-lgili-versiyon-lar-etasql-etav8-sql-lgili-modl-ler-genel)).
- Sistem İşlemleri > Kullanıcı İşlemleri > **Log Bağlantı Tanımları** ile kullanıcı bazlı
  log tutulur. Kart ve fişlerde ilk kaydeden, düzelten ve iptal eden kullanıcı saklanır
  ([muhasebedersleri](https://www.muhasebedersleri.com/bilgisayarli-muhasebe/eta-sql-sistem-islemleri.html),
  [etasqlv8.com](http://etasqlv8.com/eta-v11-pro-teknik-ozellikler.html)).
- ETA'nın genel amaçlı, resmi ve belgelenmiş bir REST API'si bulunamadı. Üçüncü parti
  entegrasyonlar doğrudan SQL/ODBC, XML web servisi veya aktarım araçlarıyla yapılıyor
  ([datakent](http://www.datakent.com/eta_sql_entegrasyonlari.asp)).

Doğrulanamayan, Faz 0'da hedef makinede keşfedilmesi gerekenler:

- Muhasebe fişi başlık ve satır tablolarının adları ve kolonları (`MUHFIS` / `MUHHAR` gibi
  adlar tahmin; **doğrulanmadı**).
- Log ve audit tablolarının fiziksel adları, saklama süreleri ve kolon anlamları.
- Fiş numarası ve evrak serisi üretim mantığı (doğrudan SQL ile yazarken kritik).
- ETA'ya doğrudan SQL ile yazmanın lisans ve destek şartlarına uygun olup olmadığı.
- ETA'nın resmi bir içe aktarım (Excel/XML) yolu olup olmadığı ve hangi sürümlerde bulunduğu.

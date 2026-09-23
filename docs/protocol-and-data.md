# Protokol ve Veri Modeli

## 1. Kural formatı

Kural iki parçadan oluşur: **koşul** (JsonLogic) ve **fiş şablonu**. Merkezde TypeScript
(`json-logic-js`), ajanda C# (`json-everything` JsonLogic) ile aynı ifade değerlendirilir.
Her iki taraf da `packages/rule-schema` altındaki aynı örnek setine karşı test edilir.

```json
{
  "ruleId": "rent-invoice-withholding",
  "version": 3,
  "title": "Kira faturası, stopajlı",
  "source": "central",
  "priority": 100,
  "when": {
    "and": [
      { "==": [{ "var": "doc.type" }, "purchase_invoice"] },
      { "in": ["kira", { "var": "doc.descriptionTokens" }] },
      { "==": [{ "var": "party.kind" }, "individual"] }
    ]
  },
  "then": {
    "lines": [
      { "account": "770", "side": "D", "amount": { "var": "doc.gross" } },
      { "account": "360", "side": "C", "amount": { "*": [{ "var": "doc.gross" }, 0.20] } },
      { "account": "336", "side": "C", "amount": { "*": [{ "var": "doc.gross" }, 0.80] } }
    ],
    "descriptionTemplate": "{{party.code}} {{doc.period}} kira"
  },
  "gate": { "maxAutoAmount": 50000, "minConfidence": 0.97 },
  "examples": ["ex-rent-001", "ex-rent-002"]
}
```

Bu örnek yalnızca format içindir. Stopaj oranı, hesap seçimi ve kira türüne göre değişen
ayrıntılar muhasebe kural yazarının sorumluluğundadır.

- `account` merkezde TDHP ana veya grup hesabıdır. Ajan, yerel geçmişte en sık kullanılan
  alt hesaba eşler. Eşleme belirsizse kural gölge modda kalır ve kullanıcıya sorulur.
- Paket yayınlanmadan önce `examples` listesindeki tüm örneklerden beklenen fişin
  birebir üretilmesi zorunludur. Borç ve alacak eşitliği her örnekte kontrol edilir.
- Sahada öğrenilen kurallar aynı formattadır, `source: "local"` taşır ve merkeze gitmez.

### 1.1 Kural paketi

```
rules-v42.pkg (tar)
├── manifest.json      # {version, tenantScope, createdAt, ruleCount, sha256 listesi}
├── rules/*.json
├── account-templates/tdhp.json
└── signature.ed25519  # manifest.json'ın imzası
```

Ajan, gömülü merkez açık anahtarıyla imzayı doğrular. İmza veya sha256 tutmazsa paket
reddedilir, olay denetim izine yazılır ve merkeze hata kodu gönderilir.

## 2. Ajan ↔ merkez mesajları

Tüm mesajlar JSON'dır ve ortak bir zarf kullanır. Şemalar `packages/protocol` altında JSON
Schema olarak tutulur.

```json
{ "v": 1, "type": "telemetry.summary", "id": "01J...", "ts": "2026-09-23T17:00:00Z", "body": {} }
```

| Yön | `type` | Gövde (özet) |
|---|---|---|
| Ajan → Merkez | `agent.hello` | ajan sürümü, ETA sürümü, şema haritası hash'i, aktif kural paketi sürümü |
| Ajan → Merkez | `telemetry.summary` | 15 dakikalık sayaçlar: okunan kayıt, öneri, otomatik, onaylı, bloklu, düzeltme, hata kodları |
| Ajan → Merkez | `rules.stats` | `ruleId` bazında: eşleşme, kabul, düzeltme, ret sayıları |
| Ajan → Merkez | `audit.anchor` | günlük denetim zinciri başı hash'i ve kayıt sayısı |
| Ajan → Merkez | `ruleset.ack` | yüklenen sürüm, eşlenemeyen kural sayısı, doğrulama sonucu |
| Ajan → Merkez | `command.result` | komut kimliği, durum, hata kodu |
| Merkez → Ajan | `ruleset.available` | sürüm, sha256, indirme yolu |
| Merkez → Ajan | `command` | izin listesindeki komutlar: `rescan_schema`, `pause_writes`, `resume_writes`, `rollback_ruleset`, `upload_diagnostics_summary` |
| Merkez → Ajan | `consent.request` | gerekçe, kapsam, alan listesi, süre. Windows parolası yok |
| Ajan → Merkez | `consent.prompted` / `granted` / `denied` | yerelde doğrulanmış Windows hesap + SID; onaylanan alanlar |
| Ajan → Merkez | `view.chunk` | yalnız grant'teki alanlar. Ajan iter; hub çekmez |
| Merkez → Web | `view.ready` | kısa ömürlü izinli tablo. D1'e defter olarak yazılmaz |

Merkezden ajana **keyfi kod, SQL veya kabuk komutu gönderilemez**. Komut tipi ajan
tarafında sabit bir listeyle doğrulanır.

### 2.1 Telemetri izin listesi

Merkeze giden alanlar yalnızca şunlardır: sayılar, süreler, sürüm numaraları, `ruleId`,
hata kodları, hash'ler. Aşağıdakiler **asla** gönderilmez ve gizlilik filtresi bunlar için
birim testiyle korunur:

- tutarlar, bakiyeler, döviz kurları
- cari veya stok kodu ve adı, VKN, TCKN, IBAN, adres
- açıklama metinleri ve belge numaraları
- ETA kullanıcı adları (ajan bunları yerelde takma kimliğe çevirir)
- yerel olarak öğrenilmiş kuralların koşul ve şablon içeriği

İstisna: kullanıcı Windows ile `consent.granted` verdiyse `view.chunk` yalnız o anda
onaylanan alanları taşır. Süre dolunca Hub görünümü siler. Bu istisna
`docs/consent-and-view.md` içindedir.

## 3. Merkez veri modeli (D1)

```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,              -- active | suspended
  created_at TEXT NOT NULL
);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  public_key TEXT NOT NULL,
  agent_version TEXT,
  eta_version TEXT,
  status TEXT NOT NULL,              -- enrolled | revoked
  last_seen_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE enrollment_codes (
  code_hash TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE rules (
  id TEXT NOT NULL,
  version INTEGER NOT NULL,
  body_json TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (id, version)
);

CREATE TABLE rule_examples (
  id TEXT PRIMARY KEY,
  input_json TEXT NOT NULL,          -- operatörün yazdığı sentetik/örnek belge
  expected_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE rulesets (
  version INTEGER PRIMARY KEY,
  r2_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL
);

CREATE TABLE ruleset_assignments (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  ruleset_version INTEGER NOT NULL REFERENCES rulesets(version),
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, ruleset_version)
);

CREATE TABLE tenant_daily_rollups (
  tenant_id TEXT NOT NULL,
  day TEXT NOT NULL,
  counters_json TEXT NOT NULL,       -- yalnız sayaçlar
  PRIMARY KEY (tenant_id, day)
);
```

TenantHub Durable Object'in kendi SQLite deposunda kiracıya özel `telemetry` (15 dk),
`rule_stats` (günlük) ve `command_queue` tabloları tutulur. 90 günden eski satırlar
alarm ile R2'ye arşivlenip silinir.

## 4. Ajan yerel veri modeli (şifreli SQLite)

```sql
CREATE TABLE eta_schema_map (
  version INTEGER PRIMARY KEY,
  eta_version TEXT NOT NULL,
  map_json TEXT NOT NULL,            -- mantıksal alan → fiziksel tablo.kolon
  discovered_at TEXT NOT NULL
);

CREATE TABLE watermarks (
  source TEXT PRIMARY KEY,           -- ör. company:01:journal
  last_key TEXT NOT NULL,
  last_ts TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE doc_features (
  doc_key TEXT PRIMARY KEY,          -- şirket + belge kimliği
  company TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  doc_date TEXT NOT NULL,
  features_json TEXT NOT NULL,
  template_sig TEXT,                 -- tutardan bağımsız fiş kalıbı
  entered_by TEXT                    -- yerel takma kimlik
);
CREATE INDEX ix_doc_features_sig ON doc_features(template_sig);

CREATE TABLE behavior_events (
  id INTEGER PRIMARY KEY,
  doc_key TEXT,
  kind TEXT NOT NULL,                -- create | update | cancel | print
  actor TEXT,
  ts TEXT NOT NULL,
  diff_json TEXT
);

CREATE TABLE rules_local (
  rule_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  source TEXT NOT NULL,              -- central | local
  state TEXT NOT NULL,               -- candidate | shadow | active | auto | suspended | rejected
  body_json TEXT NOT NULL,
  support INTEGER NOT NULL DEFAULT 0,
  confidence REAL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (rule_id, version)
);

CREATE TABLE account_mappings (
  generic_account TEXT NOT NULL,     -- ör. 191
  company TEXT NOT NULL,
  local_account TEXT NOT NULL,       -- ör. 191.01.001
  usage_count INTEGER NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (generic_account, company)
);

CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  doc_key TEXT NOT NULL,
  rule_id TEXT,
  rule_version INTEGER,
  proposal_json TEXT NOT NULL,
  confidence REAL,
  gate TEXT NOT NULL,                -- auto | approval | blocked
  status TEXT NOT NULL,              -- pending | approved | edited | rejected | written | rolled_back
  eta_ref TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT
);

CREATE TABLE audit_log (
  seq INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  actor TEXT NOT NULL,               -- agent | local-user | central-command
  action TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL                 -- sha256(prev_hash || canonical(payload))
);
```

`audit_log` tablosuna yalnızca ekleme yapılır. Güncelleme ve silme SQLite trigger'ı ile
engellenir. Zincirin günlük başı `audit.anchor` mesajıyla merkeze gönderilir. Böylece
yerel kayıtların sonradan değiştirilip değiştirilmediği içerik paylaşılmadan kanıtlanabilir.

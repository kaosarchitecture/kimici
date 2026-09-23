const LABELS = {
  account: "Hesap",
  side: "B/A",
  amountText: "Tutar",
  description: "Açıklama",
  lineDate: "Satır tarihi",
  ruleId: "Kural",
};

const STATUS_TR = {
  idle: "boş",
  pending: "izin bekleniyor",
  prompted: "Windows onayı açık",
  denied: "reddedildi",
  granted: "onaylandı",
  ready: "izinli görünüm geldi",
  revoked: "kapatıldı",
  expired: "süresi doldu",
};

const $ = (id) => document.getElementById(id);

function setStatus(el, status) {
  el.className = `status ${status}`;
  el.textContent = STATUS_TR[status] ?? status;
}

function renderFields(request) {
  const form = $("field-form");
  form.hidden = !request;
  form.innerHTML = "";
  if (!request) return;
  for (const field of request.fields) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.name = "field";
    box.value = field;
    box.checked = true;
    label.append(box, document.createTextNode(LABELS[field] ?? field));
    form.append(label);
  }
}

function selectedFields() {
  return [...document.querySelectorAll('#field-form input[name="field"]:checked')].map((el) => el.value);
}

function renderView(state) {
  const body = $("view-body");
  const meta = $("view-meta");
  if (!state.view || !state.grant) {
    body.className = "empty";
    body.textContent = state.status === "denied"
      ? "Kullanıcı Windows onayını reddetti. Web arayüzüne veri gelmedi."
      : "Gösterilecek izinli görünüm yok.";
    meta.textContent = "Onaydan sonra ajanın ittiği satırlar burada görünür. Sunucu makineye gitmedi.";
    return;
  }
  const fields = state.view.fieldSet;
  const table = document.createElement("table");
  const head = document.createElement("tr");
  for (const field of fields) {
    const th = document.createElement("th");
    th.textContent = LABELS[field] ?? field;
    head.append(th);
  }
  table.append(head);
  for (const row of state.view.records) {
    const tr = document.createElement("tr");
    for (const field of fields) {
      const td = document.createElement("td");
      td.textContent = row[field] ?? "";
      if (field === "amountText") td.className = "num";
      tr.append(td);
    }
    table.append(tr);
  }
  body.className = "";
  body.replaceChildren(table);
  meta.textContent = `${state.grant.identity.account} onayladı · ${fields.map((f) => LABELS[f] ?? f).join(", ")} · ${state.view.records.length} satır`;
}

function render(state) {
  setStatus($("op-status"), state.status);
  $("op-purpose").textContent = state.request
    ? `İstenen: ${state.request.purpose}`
    : "";
  const waiting = state.status === "pending" || state.status === "prompted";
  $("btn-request").disabled = waiting || state.status === "ready" || state.status === "granted";
  $("btn-revoke").disabled = !state.grant;
  $("btn-grant").disabled = !waiting;
  $("btn-deny").disabled = !waiting;
  if (waiting && state.request) {
    $("pc-request").className = "";
    $("pc-request").textContent = `AI şunu istiyor: ${state.request.purpose}`;
    if ($("field-form").hidden) renderFields(state.request);
  } else if (state.status === "ready" || state.status === "granted") {
    $("pc-request").className = "";
    $("pc-request").textContent = `Onaylandı: ${state.request?.purpose ?? ""}`;
  } else {
    $("pc-request").className = "empty";
    $("pc-request").textContent = state.status === "denied"
      ? "Kullanıcı reddetti."
      : state.status === "revoked"
        ? "Görünüm kapatıldı."
        : "Henüz izin isteği yok.";
    renderFields(null);
  }
  renderView(state);
  $("banner").textContent = state.status === "ready"
    ? "İzinli satırlar ajanın itmesiyle geldi. DENK kullanıcının makinesine bağlanmadı."
    : "Yön: ajan → bizim sunucu. Solda operatör / AI, sağda kullanıcının Windows onayı.";
}

async function post(path, body = {}) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "İstek başarısız");
  render(data);
}

$("btn-request").addEventListener("click", () => {
  post("/api/ai/request", {
    purpose: "Ağustos alış faturası önizlemesi",
    fields: ["account", "side", "amountText", "description", "lineDate", "ruleId"],
  }).catch((err) => alert(err.message));
});
$("btn-grant").addEventListener("click", () => {
  post("/api/agent/grant", { fields: selectedFields() }).catch((err) => alert(err.message));
});
$("btn-deny").addEventListener("click", () => {
  post("/api/agent/deny").catch((err) => alert(err.message));
});
$("btn-revoke").addEventListener("click", () => {
  post("/api/revoke").catch((err) => alert(err.message));
});

const events = new EventSource("/api/events");
events.onmessage = (event) => render(JSON.parse(event.data));
fetch("/api/state").then((res) => res.json()).then(render);

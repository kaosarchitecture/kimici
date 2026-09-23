export function Agent() {
  return (
    <section className="sheet" style={{ maxWidth: 560 }}>
      <h2>Bağlı ajan</h2>
      <dl className="facts">
        <div>
          <dt>Yön</dt>
          <dd>ajan → bizim sunucu (WSS)</dd>
        </div>
        <div>
          <dt>Durum</dt>
          <dd>bağlı (kayıt kodu ile)</dd>
        </div>
        <div>
          <dt>Windows kimliği</dt>
          <dd>DEMO\Kullanici · S-1-5-21-DEMO-1001</dd>
        </div>
        <div>
          <dt>Yerel ETA</dt>
          <dd>kapalı — kullanıcı açmadı</dd>
        </div>
        <div>
          <dt>SQL kullanıcısı</dt>
          <dd>yok; DENK açmaz</dd>
        </div>
      </dl>
      <p className="lede" style={{ marginTop: "1rem" }}>
        Bu sayfada sunucu adresi, parola veya ofis SQL formu yoktur. Ajan zaten dışarı bağlanır.
      </p>
    </section>
  );
}

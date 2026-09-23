import { describe, expect, it } from "vitest";
import { ConsentHub } from "../src/hub.ts";
import { demoWindowsIdentity } from "../src/windows.ts";

const LOCAL = [
  {
    account: "191 02 20",
    side: "B",
    amountText: "7.099,28",
    description: "İND.KDV.",
    lineDate: "2026-08-26",
    ruleId: "R16.passenger-car.accepted-vat",
    hidden: "should-not-leave-the-pc",
  },
  {
    account: "100 01",
    side: "A",
    amountText: "1.200,00",
    description: "kasa",
    lineDate: "2026-08-26",
    ruleId: "R13.cash",
  },
];

describe("ConsentHub", () => {
  it("AI request → Windows grant → agent push → web view of permitted fields only", () => {
    const hub = new ConsentHub();
    const request = hub.requestView({
      purpose: "Ağustos alış faturası önizlemesi",
      fields: ["account", "side", "amountText", "description", "lineDate", "ruleId"],
    });
    expect(hub.snapshot().status).toBe("pending");

    const identity = demoWindowsIdentity();
    hub.markPrompted(request.requestId, identity);
    expect(hub.snapshot().status).toBe("prompted");

    const grant = hub.grant(request.requestId, {
      identity,
      fields: ["account", "amountText", "description"],
    });
    expect(grant.identity.account).toBe("DEMO\\Kullanici");
    expect(grant.fields).toEqual(["account", "amountText", "description"]);

    const view = hub.pushView(grant.grantId, LOCAL);
    expect(hub.snapshot().status).toBe("ready");
    expect(view.records).toEqual([
      { account: "191 02 20", amountText: "7.099,28", description: "İND.KDV." },
      { account: "100 01", amountText: "1.200,00", description: "kasa" },
    ]);
  });

  it("does not accept a view without Windows consent", () => {
    const hub = new ConsentHub();
    expect(() => hub.pushView("grn_missing", LOCAL)).toThrow(/Windows onayı yok/);
  });

  it("deny leaves the web UI empty", () => {
    const hub = new ConsentHub();
    const request = hub.requestView({ purpose: "deneme", fields: ["account"] });
    hub.deny(request.requestId, "Kullanıcı reddetti.");
    expect(hub.snapshot().status).toBe("denied");
    expect(hub.snapshot().view).toBeNull();
  });

  it("revokes the in-memory view", () => {
    const hub = new ConsentHub();
    const request = hub.requestView({ purpose: "deneme", fields: ["account"] });
    const grant = hub.grant(request.requestId, { identity: demoWindowsIdentity() });
    hub.pushView(grant.grantId, LOCAL);
    hub.revoke(grant.grantId);
    expect(hub.snapshot().status).toBe("revoked");
    expect(hub.snapshot().view).toBeNull();
  });

  it("rejects a non-interactive Windows identity and any password field", () => {
    const hub = new ConsentHub();
    const request = hub.requestView({ purpose: "deneme", fields: ["account"] });
    expect(() =>
      hub.grant(request.requestId, {
        identity: { account: "DEMO\\Kullanici", sid: "S-1-5-21-DEMO-1", interactive: false, attestedAt: "2026-09-23T00:00:00Z" },
      }),
    ).toThrow(/etkileşimli/);
    expect(() =>
      hub.grant(request.requestId, {
        identity: {
          account: "DEMO\\Kullanici",
          sid: "S-1-5-21-DEMO-1",
          interactive: true,
          attestedAt: "2026-09-23T00:00:00Z",
          password: "nope",
        } as never,
      }),
    ).toThrow(/gönderilemez/);
  });

  it("restores a snapshot so a Durable Object can continue the grant", () => {
    const first = new ConsentHub();
    const request = first.requestView({ purpose: "deneme", fields: ["account", "description"] });
    const grant = first.grant(request.requestId, { identity: demoWindowsIdentity() });
    const second = new ConsentHub();
    second.restore(first.snapshot());
    const view = second.pushView(grant.grantId, LOCAL);
    expect(view.records[0]).toEqual({ account: "191 02 20", description: "İND.KDV." });
    expect(second.snapshot().status).toBe("ready");
  });

  it("expires a pending request so the view cannot be pushed later", () => {
    const hub = new ConsentHub();
    const start = new Date("2026-09-23T12:00:00Z");
    const request = hub.requestView({
      purpose: "deneme",
      fields: ["account"],
      ttlMs: 1000,
      now: start,
    });
    const later = new Date("2026-09-23T12:00:02Z");
    expect(hub.snapshot(later).status).toBe("expired");
    expect(() => hub.grant(request.requestId, { identity: demoWindowsIdentity(later), now: later })).toThrow(
      /süresi doldu/,
    );
  });
});

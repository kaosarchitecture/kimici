import { DurableObject } from "cloudflare:workers";
import { ConsentHub, type HubSnapshot } from "../../../packages/consent-view/src/hub.ts";
import {
  isControlPlanePath,
  isHubPath,
  json,
  routeControlPlane,
} from "../../../packages/consent-view/src/http.ts";
import { tenantFromRequest } from "../../../packages/consent-view/src/tenant.ts";

export interface Env {
  ASSETS: Fetcher;
  HUB: DurableObjectNamespace<TenantHub>;
}

/** One hub per tenant id. Stores consent + permitted view only — never an invoice file. */
export class TenantHub extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const hub = new ConsentHub();
    const snap = await this.ctx.storage.get<HubSnapshot>("hub");
    if (snap) hub.restore(snap);
    const res = await routeControlPlane(request, async () => hub);
    await this.ctx.storage.put("hub", hub.snapshot());
    return res ?? json({ error: "bulunamadı" }, 404);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return json(null, 204);
    }

    if (isHubPath(url.pathname)) {
      try {
        const tenant = tenantFromRequest(request);
        return env.HUB.getByName(tenant).fetch(request);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Kiracı kodu geçersiz.";
        return json({ error: message }, 400);
      }
    }

    if (isControlPlanePath(url.pathname)) {
      const res = await routeControlPlane(request);
      return res ?? json({ error: "bulunamadı" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

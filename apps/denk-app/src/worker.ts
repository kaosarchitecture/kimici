import { DurableObject } from "cloudflare:workers";
import { ConsentHub, type HubSnapshot } from "../../../packages/consent-view/src/hub.ts";
import {
  isBookPath,
  isControlPlanePath,
  isHubPath,
  json,
  routeControlPlane,
} from "../../../packages/consent-view/src/http.ts";
import { TenantBook, type RegistrySnapshot } from "../../../packages/consent-view/src/registry.ts";
import { tenantFromRequest } from "../../../packages/consent-view/src/tenant.ts";

export interface Env {
  ASSETS: Fetcher;
  HUB: DurableObjectNamespace<TenantHub>;
  REGISTRY: DurableObjectNamespace<TenantRegistry>;
}

export class TenantHub extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const hub = new ConsentHub();
    const snap = await this.ctx.storage.get<HubSnapshot>("hub");
    if (snap) hub.restore(snap);
    const book = new TenantBook();
    const reg = await this.env.REGISTRY.getByName("book").snapshot();
    book.restore(reg);
    const res = await routeControlPlane(request, { resolveHub: async () => hub, book });
    await this.ctx.storage.put("hub", hub.snapshot());
    return res ?? json({ error: "bulunamadı" }, 404);
  }
}

export class TenantRegistry extends DurableObject<Env> {
  private async book(): Promise<TenantBook> {
    const store = new TenantBook();
    const snap = await this.ctx.storage.get<RegistrySnapshot>("book");
    if (snap) store.restore(snap);
    return store;
  }

  async persist(store: TenantBook): Promise<void> {
    await this.ctx.storage.put("book", store.snapshot());
  }

  async snapshot(): Promise<RegistrySnapshot> {
    return (await this.book()).snapshot();
  }

  async fetch(request: Request): Promise<Response> {
    const store = await this.book();
    const res = await routeControlPlane(request, { book: store });
    await this.persist(store);
    return res ?? json({ error: "bulunamadı" }, 404);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return json(null, 204);
    }

    if (isBookPath(url.pathname)) {
      return env.REGISTRY.getByName("book").fetch(request);
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

import { useEffect, useState } from "react";
import { fetchState, subscribeState } from "./api.ts";
import type { HubSnapshot } from "./types.ts";

const EMPTY: HubSnapshot = {
  status: "idle",
  request: null,
  grant: null,
  view: null,
  denyReason: null,
};

export function useHub(): HubSnapshot {
  const [state, setState] = useState<HubSnapshot>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    fetchState()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => undefined);
    const stop = subscribeState((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return state;
}

"use client";

import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center gap-4">
      <p
        aria-live="polite"
        className="text-lg text-zinc-700 dark:text-zinc-300"
      >
        Count: <span data-testid="count-value" className="font-semibold">{count}</span>
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCount((c) => c - 1)}
          className="h-10 w-10 rounded-full border border-black/[.12] text-xl leading-none transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.08]"
          aria-label="Decrement"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setCount(0)}
          className="rounded-full border border-black/[.12] px-4 text-sm transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.08]"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="h-10 w-10 rounded-full bg-indigo-600 text-xl leading-none text-white transition-colors hover:bg-indigo-500"
          aria-label="Increment"
        >
          +
        </button>
      </div>
    </div>
  );
}

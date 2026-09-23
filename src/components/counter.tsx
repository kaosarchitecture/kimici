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
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setCount((c) => c - 1)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-2xl leading-none text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
          aria-label="Decrement"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setCount(0)}
          className="rounded-full border border-black/[.14] px-5 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.18] dark:hover:bg-white/[.08]"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-2xl leading-none text-white transition-colors hover:bg-indigo-500"
          aria-label="Increment"
        >
          +
        </button>
      </div>
    </div>
  );
}

import Counter from "@/components/counter";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-10 rounded-2xl border border-black/[.08] bg-white p-10 text-center shadow-sm dark:border-white/[.12] dark:bg-zinc-950 sm:p-14">
        <div className="flex flex-col items-center gap-3">
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium tracking-wide text-indigo-700 uppercase dark:bg-indigo-500/15 dark:text-indigo-300">
            Next.js starter
          </span>
          <h1 className="bg-gradient-to-r from-indigo-500 to-sky-500 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
            kimici
          </h1>
          <p className="max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
            A minimal Next.js + TypeScript + Tailwind app, ready for development
            in a Cursor Cloud Agent environment.
          </p>
        </div>

        <Counter />

        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Edit{" "}
          <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.85em] dark:bg-white/[.10]">
            src/app/page.tsx
          </code>{" "}
          to get started.
        </p>
      </main>
    </div>
  );
}

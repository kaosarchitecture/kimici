# kimici

A minimal [Next.js](https://nextjs.org) starter app, bootstrapped with
[`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
and configured with TypeScript, Tailwind CSS, and ESLint.

## Getting Started

Install dependencies and run the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page
auto-updates as you edit the file.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — create a production build
- `npm run start` — run the production build
- `npm run lint` — run ESLint

## Cloud Agent environment

This repository includes a Cursor Cloud Agent environment at
`.cursor/environment.json`. It installs dependencies with `npm ci` and starts
the Next.js dev server on port `3000` so agents can run and verify the app
end to end.

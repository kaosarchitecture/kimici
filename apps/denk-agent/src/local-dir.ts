import { readdir } from "node:fs/promises";

export async function listLocalDir(dir: string): Promise<string[]> {
  if (process.platform !== "win32") return [];
  const names = await readdir(dir);
  return names.slice(0, 20);
}

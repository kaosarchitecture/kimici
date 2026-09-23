/** ETA account codes are space separated levels: "191 02 20", "320 A=014". */
export function accountLevels(code: string): string[] {
  return code.trim().split(/\s+/).filter((part) => part.length > 0);
}

export function normalizeAccount(code: string): string {
  return accountLevels(code).join(" ");
}

/** Parent accounts from nearest to root: "191 02 20" -> ["191 02", "191"]. */
export function parentAccounts(code: string): string[] {
  const levels = accountLevels(code);
  const parents: string[] = [];
  for (let depth = levels.length - 1; depth >= 1; depth--) {
    parents.push(levels.slice(0, depth).join(" "));
  }
  return parents;
}

export function rootAccount(code: string): string {
  return accountLevels(code)[0] ?? "";
}

export function hasRoot(code: string, root: string): boolean {
  return rootAccount(code) === root;
}

import iconv from "iconv-lite";

const ENCODING = "windows-1254";

/** ETA V.8 stores text as single-byte Windows-1254; UTF-8 bytes show up as "Ä°" / "Åž" in ETA. */
export function encodeCp1254(text: string): Buffer {
  return iconv.encode(text, ENCODING);
}

export function decodeCp1254(bytes: Uint8Array): string {
  return iconv.decode(Buffer.from(bytes), ENCODING);
}

export function isCp1254Safe(text: string): boolean {
  return decodeCp1254(encodeCp1254(text)) === text;
}

export function cp1254Hex(text: string): string {
  return encodeCp1254(text).toString("hex").toUpperCase();
}

export function cp1254ByteLength(text: string): number {
  return encodeCp1254(text).length;
}

/** Trims and cuts to at most maxBytes CP1254 bytes (one byte per character in this code page). */
export function fitCp1254(text: string, maxBytes: number): string {
  const trimmed = text.trim();
  const bytes = encodeCp1254(trimmed);
  return bytes.length <= maxBytes ? trimmed : decodeCp1254(bytes.subarray(0, maxBytes)).trimEnd();
}

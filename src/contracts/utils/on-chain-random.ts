export function hashToNumber(hash: string): number {
  const h = hash.startsWith("0x") ? hash : "0x" + hash;
  return Number(BigInt(h) % BigInt(Number.MAX_SAFE_INTEGER));
}

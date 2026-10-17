const ENC = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Crockford-base32 ULID: 48-bit time + 80-bit randomness, lexicographically sortable. */
export function ulid(now: number = Date.now()): string {
  let t = now;
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = ENC[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const rnd = crypto.getRandomValues(new Uint8Array(16));
  let rand = "";
  for (let i = 0; i < 16; i++) rand += ENC[rnd[i] % 32];
  return time + rand;
}

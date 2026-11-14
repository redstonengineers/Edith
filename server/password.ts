import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Hasher } from '../src/services/crypto';

const derive = (pw: string, salt: string) => new Promise<Buffer>((res, rej) => scrypt(pw.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));

/** scrypt con sal aleatoria y comparación en tiempo constante. */
export const scryptHasher: Hasher = {
  async hash(pw, salt = randomBytes(16).toString('hex')) { return { salt, hash: (await derive(pw, salt)).toString('hex') }; },
  async verify(pw, p) { const a = await derive(pw, p.salt); const b = Buffer.from(p.hash, 'hex'); return a.length === b.length && timingSafeEqual(a, b); },
};

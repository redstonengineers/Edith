/** Algoritmo de hash de contraseñas intercambiable. Navegador (demo): SHA-256 salado. Servidor: scrypt (server/password.ts). */
export interface Hasher { hash(pw: string, salt?: string): Promise<{ salt: string; hash: string }>; verify(pw: string, p: { salt: string; hash: string }): Promise<boolean> }

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256: Hasher = {
  async hash(pw, salt = hex(crypto.getRandomValues(new Uint8Array(12)).buffer)) { return { salt, hash: hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pw}`))) }; },
  async verify(pw, p) { return (await sha256.hash(pw, p.salt)).hash === p.hash; },
};
let impl: Hasher = sha256;
export const setHasher = (h: Hasher) => { impl = h; };
export const hashPassword = (pw: string, salt?: string) => impl.hash(pw, salt);
export const verifyPassword = (pw: string, p: { salt: string; hash: string }) => impl.verify(pw, p);

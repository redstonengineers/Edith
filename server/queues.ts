/**
 * Colas de escritura por negocio. Las operaciones de UN mismo negocio se ejecutan de una en una (cada operación es atómica respecto a las
 * demás de su negocio), pero negocios distintos avanzan en paralelo: una operación lenta de un negocio no bloquea a los demás.
 * Las operaciones que tocan varios negocios o la plataforma (altas, cambios de plan, restauración de demos…) usan `runAll`: esperan a que
 * acaben todas las colas, se ejecutan solas y las nuevas esperan a que terminen.
 */
export class KeyedQueue {
  private tails = new Map<string, Promise<unknown>>();
  private barrier: Promise<unknown> = Promise.resolve();

  run<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    const prev = Promise.all([this.barrier, this.tails.get(key)]);
    const r = prev.then(fn);
    const tail = r.then(() => undefined, () => undefined); this.tails.set(key, tail);
    void tail.then(() => { if (this.tails.get(key) === tail) this.tails.delete(key); });
    return r;
  }

  runAll<T>(fn: () => Promise<T> | T): Promise<T> {
    const prev = Promise.all([this.barrier, ...this.tails.values()]);
    const r = prev.then(fn);
    this.barrier = r.then(() => undefined, () => undefined);
    return r;
  }
}

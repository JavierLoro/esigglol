import { DurableObject } from 'cloudflare:workers'

// Keep lifetime counters outside the product database: restoring a product
// backup must never refund R2 usage. Never restore or replace this namespace.
export class FileBudget extends DurableObject<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    state.storage.sql.exec(`CREATE TABLE IF NOT EXISTS budget(id INTEGER PRIMARY KEY CHECK(id=1),class_a INTEGER NOT NULL DEFAULT 0,class_b INTEGER NOT NULL DEFAULT 0,bytes INTEGER NOT NULL DEFAULT 0);
      INSERT OR IGNORE INTO budget(id) VALUES(1)`)
  }
  async reserve(a: number, b: number, bytes: number): Promise<boolean> {
    if (![a, b, bytes].every(n => Number.isSafeInteger(n) && n >= 0) || a + b !== 1 || bytes > 2098176) throw new Error('Invalid file reservation')
    return this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec(`UPDATE budget SET class_a=class_a+?,class_b=class_b+?,bytes=bytes+?
        WHERE id=1 AND class_a+?<=1000 AND class_b+?<=50000 AND bytes+?<=67108864`, a, b, bytes, a, b, bytes)
      return this.ctx.storage.sql.exec<{ n: number }>('SELECT changes() AS n').one().n === 1
    })
  }
  async usage(): Promise<{ class_a: number; class_b: number; bytes: number }> {
    return this.ctx.storage.sql.exec<{ class_a: number; class_b: number; bytes: number }>('SELECT class_a,class_b,bytes FROM budget WHERE id=1').one()
  }
}

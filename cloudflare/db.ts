import { getRuntime } from './context'
import type { DatabaseContract } from '../lib/database-contract'

const database: DatabaseContract = {
  prepare(sql) { return getRuntime().database.prepare(sql) },
  exec(sql) { getRuntime().database.exec(sql) },
  transaction(callback) { return getRuntime().database.transaction(callback) },
}
export default database

type Fields = Record<string, unknown>
function safe(fields: Fields): Fields {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key,
    /password|secret|token|authorization|cookie|api.?key/i.test(key) ? '[REDACTED]'
      : value instanceof Error ? { name: value.name, message: value.message }
        : Array.isArray(value) ? value.map(item => item && typeof item === 'object' ? safe(item as Fields) : item)
          : value && typeof value === 'object' ? safe(value as Fields) : value,
  ]))
}
function logger(base: Fields = {}) {
  function emit(level: string, fields: Fields | string, message?: string) {
    console.log(JSON.stringify({ level, ...safe(base), ...(typeof fields === 'string' ? {} : safe(fields)), message: typeof fields === 'string' ? fields : message }))
  }
  return {
    child(fields: Fields) { return logger({ ...base, ...fields }) },
    info(fields: Fields | string, message?: string) { emit('info', fields, message) },
    warn(fields: Fields | string, message?: string) { emit('warn', fields, message) },
    error(fields: Fields | string, message?: string) { emit('error', fields, message) },
    debug(fields: Fields | string, message?: string) { emit('debug', fields, message) },
  }
}
export default logger()

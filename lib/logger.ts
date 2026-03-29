import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.LOG_PRETTY === 'true' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
})

export default logger

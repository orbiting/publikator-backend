const PgDb = require('./lib/pgdb')
const express = require('express')
const cors = require('cors')
const { createServer } = require('http')

const DEV = process.env.NODE_ENV && process.env.NODE_ENV !== 'production'
if (DEV) {
  require('dotenv').config()
}

process.env.PORT = process.env.PORT || 3004

const {
  PORT,
  CORS_WHITELIST_URL,
  SESSION_SECRET,
  COOKIE_DOMAIN
} = process.env

const auth = require('./src/auth')
const graphql = require('./graphql')
const githubAuth = require('./src/githubAuth')
const assets = require('./src/assets')

let pgdb
let server
let httpServer
module.exports.run = () => {
  return PgDb.connect().then((_pgdb) => {
    pgdb = _pgdb
    server = express()
    httpServer = createServer(server)

    // Once DB is available, setup sessions and routes for authentication
    auth.configure({
      server: server,
      secret: SESSION_SECRET,
      domain: COOKIE_DOMAIN || undefined,
      dev: DEV,
      pgdb: pgdb
    })

    if (CORS_WHITELIST_URL) {
      const corsOptions = {
        origin: CORS_WHITELIST_URL.split(','),
        credentials: true,
        optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
      }
      server.use('*', cors(corsOptions))
    }

    githubAuth(server, pgdb)
    graphql(server, pgdb, httpServer)
    assets(server)

    // start the server
    httpServer.listen(PORT, () => {
      console.info('server is running on http://localhost:' + PORT)
    })

    return { pgdb }
  })
}

module.exports.close = () => {
  httpServer.close()
  pgdb.close()
  require('./lib/redis').quit()
  const { pubsub } = require('./lib/RedisPubSub')
  pubsub.getSubscriber().quit()
  pubsub.getPublisher().quit()
}
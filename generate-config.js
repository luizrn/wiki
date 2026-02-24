const fs = require('fs')

const dbSsl = process.env.DB_SSL === 'true' ? '\n    rejectUnauthorized: false' : 'false'
const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase()
const dbPort = process.env.DB_PORT || (
  dbType === 'postgres' ? 5432 :
    (dbType === 'mssql' ? 1433 : 3306)
)
const dbName = process.env.DB_NAME || (dbType === 'postgres' ? 'postgres' : 'wiki')

const config = `port: 3000
bindIP: 0.0.0.0
db:
  type: ${dbType}
  host: ${process.env.DB_HOST || 'db'}
  port: ${dbPort}
  user: '${process.env.DB_USER}'
  pass: '${process.env.DB_PASS}'
  db: ${dbName}
  ssl: ${dbSsl}
`

try {
  fs.writeFileSync('config.yml', config)
  console.log('--- EasyPanel config.yml created dynamically ---')
} catch (err) {
  console.error('Failed to create config.yml:', err)
  process.exit(1)
}

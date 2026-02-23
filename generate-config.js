const fs = require('fs');

const dbSsl = process.env.DB_SSL === 'true' ? '\n    rejectUnauthorized: false' : 'false';

const config = `port: 3000
bindIP: 0.0.0.0
db:
  type: ${process.env.DB_TYPE || 'postgres'}
  host: ${process.env.DB_HOST || 'db'}
  port: ${process.env.DB_PORT || 5432}
  user: '${process.env.DB_USER}'
  pass: '${process.env.DB_PASS}'
  db: ${process.env.DB_NAME || 'postgres'}
  ssl: ${dbSsl}
`;

try {
  fs.writeFileSync('config.yml', config);
  console.log('--- EasyPanel config.yml created dynamically ---');
} catch (err) {
  console.error('Failed to create config.yml:', err);
  process.exit(1);
}

const fs = require('fs')
const { spawn } = require('child_process')

fs.writeFileSync('config.yml', `port: 3000\nbindIP: 0.0.0.0\ndb:\n  type: sqlite\n  storage: ./data/runtime-validation.sqlite\n`)

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function requestGQL(query, variables = null, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch('http://127.0.0.1:3000/graphql', {
    method: 'POST', headers,
    body: JSON.stringify({ query, variables })
  })
  return res.json()
}

async function waitHttp() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch('http://127.0.0.1:3000/')
      if (r.status >= 200) return
    } catch {}
    await sleep(1000)
  }
  throw new Error('Server not ready')
}

async function main() {
  const child = spawn('node', ['server'], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  let err = ''
  child.stdout.on('data', d => { out += d.toString() })
  child.stderr.on('data', d => { err += d.toString() })

  try {
    await waitHttp()

    const root = await (await fetch('http://127.0.0.1:3000/')).text()
    if (/setup|Finalize/i.test(root)) {
      const finalize = await fetch('http://127.0.0.1:3000/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: 'http://127.0.0.1:3000',
          adminEmail: 'admin@example.com',
          adminPassword: 'Admin@123456',
          telemetry: false
        })
      })
      await finalize.text()
      await sleep(3000)
    }

    const results = []

    const active = await requestGQL('query { authentication { activeStrategies(enabledOnly: true) { key displayName isEnabled } } }')
    results.push({ test: 'activeStrategies', ok: !active.errors })

    const login = await requestGQL(
      'mutation ($username: String!, $password: String!, $strategy: String!) { authentication { login(username: $username, password: $password, strategy: $strategy) { responseResult { succeeded message } jwt } } }',
      { username: 'admin@example.com', password: 'Admin@123456', strategy: 'local' }
    )
    const token = login?.data?.authentication?.login?.jwt
    const loginOk = !login.errors && login?.data?.authentication?.login?.responseResult?.succeeded && token
    results.push({ test: 'login', ok: !!loginOk })
    if (!loginOk) throw new Error('Login failed: ' + JSON.stringify(login))

    const chatUsers = await requestGQL('query { chat { users { id name email isOnline } } }', null, token)
    results.push({ test: 'chat.users', ok: !chatUsers.errors })

    const chatStatus = await requestGQL('mutation { chat { updateStatus { responseResult { succeeded message } } } }', null, token)
    results.push({ test: 'chat.updateStatus', ok: !chatStatus.errors && !!chatStatus?.data?.chat?.updateStatus?.responseResult?.succeeded })

    const notif = await requestGQL('query { pageNotifications { myUnreadCount } }', null, token)
    results.push({ test: 'pageNotifications.myUnreadCount', ok: !notif.errors })

    const pub = await requestGQL('query { publicLinks { list(status:"PENDING") { id status token } } }', null, token)
    results.push({ test: 'publicLinks.list(PENDING)', ok: !pub.errors })

    const dash = await requestGQL('query { dashboard { overview { summary { totalArticles totalUsers totalVisits } } } }', null, token)
    results.push({ test: 'dashboard.overview', ok: !dash.errors })

    const upd = await requestGQL('query { tbdcUpdates { listUpdates(limit: 5) { total items { id title } } } }', null, token)
    results.push({ test: 'tbdcUpdates.listUpdates', ok: !upd.errors })

    console.log('RUNTIME_GQL_RESULTS_START')
    for (const r of results) console.log(`${r.test}: ${r.ok ? 'OK' : 'FAIL'}`)
    const failed = results.filter(r => !r.ok)
    if (failed.length) console.log('RUNTIME_GQL_FAILED', JSON.stringify(failed))
    console.log('RUNTIME_GQL_RESULTS_END')
  } finally {
    child.kill('SIGTERM')
    await sleep(1000)
    if (!child.killed) child.kill('SIGKILL')
  }
}

main().catch(err => {
  console.error('RUNTIME_GQL_ERROR', err.message)
  process.exit(1)
})

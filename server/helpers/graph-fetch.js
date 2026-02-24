const _ = require('lodash')

module.exports = async ({ query, variables = {} }) => {
  const endpoint = _.get(global.WIKI, 'config.graphEndpoint')
  if (!endpoint) {
    throw new Error('Graph endpoint is not configured.')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      variables
    })
  })

  if (!response.ok) {
    throw new Error(`Graph request failed with status ${response.status}`)
  }

  return response.json()
}

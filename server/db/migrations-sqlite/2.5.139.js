exports.up = async () => {
  // MySQL compatibility migration for webhooks (2.5.139) is not needed for SQLite.
}

exports.down = async () => {
  // no-op
}

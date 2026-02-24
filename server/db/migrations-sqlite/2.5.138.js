exports.up = async () => {
  // MySQL fulltext migration (2.5.138) does not apply to SQLite.
}

exports.down = async () => {
  // no-op
}

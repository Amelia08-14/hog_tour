require('dotenv').config()

const { createStartedApp } = require('./app')

function start() {
  const port = Number(process.env.PORT) || 4000;
  return createStartedApp().then(app =>
    app.listen(port, () => {
      process.stdout.write(`HOG Tour backend listening on http://localhost:${port}\n`)
    }),
  )
}

module.exports = { start };

if (require.main === module) {
  start();
}

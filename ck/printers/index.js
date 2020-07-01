const Spinnies = require('spinnies')
const { isInTesting } = require('../meta/index')

const spinner = {
  interval: 80,
  frames: [
    '⠋',
    '⠙',
    '⠹',
    '⠸',
    '⠼',
    '⠴',
    '⠦',
    '⠧',
    '⠇',
    '⠏',
  ],
}

const spinnies = new Spinnies({ color: 'white', succeedColor: 'white', spinner: spinner });

// For visual consistency, use same coloring for spinners & console.logs
spinnies.justPrintSuccess = (text) => {
  const unique = Math.ceil(Math.random() * 1000)
  spinnies.add(unique)
  spinnies.succeed(unique, { text: text })
}

spinnies.justPrintFail = (text) => {
  const unique = Math.ceil(Math.random() * 1000)
  spinnies.add(unique)
  spinnies.fail(unique, { text: text })
}

// In testing, be silent
if (isInTesting() === true) {
  spinnies.justPrintSuccess = () => {}
  spinnies.justPrintFail = () => {}
  spinnies.add = () => {}
  spinnies.update = () => {}
  spinnies.updateSpinnerState = () => {}
}

module.exports = {
  spinnies,
}

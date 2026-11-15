require('./env');
const { setup } = require('../db/setup');

// Recreate the test database from scratch before the suite runs.
module.exports = async () => {
  await setup({ reset: true, quiet: true });
};

module.exports = {
  apps: [{
    name: 'chief',
    script: 'npm',
    args: 'start -- -p 3001',
    cwd: '/Users/davidjones/projects/chiefvoice-app',
    env: {
      NODE_ENV: 'production',
      CHIEFVOICE_GATEWAY_TOKEN: '824d0bd233b88eb56be1e11d58b23de26bad3b777ec1faf0',
      CHIEFVOICE_GATEWAY_URL: 'ws://localhost:18789',
    },
    // Don't inherit env from parent
    filter_env: ['CHIEFVOICE_GATEWAY_TOKEN', 'CHIEFVOICE_GATEWAY_URL'],
  }]
};

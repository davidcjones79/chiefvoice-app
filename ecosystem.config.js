module.exports = {
  apps: [{
    name: 'chief',
    script: 'npm',
    args: 'start -- -p 3001',
    cwd: '/Users/davidjones/projects/chiefvoice-app',
    env: {
      NODE_ENV: 'production',
      CHIEFVOICE_GATEWAY_TOKEN: '26b0ec0c4bcdbc2cf09c04890d88c46808e37fa5fb40d36caa6f988266ccd1c1',
      CHIEFVOICE_GATEWAY_URL: 'ws://localhost:18789',
    },
    // Don't inherit env from parent
    filter_env: ['CHIEFVOICE_GATEWAY_TOKEN', 'CHIEFVOICE_GATEWAY_URL'],
  }]
};

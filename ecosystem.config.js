module.exports = {
  apps: [
    {
      name: 'kenya-bar-exam-prep',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};

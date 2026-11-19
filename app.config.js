module.exports = ({ config }) => {
  if (process.env.MICROHUB_GITHUB_PAGES !== '1') return config;

  return {
    ...config,
    experiments: { ...config.experiments, baseUrl: '/MicroHub' },
    web: { ...config.web, output: 'single' },
  };
};

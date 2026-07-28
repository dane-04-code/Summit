module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    [
      'react-native-auth0',
      {
        domain: process.env.EXPO_PUBLIC_AUTH0_DOMAIN || 'configure.auth0.com',
      },
    ],
  ],
});

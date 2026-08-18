const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Tell Metro to completely ignore the locked 'app' folder
config.resolver.blockList = [
  ...config.resolver.blockList,
  /\/app\/.*/,
];

module.exports = config;
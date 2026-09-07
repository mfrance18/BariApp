// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// drizzle-orm's Expo SQLite migrator imports generated .sql files directly.
config.resolver.sourceExts.push('sql');

module.exports = config;

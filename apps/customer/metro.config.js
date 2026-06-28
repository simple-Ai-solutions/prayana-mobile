const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Explicitly set project root so Metro resolves from the customer app, not monorepo root
config.projectRoot = projectRoot;

// Only watch shared packages + root node_modules (NOT entire monorepo — avoids scanning android/ios/vendor builds)
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Exclude heavy native build dirs and other apps from bundling
config.resolver.blockList = [
  /apps\/customer\/android\/.*/,
  /apps\/customer\/ios\/.*/,
  /apps\/vendor\/.*/,
];

// Follow symlinks so workspace packages resolve correctly
config.resolver.unstable_enableSymlinks = true;

module.exports = config;

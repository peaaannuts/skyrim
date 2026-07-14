const path = require('path');

// Bundle src/index.ts into a single build/jp-subtitle.js.
// skyrimPlatform is provided by Skyrim Platform at runtime, so it is externalized
// (required, not bundled). Deployment into the MO2 mod folder is done separately.
module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  entry: './src/index.ts',
  output: { path: path.resolve(__dirname, 'build'), filename: 'jp-subtitle.js' },
  resolve: { extensions: ['.ts', '.tsx', '.js', '.jsx'] },
  externals: {
    '@skyrim-platform/skyrim-platform': ['skyrimPlatform'],
    'skyrimPlatform': ['skyrimPlatform']
  },
  module: {
    rules: [{ test: /\.tsx?$/, loader: 'ts-loader', options: { configFile: 'tsconfig.json' } }]
  }
};

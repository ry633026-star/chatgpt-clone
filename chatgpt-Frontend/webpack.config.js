const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',

  entry: './src/index.web.tsx',

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },

  resolve: {
    extensions: [
      '.web.tsx',
      '.tsx',
      '.web.ts',
      '.ts',
      '.web.js',
      '.js',
    ],

    alias: {
      'react-native$': 'react-native-web',
    },
  },

  module: {
    rules: [
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './web/index.html',
    }),
  ],

  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
  },
};
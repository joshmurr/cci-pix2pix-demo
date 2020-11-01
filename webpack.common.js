const path = require('path');
//const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
//require('dotenv').config();

//const devMode = process.env.NODE_ENV === 'development';

module.exports = {
  //mode: devMode ? 'development' : 'production',
  entry: './src/index.js',
  output: {
    filename: '[name].[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
  },
  //devtool: 'inline-source-map',
  //devServer: {
  //contentBase: './dist',
  //},
  plugins: [
    //new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      inject: true,
      title: 'Pix2Pix Demo',
      template: 'src/index.html',
    }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /[\\/]node_modules[\\/]/,
        include: path.resolve(__dirname, 'src'),
        loader: 'babel-loader',
      },
      //{

      //test: /\.s(a|c)ss$/,
      //use: [
      //devMode ? 'style-loader' : MiniCssExtractPlugin.loader,
      //'css-loader',
      //{
      //loader: 'sass-loader',
      //options: {
      //sourceMap: devMode,
      //},
      //},
      //],

      //},

      {
        test: /\.(json|bin)$/i,
        use: ['file-loader'],
      },
    ],
  },
};

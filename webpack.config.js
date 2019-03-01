const path = require('path');

/* NOTES:
- When building for production I get "ModuleConcatenation bailout" messages because I'm not writing ES6 javascript, so at some point it may be worthwhile converting the code to ES6 in order to improve optimisation.

- The 'bail' true and 'optimizationBailout' true settings don't alter the output, whereas I thought the first ModuleConcatenation bailout should halt webpack, and I should get more info on what caused the bailout.
*/

module.exports = {
  entry: './src/index-web.js',
  bail: true,
  stats: {
    // Examine all modules
    maxModules: Infinity,
    // Display bailout reasons
    optimizationBailout: true
  },

module: {
  rules: [
    {
      test: /\.js$/,
      exclude: /node_modules/
    }
  ],
},
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'safenetworkjs.js',
    library: 'Safenetworkjs',
    libraryTarget: 'umd'
  },
  devtool: '#source-map', // #eval-source-map doesn't emit a map!?
  target: 'web', // default!
};

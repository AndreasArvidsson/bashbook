const path = require("path");

module.exports = {
  entry: "./src/renderer/renderer.ts",
  output: {
    path: path.resolve(__dirname, "out"),
    filename: "renderer.js",
    libraryTarget: "module",
  },
  experiments: {
    outputModule: true,
  },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: path.resolve(__dirname, "src/renderer/tsconfig.json"),
              projectReferences: true,
            },
          },
        ],
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
};

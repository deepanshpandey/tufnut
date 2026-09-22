const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

/** @type {import('webpack').Configuration} */
module.exports = {
  entry: {
    // Background service worker
    "background/service-worker": "./src/background/service-worker.ts",

    // Content script injected into web pages
    "content/index": "./src/content/index.ts",

    // Side panel React app
    "sidepanel/sidepanel": "./src/sidepanel/index.tsx",
  },

  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },

  // Chrome extensions are loaded locally — the 244 KiB web-perf limit doesn't apply
  performance: { hints: false },

  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },

  plugins: [
    new CopyPlugin({
      patterns: [
        // Static assets that don't go through webpack
        { from: "src/manifest.json", to: "manifest.json" },
        { from: "src/sidepanel/sidepanel.html", to: "sidepanel/sidepanel.html" },
        { from: "src/icons", to: "icons" },
      ],
    }),
  ],
};

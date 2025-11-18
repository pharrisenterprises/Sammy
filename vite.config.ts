import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createHtmlPlugin } from "vite-plugin-html";
import { viteStaticCopy } from "vite-plugin-static-copy";
 
export default defineConfig({
  plugins: [
    react(),
    createHtmlPlugin({
      minify: true,
      pages: [
        {
          entry: "../src/main.tsx",
          filename: "index.html",
          template: "public/index.html",
        },
        {
          entry: "../src/main.tsx",
          filename: "popup.html",
          template: "public/popup.html",
        },
        {
          entry: "../src/main.tsx",
          filename: "pages.html",
          template: "public/pages.html",
        },
      ],
    }),
    viteStaticCopy({
      targets: [],
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    sourcemap: true, 
    minify: "terser",
    terserOptions: {
      keep_classnames: true,
      keep_fnames: true,
    },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "src/main.tsx"),
        interceptor: path.resolve(__dirname, "src/contentScript/page-interceptor.tsx"),
        replay: path.resolve(__dirname, "src/contentScript/replay.ts"),
      },
      output: {
        assetFileNames: (assetInfo) => {
          if (/\.css$/.test(assetInfo.name)) {
            return "css/[name][extname]";
          }
          if (/\.woff2?$/.test(assetInfo.name)) {
            return "fonts/[name][extname]";
          }
          if (/\.(png|jpe?g|gif|svg)$/.test(assetInfo.name)) {
            return "images/[name][extname]";
          }
          return "[name][extname]";
        },
        chunkFileNames: "js/[name].js",
        entryFileNames: "js/[name].js",
      },
    },
  },
  esbuild: {
    keepNames: true,
  },
  resolve: {
    alias: {
      "@assets": path.resolve(__dirname, "src/assets"),
    },
  },
});
 
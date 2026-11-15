import { defineConfig } from "vite";

// 相対パスで出力し、GitHub Pages の /element-quiz/ 配下でもそのまま動くようにする
export default defineConfig({
  base: "./",
});

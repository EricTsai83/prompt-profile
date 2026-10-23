import { readFileSync } from "node:fs"
import { defineConfig } from "tsdown"

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string
}

export default defineConfig({
  entry: ["src/bin.ts"],
  format: "esm",
  outDir: "dist",
  platform: "node",
  target: "node22",
  clean: true,
  outExtensions: () => ({ js: ".js" }),
  banner: { js: "#!/usr/bin/env node" },
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
})

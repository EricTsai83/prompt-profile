import { existsSync, readdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { defineConfig } from "tsdown"

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string
}

export default defineConfig({
  entry: ["src/bin.ts"],
  format: "esm",
  outDir: "dist",
  platform: "node",
  target: "node24",
  clean: true,
  minify: true,
  deps: { alwaysBundle: [/.*/], onlyBundle: false },
  plugins: [
    {
      name: "third-party-notices",
      generateBundle(_options, bundle) {
        const packages = new Map<string, string>()
        const ids = Object.values(bundle).flatMap((output) =>
          output.type === "chunk"
            ? Object.entries(output.modules)
                .filter(([, module]) => module.renderedLength > 0)
                .map(([id]) => id)
            : [],
        )
        for (const id of ids) {
          if (!id.includes("node_modules/")) continue
          let dir = dirname(id)
          while (!existsSync(join(dir, "package.json"))) {
            const parent = dirname(dir)
            if (parent === dir) throw new Error(`Cannot locate package for ${id}`)
            dir = parent
          }
          const metadata = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
          const name = `${metadata.name}@${metadata.version}`
          if (packages.has(name)) continue
          const licenses = readdirSync(dir).filter((file) =>
            /^(licen[cs]e|copying|notice)([.-]|$)/i.test(file),
          )
          // The resvg npm archive omits its MPL text; retain it locally.
          if (
            licenses.length === 0 &&
            metadata.name !== "@resvg/resvg-wasm" &&
            !(metadata.license === "MIT" && metadata.author)
          ) {
            throw new Error(`Missing license for ${name}`)
          }
          packages.set(
            name,
            [
              name,
              `License: ${metadata.license}`,
              `Source: https://www.npmjs.com/package/${metadata.name}/v/${metadata.version}`,
              ...(licenses.length > 0
                ? licenses.map((file) => readFileSync(join(dir, file), "utf8"))
                : metadata.license === "MIT"
                  ? [
                      readFileSync(new URL("./LICENSE", import.meta.url), "utf8").replace(
                        /Copyright[^\n]*/,
                        `Copyright (c) ${typeof metadata.author === "string" ? metadata.author : metadata.author.name}`,
                      ),
                    ]
                  : [
                      readFileSync(
                        new URL("./scripts/licenses/MPL-2.0.txt", import.meta.url),
                        "utf8",
                      ),
                      readFileSync(join(dir, "README.md"), "utf8"),
                    ]),
              ...(metadata.name === "satori"
                ? ["MPL source: https://github.com/vercel/satori/tree/v" + metadata.version]
                : []),
              ...(metadata.name === "@resvg/resvg-wasm"
                ? ["MPL source: https://github.com/yisibl/resvg-js/tree/v" + metadata.version]
                : []),
            ].join("\n\n"),
          )
        }
        this.emitFile({
          type: "asset",
          fileName: "THIRD-PARTY-NOTICES.txt",
          source: [...packages.entries()]
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([, notice]) => notice)
            .join("\n\n---\n\n"),
        })
      },
    },
  ],
  outExtensions: () => ({ js: ".js" }),
  banner: { js: "#!/usr/bin/env node" },
  // read at runtime relative to dist/bin.js (see analysis/prompts.ts, report/fonts.ts)
  copy: [
    { from: "src/analysis/prompts", to: "dist" },
    { from: "src/report/fonts", to: "dist" },
    { from: createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm"), to: "dist" },
  ],
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
    __BUNDLED_WASM__: "true",
  },
})

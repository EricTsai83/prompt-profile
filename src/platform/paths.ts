import type { Path } from "effect"

/**
 * The app's cache folder (analysis results and downloaded fonts):
 * `$XDG_CACHE_HOME/prompt-profile`, else `~/.cache/prompt-profile` (macOS too).
 */
export const resolveCacheDir = (
  env: Readonly<Record<string, string | undefined>>,
  home: string,
  path: Pick<Path.Path, "join">,
): string => path.join(env["XDG_CACHE_HOME"] || path.join(home, ".cache"), "prompt-profile")

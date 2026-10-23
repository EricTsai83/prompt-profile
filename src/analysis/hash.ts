import { createHash } from "node:crypto"

export const sha256 = (...parts: ReadonlyArray<string>): string => {
  const h = createHash("sha256")
  for (const p of parts) h.update(p).update("\u0000")
  return h.digest("hex")
}

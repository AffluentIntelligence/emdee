import path from "node:path";
import { SupabaseStorage } from "./SupabaseStorage";
import { FilesystemStorage } from "./FilesystemStorage";
import type { VaultStorage } from "./VaultStorage";

export type { VaultStorage, VaultFile } from "./VaultStorage";
export { SupabaseStorage } from "./SupabaseStorage";
export { FilesystemStorage } from "./FilesystemStorage";

/**
 * Resolve the active vault storage based on the environment.
 *
 * - **Local dev** (`EMDEE_DOCS` set): every namespace maps to the same
 *   on-disk folder, so the dev server reads/writes ./docs directly. The
 *   {userId} in URLs is ignored — there's one local vault.
 * - **Cloud** (no `EMDEE_DOCS`): SupabaseStorage scoped to `{ns}/`, so
 *   each Clerk user has an isolated namespace inside the `vaults` bucket.
 *
 * Returns the storage, the path-prefix to prepend to relative paths, and
 * a flag callers can use to skip auth gates / namespace checks in local
 * mode (the filesystem is single-tenant by definition).
 */
export function getVaultStorage(ns: string): {
  storage: VaultStorage;
  prefix: string;
  isLocal: boolean;
} {
  const docsDir = process.env.EMDEE_DOCS;
  if (docsDir) {
    return {
      storage: new FilesystemStorage(path.resolve(docsDir)),
      prefix: "",
      isLocal: true,
    };
  }
  return {
    storage: new SupabaseStorage(),
    prefix: `${ns}/`,
    isLocal: false,
  };
}

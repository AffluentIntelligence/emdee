import path from "node:path";
import { buildIndex } from "../src/core/indexer.js";

export default async function handler(_req: unknown, res: any) {
  const docsDir = process.env.SILENT_MANE_DOCS ?? path.resolve(process.cwd(), "docs");
  const index = await buildIndex(docsDir);
  res.setHeader("content-type", "application/json");
  res.status(200).send(JSON.stringify(index));
}

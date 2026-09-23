import { readFile } from "node:fs/promises";
import path from "node:path";

const officialAssetPattern = /^\/exam-assets\/2025-03-02\/[a-z0-9-]+\.png$/;

export async function loadOfficialQuestionImage(imageUrl: string): Promise<string> {
  if (!officialAssetPattern.test(imageUrl)) throw new Error("Unrecognized official question image path");
  const bytes = await readFile(path.join(process.cwd(), "public", imageUrl.slice(1)));
  if (bytes.length > 5_000_000) throw new Error("Official question image is too large");
  return bytes.toString("base64");
}

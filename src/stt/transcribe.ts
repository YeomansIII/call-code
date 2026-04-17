import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const BINARY = join(__dirname, "transcribe");

export async function transcribe(audioFilePath: string): Promise<string> {
  const { stdout } = await execFileAsync(BINARY, [audioFilePath], {
    timeout: 15_000,
  });
  return stdout.trim();
}

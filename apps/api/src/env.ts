import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Environment = Readonly<Record<string, string | undefined>>;

/**
 * `.env.<mod>` dosyasını okur. Mod, süreç ortamındaki `KASA_MODE`'dan gelir (varsayılan
 * simulation); dosyanın içindeki `KASA_MODE` ile çelişirse açılışta durur — iki farklı
 * doğruluk kaynağı en tehlikeli ortam hatasıdır.
 */
export function loadEnvironment(processEnvironment: Environment = process.env): Environment {
  const mode = processEnvironment.KASA_MODE ?? "simulation";
  const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const file = path.join(workspace, `.env.${mode}`);
  const parsed = parseEnvironment(readFileSync(file, "utf8"));
  if (parsed.KASA_MODE !== undefined && parsed.KASA_MODE !== mode) {
    throw new Error(`.env.${mode} içindeki KASA_MODE (${parsed.KASA_MODE}) dosya adıyla çelişiyor.`);
  }
  return { ...parsed, KASA_MODE: mode };
}

/** `KEY=value` satırlarını ayrıştırır; yorum ve boş satırları atlar, değerleri kırpmaz. */
export function parseEnvironment(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/u)) {
    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line);
    if (match?.[1] && match[2] !== undefined && match[2] !== "") result[match[1]] = match[2];
  }
  return result;
}

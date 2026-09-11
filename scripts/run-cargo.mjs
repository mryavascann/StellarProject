import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

/** Windows kullanıcı dizininin Unicode bölümünü ASCII 8.3 adıyla değiştirir. */
function asciiUserPath(input, userProfile) {
  const parent = path.dirname(userProfile);
  const username = path.basename(userProfile);
  const listing = execFileSync("cmd.exe", ["/d", "/c", "dir", "/x", parent], {
    encoding: "utf8",
  });
  const row = listing
    .split(/\r?\n/u)
    .find((line) => line.trimEnd().endsWith(` ${username}`));
  const shortName = row?.trim().split(/\s+/u).at(-2);
  if (!shortName?.includes("~")) {
    throw new Error(`8.3 kullanıcı yolu bulunamadı: ${userProfile}`);
  }
  return path.join(parent, shortName, path.relative(userProfile, input));
}

/** Cargo ortamını hazırlar; ASCII dışı Windows yollarında linker bozulmasını önler. */
function cargoEnvironment() {
  const env = { ...process.env };
  if (process.platform !== "win32") return env;

  if (/[^\x00-\x7F]/u.test(process.cwd())) {
    const targetDirectory = path.join(path.parse(process.cwd()).root, "temp", "kasa-cargo-target");
    mkdirSync(targetDirectory, { recursive: true });
    env.CARGO_TARGET_DIR = env.CARGO_TARGET_DIR ?? targetDirectory;
  }

  const asciiToolchain = "C:\\rust\\rustup\\toolchains\\stable-x86_64-pc-windows-gnu";
  const asciiBin = path.join(asciiToolchain, "bin");
  if (existsSync(path.join(asciiBin, "cargo.exe"))) {
    env.PATH = `${asciiBin};${env.PATH ?? ""}`;
    return env;
  }

  const sysroot = execFileSync("rustc", ["--print", "sysroot"], {
    encoding: "utf8",
  }).trim();
  if (/^[\x00-\x7F]*$/.test(`${sysroot}${process.cwd()}`)) return env;

  const userProfile = env.USERPROFILE;
  if (!userProfile || !sysroot.toLocaleLowerCase().startsWith(userProfile.toLocaleLowerCase())) {
    throw new Error(`Rust sysroot kullanıcı dizininin dışında: ${sysroot}`);
  }
  const asciiSysroot = asciiUserPath(sysroot, userProfile);
  env.RUSTFLAGS = `${env.RUSTFLAGS ?? ""} --sysroot=${asciiSysroot}`.trim();
  return env;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  throw new Error("Cargo alt komutu gerekli.");
}

const contractBuild = args[0] === "contract-build";
const command = "cargo";
const commandArgs = contractBuild
  ? [
      "rustc",
      ...args.slice(1),
      "--crate-type=cdylib",
      "--target=wasm32v1-none",
      "--release",
    ]
  : args;
const env = cargoEnvironment();
if (contractBuild) env.SOROBAN_SDK_BUILD_SYSTEM_SUPPORTS_SPEC_SHAKING_V2 = "1";
const result = spawnSync(command, commandArgs, {
  env,
  stdio: "inherit",
  shell: false,
});

if (result.error) throw result.error;
if (contractBuild && result.status === 0 && env.CARGO_TARGET_DIR) {
  const artifact = path.join(
    env.CARGO_TARGET_DIR,
    "wasm32v1-none",
    "release",
    "shared_vault.wasm",
  );
  const outputDirectory = path.join(
    process.cwd(),
    "contracts",
    "shared-vault",
    "target",
    "wasm32v1-none",
    "release",
  );
  mkdirSync(outputDirectory, { recursive: true });
  copyFileSync(artifact, path.join(outputDirectory, "shared_vault.wasm"));
}
process.exit(result.status ?? 1);

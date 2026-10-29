import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
await mkdir("analyzer", { recursive: true });

// Keep submitted source next to dist for integrity checks without adding source
// or symlinks to deployable metadata. Always discard this isolated scan copy.
const staging = await mkdtemp(join(tmpdir(), "better-files-scan-"));
try {
  const bundle = join(staging, "betterFiles");
  await cp("force-app/main/default/uiBundles/betterFiles", bundle, {
    recursive: true
  });
  // Sourcemaps normalize to react/src/..., so preserve that repository path
  // inside the analyzer's required sibling source directory.
  await cp("react/src", join(bundle, "src/react/src"), { recursive: true });
  const scans = [
    {
      name: "source",
      args: [
        "--workspace", root,
        "--target", "force-app/main/default",
        "--target", "react/src",
        "--config-file", "config/code-analyzer-source.yml",
        "--rule-selector", "Recommended",
        "--rule-selector", "AppExchange"
      ]
    },
    {
      name: "uibundle",
      args: [
        "--workspace", staging,
        "--target", bundle,
        "--config-file", join(root, "config/code-analyzer-bundle.yml"),
        "--rule-selector", "uibundle",
        "--rule-selector", "retire-js:Recommended"
      ]
    }
  ];

  for (const { name, args } of scans) {
    const report = join(root, "analyzer", `${name}-results.json`);
    const result = spawnSync("sf", [
      "code-analyzer", "run", ...args,
      "--severity-threshold", "2",
      "--output-file", report,
      "--output-file", join(root, "analyzer", `${name}-report.html`)
    ], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = 1;

    // Analyzer can return zero even when an engine cannot parse a file or skips
    // source-integrity checks. Such a run must not produce a green CI result.
    const output = `${result.stdout}\n${result.stderr}`;
    if (/Error: (?:Engine|Code Analyzer)|Skipping (?:source-content-verification|structural-coherence|token-consistency)/i.test(output)) {
      process.exitCode = 1;
    }
    const { violationCounts } = JSON.parse(await readFile(report, "utf8"));
    console.log(`${name}: ${violationCounts.total} findings. Report: ${report}`);
  }
} finally {
  await rm(staging, { recursive: true, force: true });
}

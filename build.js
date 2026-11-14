const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const projectRoot = __dirname;
const sourceDir = path.join(projectRoot, "src");
const outputDir = path.join(projectRoot, "build");

function findJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) return findJavaScriptFiles(filePath);
    return entry.isFile() && entry.name.endsWith(".js") ? [filePath] : [];
  });
}

fs.rmSync(outputDir, { recursive: true, force: true });

esbuild.buildSync({
  entryPoints: findJavaScriptFiles(sourceDir),
  outdir: outputDir,
  outbase: sourceDir,
  platform: "node",
  format: "cjs",
});

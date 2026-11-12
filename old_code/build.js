const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

function findJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? findJavaScriptFiles(filePath) : filePath.endsWith(".js") ? [filePath] : [];
  });
}

fs.rmSync("build", { recursive: true, force: true });

esbuild.buildSync({
  entryPoints: findJavaScriptFiles("src"),
  outdir: "build",
  outbase: "src",
  platform: "node",
  format: "cjs",
});

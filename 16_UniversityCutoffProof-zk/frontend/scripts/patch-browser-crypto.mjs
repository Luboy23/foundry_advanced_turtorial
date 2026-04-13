import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const patches = [
  {
    file: path.join(projectRoot, "node_modules/snarkjs/build/browser.esm.js"),
    from: "from 'ffjavascript';",
    to: "from '../node_modules/ffjavascript/build/browser.esm.js';"
  }
];

for (const patch of patches) {
  if (!fs.existsSync(patch.file)) {
    continue;
  }

  const source = fs.readFileSync(patch.file, "utf8");
  if (source.includes(patch.to)) {
    continue;
  }
  if (!source.includes(patch.from)) {
    throw new Error(`Unable to patch ${patch.file}: expected marker not found.`);
  }

  fs.writeFileSync(patch.file, source.replace(patch.from, patch.to), "utf8");
}

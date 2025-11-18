import fs from "fs";
import manifest from "../public/manifest.json" assert { type: "json" };

/**
 * readFile uses a Regex to filter, match, and return the static file based on
 * the `prefix` and `extension` in the directory based on the `path`.
 *
 * @param {string} path File path relative to the build directory - `'js'`
 * @param {string} prefix File prefix for the file name - `'index'`
 * @param {string} extension File extension - 'js'
 * @returns {string|null} File path or null if not found
 */
function readFile(path, prefix, extension) {
  const fullPath = `./dist/${path}`;

  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️ Directory missing: ${fullPath}`);
    return null;
  }

  const filePattern = new RegExp(`^${prefix}\\.${extension}$`);
  const files = fs
    .readdirSync(fullPath)
    .filter((filename) => filePattern.test(filename))
    .map((filename) => `${path}/${filename}`);

  if (files.length === 0) {
    console.warn(
      `⚠️ No ${extension} file found for prefix "${prefix}" in ${fullPath}`
    );
    return null;
  }

  console.log(`✅ Found ${extension}: ${files[0]}`);
  return files[0];
}

const js = readFile("js", "main", "js");
const css = readFile("css", "main", "css");

if (!js || !css) {
  console.error("❌ Build error: Required JS or CSS files missing.");
  process.exit(1);
}

const newManifest = {
  ...manifest,
  // content_scripts: [
  //   {
  //     matches: ["<all_urls>"],
  //     js: [js],
  //     match_about_blank: true,
  //     all_frames: true,
  //     run_at: "document_end",
  //   },
  // ],
};

fs.writeFileSync("./dist/manifest.json", JSON.stringify(newManifest, null, 2));
console.log("🎉 Manifest updated successfully!");

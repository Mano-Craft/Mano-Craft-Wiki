import fs from "node:fs";

const versionsFile = "project-versions.json";
const projectFiles = [
  ["creativetoggle", "Creative Toggle", "projects/creative-toggle.md"],
  ["emeraldsplus", "Emeralds Plus", "projects/emeralds-plus.md"],
  ["creative-toggle-default-texture-pack", "Creative Toggle Default Texture Pack", "projects/creative-toggle-default-texture-pack.md"],
  ["emeraldsplusdefaulttexturepack", "Emeralds Plus Default Texture Pack", "projects/emeralds-plus-default-texture-pack.md"],
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function normalizeListedVersions(value) {
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .filter(Boolean)
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" , ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceRequired(text, pattern, replacement, label) {
  if (!pattern.test(text)) throw new Error(`Could not find ${label}`);
  pattern.lastIndex = 0;
  return text.replace(pattern, replacement);
}

function updateProjectPage(file, latestVersion, listedVersions) {
  let text = fs.readFileSync(file, "utf8");
  text = replaceRequired(text, /(\|\s*Latest version\s*\|\s*)[^|]+(\s*\|)/, `$1${latestVersion}$2`, `${file} latest version`);
  text = replaceRequired(text, /(\|\s*Listed versions\s*\|\s*)[^|]+(\s*\|)/, `$1${listedVersions}$2`, `${file} listed versions`);
  text = text.replace(/(<p class="mc-changelog-version">Version\s*)[^<]+(<\/p>)/, `$1${latestVersion}$2`);
  fs.writeFileSync(file, text, "utf8");
}

function updateProjectsIndex(projectTitle, latestVersion) {
  const file = "projects/index.md";
  const title = escapeRegExp(projectTitle);
  let text = fs.readFileSync(file, "utf8");
  const pattern = new RegExp(`(<a href="[^"]+">${title}</a></td><td>[^<]*</td><td>[^<]*</td><td>)[^<]+(</td>)`);
  text = replaceRequired(text, pattern, `$1${latestVersion}$2`, `${file} ${projectTitle} latest version`);
  fs.writeFileSync(file, text, "utf8");
}

const versions = readJson(versionsFile);
let changed = 0;

for (const [key, title, file] of projectFiles) {
  const config = versions[key];
  if (!config) throw new Error(`Missing ${key} in ${versionsFile}`);

  const latestVersion = String(config.latestVersion || "").trim();
  const listedVersions = normalizeListedVersions(config.listedVersions);
  if (!latestVersion) throw new Error(`Missing latestVersion for ${key}`);
  if (!listedVersions) throw new Error(`Missing listedVersions for ${key}`);

  updateProjectPage(file, latestVersion, listedVersions);
  updateProjectsIndex(title, latestVersion);
  changed += 1;
}

console.log(`Updated versions from ${versionsFile} for ${changed} project page(s). No pages were regenerated.`);

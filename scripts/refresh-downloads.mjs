import fs from "node:fs";

const user = "Mano-Craft";
const dataFile = "mano_data.json";
const headers = {
  "User-Agent": "Mano-Craft-Wiki/1.0",
  "Accept": "application/json",
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeText(file, text) {
  fs.writeFileSync(file, text, "utf8");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function requestJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function replaceProjectDownloads(file, downloads) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  const after = before.replace(/(\|\s*Downloads\s*\|\s*)[^|]+(\s*\|)/, `$1${downloads}$2`);
  if (after === before) return false;
  writeText(file, after);
  return true;
}

function replaceReadmeCardDownloads(file, project, downloads) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  const title = escapeRegExp(project.title);
  const pattern = new RegExp(`(<strong>${title}</strong><small>[^<|]*\\|[^<|]*\\|\\s*)\\d+(\\s+downloads</small>)`);
  const after = before.replace(pattern, `$1${downloads}$2`);
  if (after === before) return false;
  writeText(file, after);
  return true;
}

function replaceProjectIndexDownloads(file, project, downloads) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  const slug = escapeRegExp(slugify(project.title));
  const title = escapeRegExp(project.title);
  const pattern = new RegExp(`(<a href="[^"]*/projects/${slug}/">${title}</a></td><td>[^<]*</td><td>[^<]*</td><td>[^<]*</td><td>)\\d+(</td>)`);
  const after = before.replace(pattern, `$1${downloads}$2`);
  if (after === before) return false;
  writeText(file, after);
  return true;
}

function replaceTotalDownloads(file, totalDownloads) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  const after = before.replace(/(\|\s*Total Modrinth downloads\s*\|\s*)[^|]+(\s*\|)/, `$1${totalDownloads}$2`);
  if (after === before) return false;
  writeText(file, after);
  return true;
}

async function main() {
  const data = readJson(dataFile);
  const entries = Array.isArray(data.modrinth) ? data.modrinth : [];
  const liveProjects = await requestJson(`https://api.modrinth.com/v2/user/${user}/projects`);
  const downloadsById = new Map(liveProjects.map((project) => [project.id, project.downloads]));
  const downloadsBySlug = new Map(liveProjects.map((project) => [project.slug, project.downloads]));

  let dataChanges = 0;
  let fileChanges = 0;

  for (const entry of entries) {
    const project = entry.project;
    if (!project) continue;

    const downloads = downloadsById.get(project.id) ?? downloadsBySlug.get(project.slug);
    if (typeof downloads !== "number") continue;

    if (project.downloads !== downloads) dataChanges += 1;
    project.downloads = downloads;

    if (replaceReadmeCardDownloads("README.md", project, downloads)) fileChanges += 1;
    if (replaceProjectIndexDownloads("projects/index.md", project, downloads)) fileChanges += 1;
    if (replaceProjectDownloads(`projects/${slugify(project.title)}.md`, downloads)) fileChanges += 1;
  }

  const totalDownloads = entries.reduce((sum, entry) => sum + Number(entry.project?.downloads || 0), 0);
  if (replaceTotalDownloads("README.md", totalDownloads)) fileChanges += 1;

  data.downloads_updated_at = new Date().toISOString();
  writeText(dataFile, `${JSON.stringify(data, null, 2)}\n`);

  console.log(`Updated Modrinth download counts only. Data changes: ${dataChanges}. Markdown file changes: ${fileChanges}.`);
}

await main();

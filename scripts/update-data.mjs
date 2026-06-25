import fs from "node:fs";

const user = "Mano-Craft";
const dataFile = "mano_data.json";
const headers = {
  "User-Agent": "Mano-Craft-Wiki/1.0",
  "Accept": "application/json",
};

async function requestJson(url, tries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < tries) await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message || lastError}`);
}

function readExistingData() {
  if (!fs.existsSync(dataFile)) {
    throw new Error(`${dataFile} is required because only download counts are refreshed online.`);
  }
  return JSON.parse(fs.readFileSync(dataFile, "utf8").replace(/^\uFEFF/, ""));
}

function projectEntries(data) {
  return Array.isArray(data.modrinth) ? data.modrinth : [];
}

async function main() {
  try {
    const data = readExistingData();
    const liveProjects = await requestJson(`https://api.modrinth.com/v2/user/${user}/projects`);
    const downloadsById = new Map(liveProjects.map((project) => [project.id, project.downloads]));
    const downloadsBySlug = new Map(liveProjects.map((project) => [project.slug, project.downloads]));
    let updated = 0;

    for (const entry of projectEntries(data)) {
      const project = entry.project;
      if (!project) continue;
      const liveDownloads = downloadsById.get(project.id) ?? downloadsBySlug.get(project.slug);
      if (typeof liveDownloads !== "number") continue;
      if (project.downloads !== liveDownloads) updated += 1;
      project.downloads = liveDownloads;
    }

    data.downloads_updated_at = new Date().toISOString();
    fs.writeFileSync(dataFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    console.log(`Updated download counts for ${updated} changed project(s). No version, changelog, README, repository, or license checks were performed.`);
  } catch (error) {
    if (fs.existsSync(dataFile)) {
      console.warn(`Download refresh failed, using existing ${dataFile}: ${error.message}`);
      return;
    }
    throw error;
  }
}

await main();

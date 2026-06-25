import fs from "node:fs";
import path from "node:path";

const data = JSON.parse(fs.readFileSync("mano_data.json", "utf8").replace(/^\uFEFF/, ""));
const projectVersions = fs.existsSync("project-versions.json")
  ? JSON.parse(fs.readFileSync("project-versions.json", "utf8").replace(/^\uFEFF/, ""))
  : {};

const cp1252 = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function cp1252Encode(text) {
  const bytes = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code <= 0xff) bytes.push(code);
    else if (cp1252[code]) bytes.push(cp1252[code]);
    else return null;
  }
  return Buffer.from(bytes);
}

function fixMojibake(value) {
  if (typeof value !== "string") return value;
  let text = value;
  for (let i = 0; i < 3 && /Ã|Â|â|ð/.test(text); i += 1) {
    const bytes = cp1252Encode(text);
    if (!bytes) break;
    const decoded = bytes.toString("utf8");
    if (decoded === text || decoded.includes("\uFFFD")) break;
    text = decoded;
  }
  return text
    .replaceAll("Frensh", "French")
    .replaceAll("Channging", "Changing")
    .replaceAll("Entchantment", "Enchantment")
    .replaceAll("Entchantments", "Enchantments");
}

function deepFix(value) {
  if (Array.isArray(value)) return value.map(deepFix);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepFix(item)]));
  }
  return fixMojibake(value);
}

const fixedData = deepFix(data);
const projects = fixedData.modrinth
  .slice()
  .sort((a, b) => `${a.project.project_type}-${a.project.title}`.localeCompare(`${b.project.project_type}-${b.project.title}`));
const repos = Array.isArray(fixedData.github)
  ? fixedData.github
  : Array.isArray(fixedData.github?.value)
    ? fixedData.github.value
    : [fixedData.github].filter(Boolean);

const summaries = {
  "emeraldsplus": {
    en: "Adds emerald armor, emerald tools, and an Emerald Upgrade template for a gear tier between Diamond and Netherite.",
    de: "Erweitert Minecraft um Smaragdrüstung, Smaragdwerkzeuge und eine Emerald-Upgrade-Vorlage als Ausrüstungsstufe zwischen Diamant und Netherite.",
  },
  "creativetoggle": {
    en: "Adds an F3 + X shortcut that switches to Creative Mode and returns to the previous game mode when pressed again.",
    de: "Fügt die Tastenkombination F3 + X hinzu, um in den Kreativmodus und wieder in den vorherigen Spielmodus zu wechseln.",
  },
  "emeraldsplusdefaulttexturepack": {
    en: "Contains the default texture files for Emeralds Plus so creators can inspect and customize the mod visuals.",
    de: "Enthält die Standardtexturen von Emeralds Plus, damit Creator die Mod-Grafiken ansehen und anpassen können.",
  },
  "creative-toggle-default-texture-pack": {
    en: "Contains Creative Toggle's default mod textures and language files for visual or language customization.",
    de: "Enthält die Standardtexturen und Sprachdateien von Creative Toggle für visuelle oder sprachliche Anpassungen.",
  },
};

const fallbackCustomLicenseText = `# Custom License

Copyright (c) 2026 Mano Craft

Permission is hereby granted to any person obtaining a copy of this software ("the Mod") to:

- Download and use the Mod for personal or commercial gameplay.
- Modify the Mod for private, personal use only.
- Create and publish videos, livestreams, screenshots, and other media featuring the original or privately modified version of the Mod, provided appropriate credit is given to the original author.

The following actions are NOT permitted without prior written permission from the copyright holder:

- Redistributing the original Mod, in whole or in part.
- Redistributing, publishing, or sharing modified versions of the Mod.
- Including the Mod or modified versions in modpacks that rehost the files instead of linking to the official download page.
- Claiming authorship or ownership of the Mod or any substantial portion of it.
- Removing or altering copyright notices, credits, or this license.

# Credit Requirements

When showcasing the Mod in videos, livestreams, articles, or other public content, you must:

- Clearly credit the original author.
- Provide a link to the official Modrinth or GitHub project page whenever reasonably possible.

# Disclaimer

THE MOD IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY ARISING FROM THE USE OF THE MOD.

For permissions beyond those granted in this license, please contact the copyright holder.`;

const customLicenseText = fixedData.custom_license?.content?.trim() || fallbackCustomLicenseText;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, "utf8");
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function joinValues(values) {
  const list = (Array.isArray(values) ? values : [values]).filter(Boolean);
  return list.length ? list.join(", ") : "n/a";
}

function configuredVersions(project, versions) {
  const config = projectVersions[project.slug] || projectVersions[slugify(project.title)] || {};
  const listed = Array.isArray(config.listedVersions)
    ? config.listedVersions
    : typeof config.listedVersions === "string"
      ? config.listedVersions.split(",").map((version) => version.trim()).filter(Boolean)
      : versions.map((version) => version.version_number).filter(Boolean);
  return {
    latestVersion: config.latestVersion || listed[0] || versions[0]?.version_number || "n/a",
    versionList: listed.length ? joinValues(listed) : "n/a",
  };
}

function typeLabel(type, lang) {
  if (type === "resourcepack") return lang === "de" ? "Resourcepack" : "Resource pack";
  if (type === "mod") return "Mod";
  return type;
}

function projectLink(project) {
  const kind = project.project_type === "resourcepack" ? "resourcepack" : "mod";
  return `https://modrinth.com/${kind}/${project.slug}`;
}

function cleanReadme(body, slug) {
  if (!body || !body.trim()) return "_No README text found._";
  let text = body.trim().replaceAll("https://modrinth.com/mods/", "https://modrinth.com/mod/");
  if (slug === "creativetoggle") text = text.split("***")[0].trim();
  return text;
}

function readmeSourceLabel(entry) {
  if (entry.github_readme?.source) return `GitHub README: ${entry.github_readme.source}`;
  return "Modrinth description";
}

function linkText(project, github) {
  const modrinth = projectLink(project);
  const links = [`[Modrinth](${modrinth})`];
  if (github) links.push(`[GitHub](${github})`);
  if (project.issues_url) links.push(`[Issues](${project.issues_url})`);
  return links.join(" | ");
}

function galleryHtml(project) {
  const images = Array.isArray(project.gallery?.value)
    ? project.gallery.value
    : Array.isArray(project.gallery)
      ? project.gallery
      : [];
  const selected = images
    .slice()
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (a.ordering ?? 0) - (b.ordering ?? 0))
    .slice(0, 8);
  if (!selected.length) return "";
  return `<div class="mc-gallery">
${selected.map((image) => {
    const url = image.raw_url || image.url;
    const title = image.title || project.title;
    return `<figure><img src="${url}" alt="${title}"><figcaption>${title}</figcaption></figure>`;
  }).join("\n")}
</div>`;
}

function changelogBox(title, version, changelog) {
  return `<section class="mc-changelog-box" markdown="1">
<p class="mc-changelog-label">${title}</p>
<p class="mc-changelog-version">Version ${version}</p>

${changelog}

</section>`;
}

function licenseName(project, lang = "en") {
  if (project.project_type === "mod") return "Custom License";
  if (project.project_type === "resourcepack") return "MIT License";
  return project.license?.name || project.license?.id || (lang === "de" ? "Unbekannt" : "Unknown");
}

function licenseLink(project) {
  if (project.license?.url) return project.license.url;
  return projectLink(project);
}

function htmlTable(headers, rows) {
  return `<div class="mc-table-wrap"><table class="mc-data-table">
<thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
<tbody>
${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("\n")}
</tbody>
</table></div>`;
}


ensureDir("projects");
ensureDir(".github/workflows");
ensureDir("static/css");
ensureDir("static/js");

const totalDownloads = projects.reduce((sum, entry) => sum + Number(entry.project.downloads || 0), 0);
const cardsEn = [];
const cardsDe = [];
const rowsEn = [];
const rowsDe = [];

for (const entry of projects) {
  const project = entry.project;
  const versions = Array.isArray(entry.versions?.value) ? entry.versions.value : [];
  const latest = versions[0];
  const fileSlug = slugify(project.title);
  const github = project.source_url || project.issues_url?.replace(/\/issues$/, "") || "";
  const { latestVersion, versionList } = configuredVersions(project, versions);
  const loaderList = joinValues(project.loaders);
  const gameVersionList = joinValues(project.game_versions);
  const updated = new Date(project.updated).toISOString().slice(0, 10);
  const changelog = latest?.changelog?.trim() || "_No changelog was provided for the latest Modrinth version._";
  const readme = cleanReadme(entry.github_readme?.content || project.body, project.slug);
  const readmeSource = readmeSourceLabel(entry);
  const summary = summaries[project.slug] || { en: project.description, de: project.description };
  const links = linkText(project, github);
  const gallery = galleryHtml(project);

  cardsEn.push(`<a class="mc-card" href="/projects/${fileSlug}/"><img src="${project.icon_url}" alt=""><span><strong>${project.title}</strong><small>${typeLabel(project.project_type, "en")} | ${loaderList} | ${project.downloads} downloads</small></span></a>`);
  cardsDe.push(`<a class="mc-card" href="/projects/${fileSlug}/"><img src="${project.icon_url}" alt=""><span><strong>${project.title}</strong><small>${typeLabel(project.project_type, "de")} | ${loaderList} | ${project.downloads} Downloads</small></span></a>`);
  rowsEn.push([
    `<a href="/projects/${fileSlug}/">${project.title}</a>`,
    typeLabel(project.project_type, "en"),
    loaderList,
    latestVersion,
    String(project.downloads),
    project.issues_url ? `<a href="${project.issues_url}">Issues</a>` : "n/a",
  ]);
  rowsDe.push([
    `<a href="/projects/${fileSlug}/">${project.title}</a>`,
    typeLabel(project.project_type, "de"),
    loaderList,
    latestVersion,
    String(project.downloads),
    project.issues_url ? `<a href="${project.issues_url}">Issues</a>` : "n/a",
  ]);

  const englishPage = `
# ${project.title}

!!!success Project links
No files are mirrored here and there are no direct downloads. Use the official project pages: ${links}
!!!

${summary.en}

| Field | Value |
|---|---|
| Type | ${typeLabel(project.project_type, "en")} |
| Loader | ${loaderList} |
| Minecraft versions | ${gameVersionList} |
| Downloads | ${project.downloads} |
| Latest version | ${latestVersion} |
| Listed versions | ${versionList} |
| Last update | ${updated} |
| Issues | ${project.issues_url ? `[GitHub Issues](${project.issues_url})` : "n/a"} |
| README source | ${readmeSource} |

## Latest Changelog

${changelogBox("Latest Modrinth changelog", latestVersion, changelog)}

## Gallery

${gallery || "_No Modrinth gallery images are available for this project._"}

${readme}
`;

  write(`projects/${fileSlug}.md`, `---
label: "${project.title}"
icon: "${project.icon_url}"
order: 100
---

${englishPage.trim()}
`);
}

const repoRowsEn = repos
  .filter((repo) => repo?.name)
  .map((repo) => {
    const updated = repo.updated_at ? new Date(repo.updated_at).toISOString().slice(0, 10) : "n/a";
    return [`<a href="${repo.html_url}">${repo.name}</a>`, repo.language || "n/a", updated];
  });

const repoRowsDe = repos
  .filter((repo) => repo?.name)
  .map((repo) => {
    const updated = repo.updated_at ? new Date(repo.updated_at).toISOString().slice(0, 10) : "n/a";
    return [`<a href="${repo.html_url}">${repo.name}</a>`, repo.language || "n/a", updated];
  });

const licenseRowsEn = projects.map(({ project }) => [
  `<a href="${projectLink(project)}">${project.title}</a>`,
  typeLabel(project.project_type, "en"),
  `<a href="${licenseLink(project)}">${licenseName(project, "en")}</a>`,
]);

const licenseRowsDe = projects.map(({ project }) => [
  `<a href="${projectLink(project)}">${project.title}</a>`,
  typeLabel(project.project_type, "de"),
  `<a href="${licenseLink(project)}">${licenseName(project, "de")}</a>`,
]);

write("README.md", `---
visibility: hidden
---

# Mano Craft Wiki

Minecraft mods, texture packs, and source projects in one documentation hub. This site mirrors the public Mano Craft catalog from Modrinth and GitHub, but keeps every project link pointed at the official project pages.

[!ref Open project catalog](/projects/)

<div class="mc-grid">
${cardsEn.join("\n")}
</div>

## Overview

| Value | Status |
|---|---|
| Modrinth projects | ${projects.length} |
| GitHub repositories | ${repos.filter((repo) => repo?.name).length} |
| Total Modrinth downloads | ${totalDownloads} |
| Default language | English |

## Quick Links

| Platform | Link |
|---|---|
| Modrinth | [Mano-Craft on Modrinth](https://modrinth.com/user/Mano-Craft) |
| GitHub | [Mano-Craft on GitHub](https://github.com/Mano-Craft) |

!!!info No downloads
This wiki only shows download counts. Files are not mirrored and direct download links are not provided.
!!!
`);

write("projects/index.md", `---
label: Projects
icon: package
order: 100
---

# Projects

Open a project page to see the README, download count, versions, latest changelog, loader, and project type.

${htmlTable(["Project", "Type", "Loader", "Latest Version", "Downloads", "Issues"], rowsEn)}

## GitHub Repositories

${htmlTable(["Repository", "Language", "Updated"], repoRowsEn)}
`);

write("license.md", `---
label: Custom License
icon: law
order: 90
---

# Licenses

Every Mano-Craft mod is licensed under the Custom License. Every Mano-Craft texture pack/resource pack is licensed under the MIT License.

## Project License Table

${htmlTable(["Project", "Type", "License"], licenseRowsEn)}

## Custom License Text

Source: ${fixedData.custom_license?.source ? `[GitHub LICENSE](${fixedData.custom_license.source})` : "local fallback"}

${customLicenseText}

## MIT License

Texture packs use the MIT License. See the linked Modrinth project pages for the project license entry.
`);

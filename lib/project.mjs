// Edits a freshly downloaded OpenDocera template into the user's own site.

import { existsSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const CONFIG_MARKER = "export const docsConfig: DocsConfig = {";

/** "my-cool docs" -> "my-cool-docs", safe as an npm package name. */
export function toPackageName(value) {
  return (
    String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-~]+/g, "-")
      .replace(/^[-.~]+|[-~]+$/g, "") || "docs"
  );
}

/** "my-docs" -> "My Docs". */
export function toTitle(value) {
  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const str = (v) => JSON.stringify(v);

/** Source for the `docsConfig` object in docs.config.ts. */
export function renderConfig({ name, github, palette, groups, ctaHref }) {
  const links = [`    { label: "Home", href: "/", external: false },`];
  if (github) links.push(`    { label: "GitHub", href: ${str(github)}, external: true },`);

  return `${CONFIG_MARKER}
  name: ${str(name)},
  title: ${str(`${name} docs`)},
  description: ${str(`Documentation for ${name}.`)},
  logo: "/OpenDocera.svg",
  footer: {
    left: ${str(`${name} docs`)},
    right: "Built with OpenDocera",
  },
  links: [
${links.join("\n")}
  ],
  cta: { label: "Get started", href: ${str(ctaHref)} },
  groups: [${groups.map(str).join(", ")}],
  theme: {
    palette: {
      deep: ${str(palette.deep)},
      brand: ${str(palette.brand)},
      bright: ${str(palette.bright)},
      neutral: ${str(palette.neutral)},
    },
    grainient: {
      color1: ${str(palette.bright)},
      color2: ${str(palette.brand)},
      color3: ${str(palette.deep)},
      clouds: { amount: 1.6, scale: 1.6, seed: 3 },
      // Same colors at lower contrast, so the header stays a backdrop instead
      // of glowing against the near-black page.
      dark: { contrast: 1.2 },
    },
  },
};
`;
}

/** Escapes text for MDX prose, where `{` and `<` start code. */
const mdx = (v) => String(v).replace(/\{/g, "\\{").replace(/</g, "&lt;");

function starterPage(name) {
  return `---
title: Introduction
description: ${str(`What ${name} is and where to start.`)}
group: Get started
order: 1
---

## What ${mdx(name)} is

<Lead>Describe ${mdx(name)} in a sentence or two: what it does and who it is for.</Lead>

## Add pages

Each page is an \`.mdx\` file in \`content/docs/\`. The file name becomes the
URL, and the frontmatter puts the page in the sidebar:

\`\`\`mdx title="content/docs/install.mdx"
---
title: Install
description: How to install ${name}.
group: Get started
order: 2
---

## Requirements

...
\`\`\`

<Callout title="Let your AI assistant write them" tone="note">
  \`AGENTS.md\` explains the page format and every component, so you can ask an
  assistant to turn your README or codebase into pages.
</Callout>
`;
}

function starterReadme(name, pm) {
  const run = pm === "npm" ? "npm run" : pm;
  return `# ${name} docs

The documentation site for ${name}, built with
[OpenDocera](https://github.com/Jaybro-git/open-docera) (Next.js and MDX).

## Develop

\`\`\`bash
${pm} install
${run} dev
\`\`\`

Open http://localhost:3000.

## Write pages

Pages are \`.mdx\` files in \`content/docs/\`. The sidebar, search, table of
contents and \`/llms.txt\` are generated from them. \`AGENTS.md\` documents the
page format and components.

## Brand

Name, logo, links and colors live in \`docs.config.ts\`.

## Build

\`\`\`bash
${run} build
\`\`\`
`;
}

/**
 * Turns the downloaded template in `dir` into the user's project.
 * Everything here works on the template's known file layout; if that layout
 * changes, the errors say which file was unexpected.
 */
export async function customize(dir, { name, github, palette, samples, pm }) {
  const folder = basename(dir);
  // Repo-only files. The template's .gitattributes already excludes them from
  // tarballs; removing them again covers older tags and other sources.
  await rm(join(dir, ".github"), { recursive: true, force: true });
  if (pm !== "npm") await rm(join(dir, "package-lock.json"), { force: true });

  if (!samples) {
    const docs = join(dir, "content", "docs");
    for (const file of await readdir(docs)) {
      if (file.endsWith(".mdx")) await rm(join(docs, file));
    }
    await writeFile(join(docs, "intro.mdx"), starterPage(name));
  }

  const configPath = join(dir, "docs.config.ts");
  const config = await readFile(configPath, "utf8");
  const at = config.indexOf(CONFIG_MARKER);
  if (at === -1) {
    throw new Error(`docs.config.ts: could not find "${CONFIG_MARKER}". The template layout has changed.`);
  }
  await writeFile(
    configPath,
    config.slice(0, at) +
      renderConfig({
        name,
        github,
        palette,
        groups: samples ? ["Get started", "Guides", "Reference"] : ["Get started"],
        ctaHref: samples ? "/docs/quickstart" : "/docs/intro",
      }),
  );

  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  pkg.name = toPackageName(folder);
  pkg.version = "0.1.0";
  pkg.description = `Documentation for ${name}.`;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  await writeFile(join(dir, "README.md"), starterReadme(name, pm));
}

/** True when `dir` does not exist or holds nothing but a .git folder. */
export async function isUsableDir(dir) {
  if (!existsSync(dir)) return true;
  const entries = await readdir(dir);
  return entries.every((e) => e === ".git");
}

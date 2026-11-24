#!/usr/bin/env node
// create-opendocera: scaffold a new OpenDocera documentation site.
//
//   npm create opendocera@latest [dir] [options]

import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import * as p from "@clack/prompts";
import { downloadTemplate } from "giget";
import { contrast, derivePalette, isHex, normalizeHex } from "./lib/palette.mjs";
import { customize, isUsableDir, toTitle } from "./lib/project.mjs";

const TEMPLATE = "gh:Jaybro-git/open-docera";
/** Template tag this CLI version was tested against. */
const DEFAULT_REF = "v0.1.0";
const DEFAULT_COLOR = "#B4512F";

const HELP = `
Usage: npm create opendocera@latest [dir] [options]

Options:
  --name <name>       Product name shown in the header and titles
  --color <hex>       Brand color, e.g. "#2F6FED"; the rest of the palette is derived
  --github <url>      Repository link for the header (omit to leave it out)
  --no-samples        Start with one page instead of the Acme sample pages
  --ref <ref>         Template tag, branch or commit (default ${DEFAULT_REF})
  --no-install        Skip installing dependencies
  --no-git            Skip git init
  -y, --yes           Accept defaults for anything not given
  -v, --version       Print the version
  -h, --help          Show this help
`;

function parse() {
  // --no-* flags are declared explicitly: parseArgs' allowNegative needs
  // Node 20.16, and the template supports 20.9.
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      name: { type: "string" },
      color: { type: "string" },
      github: { type: "string" },
      "no-samples": { type: "boolean", default: false },
      ref: { type: "string", default: DEFAULT_REF },
      "no-install": { type: "boolean", default: false },
      "no-git": { type: "boolean", default: false },
      yes: { type: "boolean", short: "y", default: false },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });
  return {
    ...values,
    samples: values["no-samples"] ? false : undefined,
    install: !values["no-install"],
    git: !values["no-git"],
    dir: positionals[0],
  };
}

/** npm, pnpm, yarn or bun, from the tool that launched us. */
function packageManager() {
  const agent = process.env.npm_config_user_agent ?? "";
  for (const pm of ["pnpm", "yarn", "bun"]) if (agent.startsWith(pm)) return pm;
  return "npm";
}

function run(cmd, args, cwd) {
  return new Promise((done) => {
    const child = spawn(cmd, args, { cwd, shell: process.platform === "win32", stdio: "pipe" });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("error", (err) => done({ ok: false, output: String(err) }));
    child.on("close", (code) => done({ ok: code === 0, output }));
  });
}

// git is a real executable on every platform, so it runs without a shell.
// (A shell on Windows would split the commit message into separate words.)
const git = (args, cwd) => spawnSync("git", args, { cwd, stdio: "ignore" }).status === 0;

function bail(message) {
  p.cancel(message);
  process.exit(1);
}

function check(value) {
  if (p.isCancel(value)) bail("Cancelled.");
  return value;
}

async function main() {
  let args;
  try {
    args = parse();
  } catch (err) {
    console.error(`${err.message}\n${HELP}`);
    process.exit(1);
  }
  if (args.help) return console.log(HELP);
  if (args.version) {
    const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
    return console.log(pkg.version);
  }

  const pm = packageManager();
  p.intro("create-opendocera");

  // Where.
  let dir = args.dir;
  if (!dir) {
    dir = args.yes
      ? "my-docs"
      : check(
          await p.text({
            message: "Where should the site be created?",
            placeholder: "my-docs",
            defaultValue: "my-docs",
          }),
        );
  }
  const target = resolve(dir);
  if (!(await isUsableDir(target))) bail(`${dir} already exists and is not empty.`);

  // What.
  const name =
    args.name ??
    (args.yes
      ? toTitle(basename(target))
      : check(
          await p.text({
            message: "Product name?",
            placeholder: toTitle(basename(target)),
            defaultValue: toTitle(basename(target)),
          }),
        ));

  let color =
    args.color ??
    (args.yes
      ? DEFAULT_COLOR
      : check(
          await p.text({
            message: "Brand color (hex)?",
            placeholder: `${DEFAULT_COLOR} (terracotta)`,
            defaultValue: DEFAULT_COLOR,
            validate: (v) => (!v || isHex(v) ? undefined : "Use a hex color like #2F6FED"),
          }),
        ));
  if (!isHex(color)) bail(`--color: "${color}" is not a hex color.`);
  color = normalizeHex(color);

  const github =
    args.github ??
    (args.yes
      ? ""
      : check(
          await p.text({
            message: "GitHub repository URL? (optional)",
            placeholder: "https://github.com/you/your-project",
            defaultValue: "",
            validate: (v) => (!v || /^https?:\/\//.test(v) ? undefined : "Start with https://"),
          }),
        ));

  const samples =
    args.samples ??
    (args.yes
      ? true
      : check(
          await p.confirm({
            message: "Keep the sample pages? They show every component; delete them later.",
            initialValue: true,
          }),
        ));

  const palette = derivePalette(color);
  if (palette.adjusted) {
    p.log.warn(
      `${color} is too light for white text (${contrast(color, "#ffffff").toFixed(1)}:1). ` +
        `Using ${palette.brand} so buttons and links stay readable.`,
    );
  }

  // Download.
  const s = p.spinner();
  s.start(`Downloading the template (${args.ref})`);
  try {
    await downloadTemplate(`${TEMPLATE}#${args.ref}`, {
      dir: target,
      force: true,
      ignore: (path) => path === ".github" || path.startsWith(".github/"),
    });
  } catch (err) {
    s.stop("Download failed", 1);
    bail(`Could not download ${TEMPLATE}#${args.ref}: ${err.message}`);
  }
  s.stop("Template downloaded");

  try {
    await customize(target, { name, github, palette, samples, pm });
  } catch (err) {
    bail(err.message);
  }
  p.log.success(
    `Configured ${name}: brand ${palette.brand}, bright ${palette.bright}, deep ${palette.deep}, neutral ${palette.neutral}`,
  );

  // Install.
  let installed = false;
  if (args.install) {
    s.start(`Installing dependencies with ${pm}`);
    const result = await run(pm, ["install"], target);
    if (result.ok) {
      await run(pm, ["run", "docs:index"], target);
      installed = true;
      s.stop("Dependencies installed");
    } else {
      s.stop(`${pm} install failed`, 1);
      p.log.error(result.output.trim().split("\n").slice(-15).join("\n"));
    }
  }

  // Git.
  if (args.git && git(["--version"], target) && !git(["rev-parse", "--is-inside-work-tree"], target)) {
    if (git(["init", "-b", "main"], target) || git(["init"], target)) {
      git(["add", "-A"], target);
      const committed = git(["commit", "-m", "Initial commit from create-opendocera"], target);
      if (committed) p.log.success("Initialized a git repository");
      else p.log.warn("Initialized a git repository, but the first commit failed. Check `git config user.name` and `user.email`, then commit yourself.");
    }
  }

  const rel = relative(process.cwd(), target) || ".";
  const runCmd = pm === "npm" ? "npm run" : pm;
  const steps = [
    rel !== "." && `cd ${rel.includes(" ") ? `"${rel}"` : rel}`,
    !installed && `${pm} install`,
    `${runCmd} dev`,
  ].filter(Boolean);

  p.note(
    `${steps.join("\n")}\n\nPages:  content/docs/*.mdx\nBrand:  docs.config.ts\nGuide:  AGENTS.md`,
    "Next steps",
  );
  p.outro("Done. Open http://localhost:3000");
}

main().catch((err) => {
  p.cancel(err?.message ?? String(err));
  process.exit(1);
});

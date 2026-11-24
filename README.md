# create-opendocera

Create a new [OpenDocera](https://github.com/Jaybro-git/open-docera) documentation
site: Next.js and MDX, configured by one file, ready for AI assistants.

```bash
npm create opendocera@latest my-docs
```

Also works with `pnpm create opendocera`, `yarn create opendocera` and
`bun create opendocera`. Requires Node.js 20.9 or later.

## What it does

1. Downloads the OpenDocera template, pinned to the release this CLI was tested with.
2. Asks for your product name, brand color, GitHub link and whether to keep the sample pages.
3. Writes `docs.config.ts`. The deep, bright and neutral shades are derived from your brand color. If the color is too light for white button text (under 4.5:1), it is darkened until it passes, and the CLI tells you.
4. Removes files that belong to the template repository, writes a starter README and names the package after your folder.
5. Installs dependencies with the package manager you ran it with, and initializes a git repository.

## Options

| Option | Description |
|---|---|
| `[dir]` | Folder to create. Asked for when omitted |
| `--name <name>` | Product name shown in the header and titles |
| `--color <hex>` | Brand color, for example `"#2F6FED"` |
| `--github <url>` | Repository link for the header. Left out when empty |
| `--no-samples` | Start with one page instead of the sample pages |
| `--ref <ref>` | Template tag, branch or commit to use instead of the pinned release |
| `--no-install` | Skip installing dependencies |
| `--no-git` | Skip `git init` |
| `-y`, `--yes` | Use defaults for anything not passed as an option |

Non-interactive example:

```bash
npm create opendocera@latest nimbus-docs -- --yes --name Nimbus --color "#2F6FED" --no-samples
```

With npm, put `--` before the options so npm passes them through.

## After creating

```bash
cd my-docs
npm run dev
```

- Pages: `content/docs/*.mdx`
- Name, logo, links and colors: `docs.config.ts`
- Full guide for you and your AI assistant: `AGENTS.md`

## License

MIT

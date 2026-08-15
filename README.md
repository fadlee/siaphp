# siaphp

Deploy PHP projects to shared hosting without SSH.

`siaphp` is a small npm CLI that packages source code into a ZIP archive, signs the request with HMAC, and sends it to a single PHP agent file on your hosting account.

> Status: MVP v0.1. Use it first with non-critical projects and keep a hosting backup.

## Requirements

- Node.js 20 or newer on your local machine
- PHP 8.0 or newer on your hosting account
- PHP `ZipArchive` extension
- HTTPS and PHP write access to the target directory

## Getting started

Run this command from the root of your PHP project:

```bash
npx siaphp init
```

The wizard will:

1. Detect whether `index.php` is in the root directory or at `public/index.php`.
2. Create `.siaphp/siaphp-xxxxx.php` with a unique secret and a random filename.
3. Ask for the base URL of your hosting account and tell you where to upload the agent.
4. Save the agent URL in `siaphp.json`.
5. Save the local secret in `.siaphp/credentials.json`.

After uploading the agent:

```bash
npx siaphp doctor
npx siaphp deploy
```

To inspect the deployment package without uploading it:

```bash
npx siaphp deploy --dry-run
unzip -l .siaphp/siaphp-dry-run.zip
```

For more information about the deployment process, use verbose output:

```bash
npx siaphp deploy --verbose
```

This displays the project root, entrypoint, agent and PHP versions, archive details, and deployment results. Secrets and archive contents are never printed.

## Agent placement

### Flat

For projects with `index.php` in the root directory, upload the agent to the same folder. The filename is generated randomly by `init`:

```text
public_html/
  index.php
  siaphp-xxxxx.php
```

### Public folder

For projects with `public/index.php`, the domain document root must point to the `public` folder. Upload the agent to that folder:

```text
project/
  app/
  public/
    index.php
    siaphp-xxxxx.php
```

The agent installs each release into the `project` folder, one level above `public`.

## Configuration

Example `siaphp.json`:

```json
{
  "schemaVersion": 1,
  "agentUrl": "https://example.com/siaphp-agent.php",
  "structure": "public",
  "entrypoint": "public/index.php",
  "exclude": [
    ".git",
    ".git/**",
    ".siaphp",
    ".siaphp/**",
    ".env",
    ".env.*",
    "node_modules",
    "node_modules/**",
    "siaphp.json"
  ]
}
```

Adjust `exclude` if your project needs additional files excluded. The `vendor` directory is intentionally not excluded because many shared hosts do not provide Composer.

## `.siaphpignore`

For larger or shared projects, you can maintain exclusions in a `.siaphpignore` file in the project root. `siaphp init` creates a sample file automatically.

Example `.siaphpignore`:

```text
# Additional exclusions on top of the default security rules.
*.log
.github/
tests/
```

Rules:

- One glob pattern per line.
- Empty lines and lines starting with `#` are ignored.
- These patterns are merged with the default excludes (`.git`, `.siaphp`, `.env`, `.env.*`, `node_modules`, `siaphp.json`) and any `exclude` array in `siaphp.json`.
- Negation with `!` is not supported yet.

## Security

- Every request uses HMAC SHA-256, a timestamp, and a one-time nonce.
- The archive hash is signed and verified after upload.
- The agent rejects path traversal, symlinks, oversized archives, and parallel deployments.
- `.env`, `.git`, local configuration, and credentials are excluded by default.
- The secret is stored only in the agent and `.siaphp/credentials.json`.

Do not commit the `.siaphp` directory. Remove the agent from your hosting account when you no longer use siaphp.

## MVP limitations

- Deployments add and replace files but do not remove old files yet.
- Atomic releases, rollbacks, shared directories, migrations, and build hooks are not supported yet.
- The agent relies on the hosting limits defined by `upload_max_filesize` and `post_max_size`.
- Replacing multiple files is not transactional. Backups are still required.

When the archive exceeds the agent's per-request upload limit, siaphp automatically uses chunked upload if the agent supports it. Each chunk is uploaded separately, verified with SHA-256, and assembled before the release is extracted.

The default chunk size is 8 MB. You can lower it in `siaphp.json` when the hosting provider has a smaller request limit:

```json
{
  "chunkSize": 8388608
}
```

Chunked upload requires a newly generated agent from the same siaphp release. Run `siaphp init` again and upload the new `.siaphp/siaphp-xxxxx.php` file after upgrading the CLI. Existing agents report `chunkUpload: false` or omit the field and will produce the normal archive-size error.

## Non-interactive mode

```bash
npx siaphp init \
  --structure public \
  --base-url https://example.com \
  --yes
```

Upload the generated `.siaphp/siaphp-xxxxx.php` file to your hosting, then run `npx siaphp doctor` to verify.

## Publishing to npm

Make sure you are logged in to npm:

```bash
npm login
```

Check the local package contents without publishing:

```bash
npm run deploy:dry-run
```

To create a release interactively:

```bash
npm run release
```

The release wizard lets you choose one of:

- `patch` for bug fixes (`0.1.1` → `0.1.2`)
- `minor` for backward-compatible features (`0.1.1` → `0.2.0`)
- `major` for breaking changes (`0.1.1` → `1.0.0`)

After you choose a type, the script runs `npm version`, creates a Git commit and `v` tag, then publishes the new version. The `preversion` hook runs the tests before the version is changed.

Commit your code changes before running `npm run release`; npm requires a clean Git working tree when creating the release commit and tag.

## License

MIT

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
2. Create `.siaphp/siaphp-agent.php` with a unique secret.
3. Ask you to upload the agent to your hosting account.
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

## Agent placement

### Flat

For projects with `index.php` in the root directory, upload the agent to the same folder:

```text
public_html/
  index.php
  siaphp-agent.php
```

### Public folder

For projects with `public/index.php`, the domain document root must point to the `public` folder. Upload the agent to that folder:

```text
project/
  app/
  public/
    index.php
    siaphp-agent.php
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

## Non-interactive mode

```bash
npx siaphp init \
  --structure public \
  --agent-url https://example.com/siaphp-agent.php \
  --yes
```

Use `--skip-check` if the agent has not been uploaded yet. After uploading it, run `npx siaphp doctor`.

## Publishing to npm

Make sure you are logged in to npm:

```bash
npm login
```

Check the local package contents without publishing:

```bash
bun run deploy:dry-run
```

Publish to npmjs so the CLI can be used with `npx siaphp`:

```bash
bun run deploy
```

The publish script runs `prepack`, so tests and checks must pass before the package is sent to npm.

## License

MIT

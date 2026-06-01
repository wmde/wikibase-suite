# Development & Advanced Usage - Wikibase Suite Installer

This document covers local testing, CLI options, and other details useful for developers and advanced users.

## Running locally for testing and dev

1. Clone this repo and change into the directory created for it:

   ```bash
   git clone https://github.com/wmde/wbs-deploy-setup
   cd wbs-deploy-setup
   ```

2. Run from the directory that contains `install`:

   ```bash
   ./install [OPTIONS]
   ```

## CLI options

| Option           | Description |
|------------------|-------------|
| `--cli`          | Collects configuration details through the command-line wizard. |
| `--web`          | Explicitly uses the browser UI. This is currently the default. |
| `--dev`          | Shortcut for local development: sets `LOCALHOST=true` and skips dependency installs. |
| `--reset`        | Interactive reset. Optionally deletes `.env`, `LocalSettings.php`, and any existing services/data before relaunch. |
| `--skip-clone`   | Don't clone any repositories. Assumes they are already present. |
| `--skip-deps`    | Skip installing Git and Docker. Assumes both are installed and Docker is running. |
| `--skip-launch`  | Run through configuration but exit before `docker compose up`. |
| `--deploy-ref REF` | Checkout a specific `wikibase-release-pipeline` branch or tag. Defaults to `deploy@7.0.0`. |
| `--debug`        | Enable verbose logging; disables quiet pulls during Docker builds. |
| `--local`        | Configure for localhost: defaults hosts to `wikibase.test` and `query.wikibase.test`, avoids Let's Encrypt. |

### Localhost defaults

When using `--local` or `--dev`, the installer defaults to:

```bash
WIKIBASE_PUBLIC_HOST=wikibase.test
WDQS_PUBLIC_HOST=query.wikibase.test
```

To use these special localhost-only domains, add entries to your system's hosts file. A helpful guide for doing this is available at: [How to Test Your Website by Changing Your Hosts File](https://docs.hypernode.com/best-practices/testing/how-to-test-your-website-by-changing-your-hosts-file.html).

## Notes & behavior

- The installer web server runs on port 8888 (HTTPS) for browser UI installations.
- For non-localhost web installs, the installer will try to obtain a Let's Encrypt cert on port 80. If that fails, it falls back to a self-signed cert and your browser will warn.
- If `docker-compose.local.yml` exists in `deploy/`, it will be merged automatically.
- Default `wikibase-release-pipeline` deploy ref is `deploy@7.0.0`.
- Use `--deploy-ref REF` to checkout a specific `wikibase-release-pipeline` branch or tag.
- After launch, your saved `.env` config is displayed. Store credentials securely.

# Development & Advanced Usage – Wikibase Suite Deploy Setup

This document covers local testing, CLI options, and other details useful for developers and advanced users.

## Running locally for testing and dev

1. Clone this repo and change into the directory created for it:  
   ```
   git clone https://github.com/lorenjohnson/wbs-deploy-setup
   cd wbs-deploy-setup
   ```

2. Run from the directory that contains `start.sh`:  

   ```bash
   ./start.sh [OPTIONS]
   ```

## CLI options

| Option           | Description |
|------------------|-------------|
| `--cli`          | Collects configuration details in terminal instead of web UI. |
| `--dev`          | Shortcut for local development: sets `LOCALHOST=true` and skips dependency installs. |
| `--reset`        | Interactive reset. Optionally deletes `.env`, `LocalSettings.php`, and any existing services/data before relaunch. |
| `--skip-clone`   | Don’t clone any repositories. Assumes they’re already present. |
| `--skip-deps`    | Skip installing Git and Docker (assumes both are installed and Docker is running). |
| `--skip-launch`  | Run through setup but exit before `docker compose up`. |
| `--debug`        | Enable verbose logging; disables quiet pulls during Docker builds. |
| `--local`        | Configure for localhost: defaults hosts to `wikibase.test` and `query.wikibase.test`, avoids Let’s Encrypt. |

### Localhost defaults

When using `--local` (or `--dev`), setup defaults to:

```bash
WIKIBASE_PUBLIC_HOST=wikibase.test
WDQS_PUBLIC_HOST=query.wikibase.test
```

To use these special localhost-only domains, you’ll need to add entries to your system’s hosts file. A helpful guide for doing this is a available at: [How to Test Your Website by Changing Your Hosts File](https://docs.hypernode.com/best-practices/testing/how-to-test-your-website-by-changing-your-hosts-file.html).

## Notes & behavior

- The setup web server runs on port 8888 (HTTPS).  
- For non-localhost installs, setup will try to obtain a Let’s Encrypt cert on port 80. If that fails, it falls back to a self-signed cert (browser warning).  
- If `docker-compose.local.yml` exists in `deploy/`, it will be merged automatically.  
- Default `wikibase-release-pipeline` branch is `deploy@5.0.0` (can be overridden with `REPO_BRANCH`).  
- After launch, your saved `.env` config is displayed—be sure to store credentials securely.

# Wikibase Suite Deploy – Setup Script

This script bootstraps a Wikibase Suite Deploy installation handling or guiding you through all of the following steps:

1. **Check for Git** – Installs Git if it is not already available on the system.  
2. **Clone the repository** – Downloads the Wikibase Suite Deploy code from the official repository.  
3. **Check for Docker** – Installs Docker if it is not already available on the system.  
4. **Prompt for configuration** – Collects all required setup values interactively through a web interface.  
5. **Launch deployment** – Starts the deployment process once configuration is complete and notifies you once your new Suite instance is available.

## Installation

1. Setup on a new VPS instance that meets the following criteria:

  - Meets minimum hardware requirements (see https://github.com/wmde/wikibase-release-pipeline/tree/main/deploy#requirements)
  - Is running one of these officially supported Linux distributions: Ubuntu (22, 24), Debian (11, 12), Fedora, and CentOS
  - You have root level SSH access to the instance

2. SSH as root into your new VPS instance and enter the following, following instructions from there:

```bash
curl -fsSL https://raw.githubusercontent.com/wmde/wikibase-release-pipeline/refs/heads/deploy-setup-script/deploy/setup/start.sh | bash
```

Alternatively, if you already have cloned the repository you can run do start setup running the following commands:

```bash
cd deploy/setup
./start.sh --skip-clone
```

## CLI Options

`start.sh` also has some CLI options available for special cases, debugging, and development:

| Option           | Description |
|------------------|-------------|
| `--debug`        | Enable verbose/debug logging for troubleshooting. |
| `--skip-clone`   | Skip cloning the repository (use an existing checkout). |
| `--skip-deps`    | Skip dependency installation (assumes Git & Docker are already installed). |
| `--skip-launch`  | Do not launch services after configuration completes. |

### Dev-only

| Option           | Description |
|------------------|-------------|
| `--dev`          | Development mode: skips clone, dependency installs, and launch; uses a relative repo path for local development. |
| `--local`        | Mark this run as local which launches setup on localhost:8888 and runs the interactive instead of as a background process. Useful only for dev/testing at this stage.|

These options can be applied using the following command formats:

```bash
curl -fsSL https://raw.githubusercontent.com/wmde/wikibase-release-pipeline/refs/heads/deploy-setup-script/deploy/setup/start.sh | bash -s -- [OPTIONS]
```

Or, from within the deploy/setup directory of an already cloned repository:

```bash
./setup [OPTIONS]
```

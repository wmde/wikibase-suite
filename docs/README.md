# Operating Wikibase Suite (WBS)

Find instructions below for configuring and maintaining an existing WBS installation. If you’re setting up WBS for the first time, start by [Installing WBS](./install/README.md)⁠.

## Access Your WBS Server

For most operating tasks, first connect to the server where WBS is installed and change to its installation directory.

1. Open a terminal on your computer and log in with the server account used during installation (usually `root`). Replace `SERVER_IP_ADDRESS` with your server's public IP address:

	```sh
	ssh root@SERVER_IP_ADDRESS
	```

2. Change to the directory containing your WBS installation. Use the command that matches the version you currently run.

	WBS 7 or earlier:

	```sh
	cd ~/wikibase-release-pipeline/deploy
	```

	WBS 8 or later:

	```sh
	cd ~/wikibase-suite
	```

These are the default locations used by the installation instructions. If you chose a different location during installation, use that location instead.

## Configure

Manage configuration files, connect WBS to other services, or install additional extensions.

- [Configuring WBS](./configuration-files.md)
- [Adding Extensions](./add-extensions.md)
- [Enabling Login with Wikimedia](./enable-login-with-wikimedia.md)

## Maintain

Keep your installation current, protect or restore its data, and diagnose problems.

- [Upgrading](./upgrade.md)
- [Backing Up and Restoring](./backup-and-restore.md)
- [Troubleshooting](./troubleshooting.md)

## Reference

Learn about WBS versions, Docker images, and terminology.

- [Docker Images](./docker-images.md)
- [Versions](./versions.md)
- [Glossary](./glossary.md)

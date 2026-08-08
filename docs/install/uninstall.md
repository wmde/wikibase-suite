# Uninstalling

This procedure removes the Wikibase Suite (WBS) containers, data, configuration, Compose service images, and repository from the server. It does not remove Docker or images unrelated to WBS.

## Instructions

1. If you have not already, [log in to your server and change to your WBS directory](../README.md#access-your-wbs-server).

2. If you might need anything from the instance later, follow [Back up your data](../backup-and-restore.md#back-up-your-data) and [Back up your configuration](../backup-and-restore.md#back-up-your-configuration).

3. Remove the containers, Docker volumes, and images used by the WBS services.

   > [!WARNING]
   > This permanently deletes the instance data. Do not continue unless your backup is complete or you do not need to keep anything from the instance.

   ```sh
   docker compose down --volumes --remove-orphans --rmi all
   ```

   Docker will not remove an image if another container is using it.

4. Move to the parent directory and remove the WBS repository.

   The following command assumes the default `~/wikibase-suite` installation directory. If you installed WBS elsewhere, replace `wikibase-suite` with the name of that directory.

   ```sh
   cd ..
   rm -r -- wikibase-suite
   ```

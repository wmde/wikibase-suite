# Updating Extensions

These instructions apply only to extensions installed specifically for a Wikibase Suite (WBS) instance in `config/extensions`. Extensions bundled with the Wikibase Docker Image are updated with the Image and require no separate action.

Instance-specific extensions have their own release cycles. You are responsible for keeping them up to date. Updates can contain security fixes and may be required when a WBS major upgrade changes the MediaWiki version. During a major upgrade, follow the migration guide for that WBS version to determine when to update your extensions.

## Instructions

1. Identify the MediaWiki version the extension must support:

   - For a routine extension update, visit `https://<WIKIBASE_PUBLIC_HOST>/wiki/Special:Version` and note the current MediaWiki version.
   - For a WBS major upgrade, use the target MediaWiki version specified by the migration guide.

2. Read the extension's release notes and update instructions. Select an extension release that supports the required MediaWiki version and check for new dependencies or configuration changes.

3. [Back up your WBS configuration](./backup-and-restore.md#back-up-your-configuration). The backup includes `config/extensions` and `config/Extensions.php`. If WBS is already stopped by an upgrade or backup procedure, leave it stopped and continue below.

4. On your computer, download the updated `.tar.gz` package from the [MediaWiki Extension Distributor](https://www.mediawiki.org/wiki/Special:ExtensionDistributor). Then copy it to your WBS directory as described in the [installation instructions](./add-extensions.md#instructions). For the default WBS 8 installation:

   ```sh
   scp ~/Downloads/MyExtension.tar.gz root@SERVER_IP_ADDRESS:/root/wikibase-suite/
   ```

5. If WBS is running, stop the services that load the extension code:

   ```sh
   docker compose stop wikibase-jobrunner wikibase
   ```

6. Replace the existing extension directory with the contents of the updated package:

   > [!WARNING]
   > Confirm that your configuration backup contains `config/extensions/MyExtension` before removing the existing directory.

   ```sh
   rm -r -- config/extensions/MyExtension
   tar -xzf MyExtension.tar.gz -C config/extensions
   ```

7. Follow the extension's update instructions. Apply any required changes to `config/Extensions.php` or other user-owned configuration files.

8. Start WBS. The Wikibase Docker Image runs the MediaWiki database updates during startup.

   If you are updating extensions as part of a major WBS upgrade, return to the migration guide and use its instructions to start WBS. Then return here for step 9.

   Otherwise, run:

   ```sh
   docker compose up -d
   ```

9. Visit `https://<WIKIBASE_PUBLIC_HOST>/wiki/Special:Version` and confirm that the extension appears. Test the extension's main functionality and review the Wikibase logs for startup errors:

   ```sh
   docker compose logs --tail 100 wikibase
   ```

For more information, see the [MediaWiki extension manual](https://www.mediawiki.org/wiki/Manual:Extensions).

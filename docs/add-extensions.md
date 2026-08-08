# Adding Extensions

The Wikibase Docker Image supplied with Wikibase Suite (WBS) includes [several commonly used extensions](../development/images/wikibase/README.md#bundled-extensions). You can install additional MediaWiki or Wikibase extensions specifically for your instance.

The [MediaWiki Extension Distributor](https://www.mediawiki.org/wiki/Special:ExtensionDistributor) provides downloadable extension packages for supported MediaWiki versions. Before installing an extension, read its documentation to understand what it does and identify its compatibility requirements, dependencies, configuration, and installation instructions.

## Instructions

To install an extension, copy its files into `config/extensions`, load it from `config/Extensions.php`, and restart the Wikibase service. The steps below use `MyExtension.tar.gz` and `MyExtension` as examples; replace them with the archive and directory names of the extension you downloaded.

1. Visit `https://<WIKIBASE_PUBLIC_HOST>/wiki/Special:Version` and note the installed MediaWiki version.

2. If you have not already, [log in to your server and change to your WBS directory](./README.md#access-your-wbs-server). Keep this terminal session open.

3. On your computer, select the extension in the [MediaWiki Extension Distributor](https://www.mediawiki.org/wiki/Special:ExtensionDistributor), choose the release matching the MediaWiki version you noted in step 1, and download the `.tar.gz` package.

4. Open a second terminal on your computer and copy the downloaded package to the WBS directory on your server. Replace `SERVER_IP_ADDRESS` and the archive filename with your values:

   ```sh
   scp ~/Downloads/MyExtension.tar.gz root@SERVER_IP_ADDRESS:/root/wikibase-suite/
   ```

   This example uses the default `root` server account and WBS 8 installation directory. If you use a different account or installation directory, replace those parts of the destination with the values you use to access WBS.

5. Return to the terminal connected to your WBS server and unpack the extension into `config/extensions`:

   ```sh
   tar -xzf MyExtension.tar.gz -C config/extensions
   ```

6. Confirm that `config/extensions/MyExtension` exists and contains an `extension.json` file.

7. Follow the extension's installation instructions. In many cases, loading it only requires adding the following line to `config/Extensions.php`:

   ```php
   wfLoadExtension( 'extensions/MyExtension' );
   ```

8. Restart the Wikibase and job-runner services so MediaWiki can update itself and both services load the extension:

   ```sh
   docker compose restart wikibase wikibase-jobrunner
   ```

   > [!NOTE]
   > Some extensions instruct you to run `update.php` during installation. The Wikibase Docker Image runs `update.php` during startup, so you do not need to run it manually.

9. Visit `https://<WIKIBASE_PUBLIC_HOST>/wiki/Special:Version` and confirm that the extension appears in the list of installed extensions.

To keep an extension you installed in `config/extensions` current, follow [Updating Extensions](./update-extensions.md).

For more information, see the [MediaWiki extension manual](https://www.mediawiki.org/wiki/Manual:Extensions).

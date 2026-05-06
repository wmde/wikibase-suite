# Wikibase Suite user-defined MediaWiki extensions

This directory is for additional MediaWiki or Wikibase extensions. To load an additional extension, three things need to be done:

- Put the extension in this directory
- Load the extension via `deploy/config/Extensions.php`
- Restart Wikibase so MediaWiki can update itself

## Downloading the extension

To download additional MediaWiki extensions, you can use https://www.mediawiki.org/wiki/Special:ExtensionDistributor. Select the extension to download. Next, select the MediaWiki version your extension needs to be compatible with. You can find out what MediaWiki version you are running by visiting `https://<WIKIBASE_PUBLIC_HOST>/wiki/Special:Version`.

Once the file is downloaded, unpack it to `config/extensions`:

```
deploy
|
+- config
   |
   +- extensions
      |
      +- README.md <- you are here
      |
      +- MyExtension <- we are going to create this directory

```

```sh
tar -xzf MyExtension.tar.gz -C path/to/deploy/config/extensions
```

Verify that you created `deploy/config/extensions/MyExtension` and that this directory contains an `extension.json` file.

## Load the extension

To load the extension into MediaWiki, follow the installation instructions of your extension. In many cases, you only need to add the following line to `deploy/config/Extensions.php`:

```php
wfLoadExtension( 'extensions/MyExtension' );
```

Then restart the Wikibase service:

```sh
docker compose restart wikibase
```

Some extensions might ask you to run `update.php` as part of the installation process. The Wikibase image runs `update.php` during startup, so you do not need to run it manually.

## Testing your extension

You can verify that your extension was loaded by visiting `https://<WIKIBASE_PUBLIC_HOST>/wiki/Special:Version`. Your extension should be listed in the list of loaded extensions.

## Updating the extension

When you install extensions manually as described above, you are responsible for updating those extensions. Extensions can contain security vulnerabilities that are fixed in later releases. When you upgrade MediaWiki, for example from 1.42 to 1.43 during a WBS Deploy major upgrade, the extension might need an update too in order to remain compatible.

## More information

More information is available in the [MediaWiki Manual](https://www.mediawiki.org/wiki/Manual:Extensions).

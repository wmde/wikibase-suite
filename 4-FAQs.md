# Frequently Asked Questions

## Can I migrate from another Wikibase installation to WBS Deploy?

It is possible to migrate an existing Wikibase installation to WBS Deploy. The general procedure is as follows:

- [Back up your MediaWiki](https://www.mediawiki.org/wiki/Manual:Backing_up_a_wiki)
- [Install Wikibase Suite](#initial-setup) as described above
- Re-apply any [changes](#customizing-your-wikibase-suite-mediawiki) to `config/LocalSettings.php`
- Import your database dump
- Regenerate the WDQS database
- Regenerate the Elasticsearch database

## My WDQS Updater keeps crashing, what can I do?

Check out the known issue in the [WDQS README](../build/wdqs/README.md#Known-issues). You may find your solution there in the form of a workaround.

## Do you recommend any VPS hosting providers?

As of this writing, we can offer no specific recommendations for VPS providers to host Wikibase Suite. The suite has been tested successfully on various providers; as long as the [minimum technical requirements](#hardware) are met, it should run as expected.

## What are the future plans for the Call Back feature and what information does it collect?

The Wikibase Suite Wikibase Image has a Call Back feature. This initiative will help maintain an index of Wikibases. The goal of this index is to gather more quantitative data to learn more about how Wikibase is being used. It eventually also aims to be a central hub for data re-use and federation initiatives between Wikibases, where users can discover other Wikibases easily. In the near future, we expect to have a proper showcase of all the Wikibases that have opted in so as to increase discoverability. For now, however, this data will remain only with Wikimedia Deutschland.

If you enable the feature, your hostnames configured in `.env` will be shared and added to the list. We will then be able to periodically analyze publicly available information on your Wikibase instance. It is important to note that we can only access publicly visible information. If your Wikibase instance requires a login to view data, we will not be able to collect statistics.

You can disable the feature at any time by setting `METADATA_CALLBACK=false` in your `.env` file and by sending an E-Mail to [wikibase-suite-support@wikimedia.de](mailto:wikibase-suite-support@wikimedia.de) containing your hostname to remove your instance from the listing and stop periodic analysis.
 
Let's build the Linked Open Data Web together!

## Where can I get further help?

If you have questions not listed above or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.

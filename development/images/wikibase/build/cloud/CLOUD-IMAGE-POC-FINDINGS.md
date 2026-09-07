# Cloud image POC findings

_Current as of 2026-09-07._

This local-only POC derives a Cloud-specific image from the Wikibase Suite
Wikibase image. This is a living record of findings, decisions, and follow-up
work as the WBS image and the Cloud derivative converge. It does not propose
making the Cloud runtime a Suite configuration mode.

## Confirmed architecture and behavior

- The current Cloud Helm chart can use the derived image without changing its
  entrypoint or probes. It starts the image's web workload, probes
  `/w/health.php`, supplies the environment consumed by the Cloud bootstrap,
  and enables `WBSTACK_LOAD_MW_INTERNAL=yes` only for the backend deployment.
- The POC is a Cloud-specific build of the Wikibase Suite Wikibase image, not
  an externally managed `MW_CONFIG_FILE` deployment. Its Cloud bootstrap,
  configuration code, and Cloud extensions are installed in the image and
  resolve configuration for the current domain on MediaWiki initialization.
  Supplying an external MediaWiki configuration file remains an available
  generic-image option, but is not the Cloud entry point evaluated here.
- Cloud runtime files mirror their installed paths in `runtime-cloud/`. This
  is clearer than treating them as Docker build input and is a useful pattern
  to consider when revisiting the WBS runtime layout.

- The target packages every extension the imported Cloud policy loads. The
  policy no longer silently skips absent extensions; a missing extension is an
  image error.
- Cloud's enabled extension set is broader than the WBS default set. Per-wiki
  settings still control ConfirmAccount, InviteSignup, ThatSrc,
  WikibaseLexeme, and OpenSearch.
- The POC deliberately ignores the Cloud API's legacy `wgDefaultSkin` value
  and uses Vector 2022 for every wiki. Whether Cloud should again offer
  selectable skins is deferred.

## Extension policy profiles

The goal is one shared, image-owned profile set that both WBS and Cloud can
load. Cloud's present policy is the presumptive starting point for those
profiles: its portable settings should normally be inherited when the
corresponding capability is enabled. The Cloud layer would then add tenant and
topology values after loading the same profiles, rather than replacing them.

This is the working hypothesis being evaluated, not an assumed constraint.
Success means a common extension experience and policy for users of both
products, with one implementation to maintain. The test is whether each Cloud
tenant overlay can stay additive. Any profile that cannot do so should be a
documented exception with a concrete reason, rather than a separate default.

Cloud currently expresses this policy directly in its `LocalSettings.php`; it
does not yet consume shared profile files. Extracting the portable portions is
therefore an architecture task to validate, not a proven implementation. Most
other optional extensions are simple loads with no material policy bundle.

### OpenSearch and Lexeme

- **Shared profile:** enable Elastica, CirrusSearch, and
  WikibaseCirrusSearch together; select CirrusSearch; configure the Wikibase
  search index types. When Lexeme is enabled too, enable
  WikibaseLexemeCirrusSearch and its Lexeme index/content settings.
- **Cloud overlay:** Cloud selects search and Lexeme per tenant, then supplies
  multi-tenant cluster topology, index base names, shard/replica counts, and
  failure behavior. WBS would provide its host through its existing
  configuration; neither product needs to override the shared loading policy.

### Account creation, anti-abuse, and mail

- **Shared profile:** inherit Cloud's ConfirmAccount request form and
  permissions, InviteSignup restrictions and queue permissions, captcha
  behavior, StopForumSpam, SpamBlacklist sources, DNS blocklists, TorBlock,
  and Mailgun setup when the respective capabilities are enabled.
- **Cloud overlay:** credentials and captcha keys are tenant/deployment values.
  The existing shared blacklist and blocklist defaults are candidates to retain
  in the shared WBS profile, not reasons to split the profile.

### MobileFrontend, VisualEditor, and Kartographer

- **Shared profile:** inherit the Cloud defaults accompanying
  MobileFrontend/MinervaNeue, VisualEditor/Parsoid, editor preferences, and
  Kartographer when each is enabled.
- **Cloud overlay:** map-tile endpoints and credentials are deployment values;
  the shared profile can leave them configurable without changing its loading
  behavior.

### WikibaseLexeme, federated properties, and connected services

- **Shared profile:** carry the Cloud settings required with Wikibase
  Lexeme, federated properties, EntitySchema, WikibaseInWikitext, and Wikibase
  Manifest when those capabilities are enabled.
- **Cloud overlay:** namespace IDs, string limits, equivalent entities,
  canonical URIs, and service URLs are tenant data. A profile can establish
  the behavior while Cloud and WBS provide their instance values afterward.

### Score

- **Shared profile target:** eventually load Score with the same Wikibase data
  type setting in both images.
- **Current packaging decision:** Score is excluded from the generic image for
  now because LilyPond adds roughly 73 MiB in a distinct image layer and has a
  wider operational footprint. This is conservative, not a policy divergence;
  revisit it if full extension-set parity becomes worth the image cost.

Extensions such as RevisionSlider, TemplateSandbox, CodeMirror, AdvancedSearch,
EmbedVideo, DeleteBatch, WikiHiero, Echo, and Thanks currently need only normal
loading. Cloud platform integration—OAuth privileges, Platform API
configuration, and control-plane APIs—is intentionally outside this profile
inventory; it belongs solely in the eventual Cloud layer.

## Key findings and open questions

- **Platform upgrade assumption:** This POC is not a drop-in replacement for
  the current Cloud stack. It assumes Cloud can migrate each wiki database to
  MediaWiki 1.46 and operate against OpenSearch. The Query Service, Query
  Service frontend, and QuickStatements also need an explicit compatibility
  and versioning decision; this POC does not yet establish that they can use
  the corresponding WBS images.
- **Extension-policy convergence:** A shared Cloud/WBS profile set appears
  feasible: the portable policy can be extracted from current Cloud settings,
  while Cloud-only tenant and topology values remain a later additive overlay.
  This would align the user-facing extension policy and reduce duplicate
  maintenance. It is not yet proven because Cloud does not currently load
  those shared files. A shared selection mechanism is needed for conditional
  activation—particularly OpenSearch plus Lexeme.
- **Localization-cache footprint:** Cloud deliberately bakes a manual-recache
  localization cache into `/tmp/mw-cache`. It retains about 1.4 GiB
  uncompressed and contributes much more to image growth than LilyPond. Decide
  whether to retain a versioned image cache, relocate it, or build shared-cache
  rollout and invalidation machinery. Deleting or empty-mounting it would be
  incorrect with the current policy.
- **Integration validation:** A staging trial still needs a real tenant,
  Platform API, migrated database, uploads, jobs, backend control-plane APIs,
  and the Vector 2022 transition.

## Actions to take now for WBS

1. Add WikiHiero to the generic optional-extension bundle, disabled by
   default, and document it in the Wikibase image README. Its omission was not
   a deliberate compatibility or footprint decision: its REL1_46 metadata
   requires only MediaWiki 1.46, it has no production Composer dependency, and
   its installed extension directory is approximately 5 MiB.
2. Make a focused WBS runtime-layout pass: strongly consider moving the WBS
   PHP bootstrap, default settings, extension profiles, and related
   image-owned configuration from `/opt/wbs` into the WikibaseSuite extension.
   Keep the generic container dispatcher and shell setup/migration machinery
   separate where that remains clearer. This would place the WBS policy next
   to the extension that owns it, following the useful Cloud pattern.
3. Revisit an extension registry as the likely shared Cloud/WBS architecture
   for the profiles described above and selective activation. It must be able
   to express enabled/disabled extensions and dependency-aware,
   multi-extension profiles that activate according to what other extensions
   will load. This remains the key gap before WBS can safely add more
   image-owned profiles and a later CLI/UI configuration layer.

   Until that architecture is settled, users can overwrite `LoadExtensions.php`
   and make their own conditional loading decisions while reusing the image's
   available extension-profile files. This is the current in-place mechanism,
   not a new configuration interface. The Cloud POC is the reference point for
   deriving further profiles and policies. The longer-term target is a shared
   extension-policy set and a Cloud full-set variant built from a base image
   that packages every extension except Score.

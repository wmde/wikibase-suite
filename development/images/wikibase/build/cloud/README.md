# Wikibase Cloud image proof of concept

This directory is the Cloud-only build input for the `wikibase-cloud` Bake
target. The target derives from the normal Wikibase image build. Its runtime
payload is in `../runtime-cloud/`, including the MediaWiki 1.46-compatible
WBStack configuration resolver and internal API extension recovered from the
earlier shared-image prototype. It uses the MediaWiki 1.46 bundled Vector skin
with the `vector-2022` default; it does not package the old Modern skin.

`CloudSettings.php` is selected through `MW_CONFIG_FILE`. On every MediaWiki
initialization it resolves the request domain (or `WBS_DOMAIN` for CLI work),
loads the corresponding Cloud configuration from the Platform API, and then
applies the Cloud MediaWiki policy.

## Deployment contract

The current Cloud Helm chart can use this image without an entrypoint or probe
change: it starts the image's default web workload, probes `/w/health.php`,
and supplies the `PLATFORM_API_BACKEND_HOST`, database, Redis, search, mail,
captcha, and logging variables consumed by the Cloud policy. Its backend
deployment additionally sets `WBSTACK_LOAD_MW_INTERNAL=yes`, which enables
the private control-plane API already included in this target. The normal WBS
setup is bypassed because this target sets `MW_CONFIG_FILE` itself.

The current Platform API accepts `vector`, `modern`, and `timeless` for
`wgDefaultSkin`. This POC ignores that setting and uses `vector-2022` for
every wiki. Minerva remains loaded only for the existing MobileFrontend
configuration; it is not a selectable site-default skin. Whether Cloud should
restore a choice of site skins is intentionally deferred. A production
migration should add `vector-2022` to the Platform API's validation and
migrate stored settings.

## Extension policy

This target packages every extension the imported Cloud policy loads. Its
always-enabled Cloud set intentionally differs from WBS defaults—for example,
it includes mail, anti-spam, editor, mobile, map, Score, and WikiHiero
features. Per-wiki settings continue to control ConfirmAccount, InviteSignup,
ThatSrc, WikibaseLexeme, and search. Missing packaged extensions are treated
as image errors rather than being silently skipped.

Neither these Cloud build inputs nor the Cloud runtime payload are copied into
the normal `wikibase` target. This is a local-only architectural proof of
concept, not a Suite configuration mode or a release artifact.

See [Cloud image POC findings](CLOUD-IMAGE-POC-FINDINGS.md) for the
living findings record and follow-up work.

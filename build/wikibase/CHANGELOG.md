## 4.1.3 (2026-11-02)

## Changes

- Updates the PHP runtime base image from 8.3.16 to 8.3.36 (Apache, Debian Bookworm) to fix the critical vulnerabilities CVE-2026-109618 and CVE-2026-109619 ([PHP security advisory](https://www.php.net/archive/2026.php#2026-10-21-5)).

## Dependency updates

- Wikibase REL1_43 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/Wikibase/+log/5f5120105e6bac0b5870ff3dc75ef5f9236b16cc..fe440b261a3f8ddb4892fa08dc50e9d9f6cab37f)).
- Babel REL1_43 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/Babel/+log/fcb96b5c2bc9aa721370898b07cd7d74c451e7e0..728428075b3535602f56297536f9da0f80776478)).
- cldr REL1_43 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/cldr/+log/4a8e09346d06d62ff1d2407076e1f0692ce75395..96b3345d82db679cfe3b5e65e53af4a4fec757d4)).
- CirrusSearch REL1_43 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/CirrusSearch/+log/4019b7afa8de4269ea930f59bdf9a70025bb4ac8..3175dbb503462f4fb725dcf3cbaccc4ad6d3afe2)).
- Elastica REL1_43 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/Elastica/+log/4feb817e2559d246c4cebfd6855e6713e5677066..dc22ccac223a628226e0c6b42074b16361f2cbd5)).
- EntitySchema REL1_43 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/EntitySchema/+log/4df3e345de17939535606f161e2a343c41d3c9d4..ffede56b0330fbbdf84d7e93ca6a6a5985f1fe51)).
- OAuth REL1_43 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/OAuth/+log/270a08f2df0020ac56e737f096683ca3a888932e..f3340035da0d3346c907a83c0e1102198c59f783)).
- UniversalLanguageSelector REL1_43 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/UniversalLanguageSelector/+log/c58aa7262997df7abdd6eff733595789c1750977..92ba94a8369e583e232c0519167ac2cc79d5d959)).
- WikibaseCirrusSearch REL1_43 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/WikibaseCirrusSearch/+log/52bb4cb184a7a950bcb0f2fa79f48cfbf0b8b4ee..12c1aedc176b209ea9e7c810cc4d9b38e158b9ff)).
- WikibaseManifest REL1_43 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/WikibaseManifest/+log/7d8d51a6f1cd11e62f42f1fa6beb6f7ba12c6666..60efd69e50599b964f48401ecd6e99bdc580780d)).
- WikibaseLocalMedia master ([Diff](https://github.com/ProfessionalWiki/WikibaseLocalMedia/compare/2c400d80cd81893bcd04ba5f4e3ea6d2e3bdff20...26795a660a2d870e7f87f29e388ca8abb9220510)).
- WikibaseEdtf master ([Diff](https://github.com/ProfessionalWiki/WikibaseEdtf/compare/a3597aa7a1306d1bbee0681da4b3bd551d071183...23d233ca8a5b29de55735b276b682f115eaff688)).

## 4.1.2 (2026-07-22)


### 🩹 Fixes

- Update MediaWiki to 1.43.9 and refresh WMF-maintained extensions on REL1_43

## 4.1.1 (2025-07-17)


### 🏡 Chore

- bump mediawiki to 1.43.3, update extensions

## 4.1.0 (2025-06-13)


### 🚀 Features

- Add operating system dependencies for Mediawiki extensions

## 4.0.1 (2025-04-29)


### 🏡 Chore

- mediawiki 1.43.1

# 4.0.0 (2025-03-20)

### 🩹 Fixes

- OAuth consumers (e.g. QuickStatements) on same domain

### 📖 Documentation

- Prepare Deploy 4 release
- Update Dockerhub readme

### 🏡 Chore

-  ⚠️ Bump MediaWiki to 1.43

#### ⚠️ Breaking Changes

-  ⚠️ Bump MediaWiki to 1.43

## 3.0.3 (2025-02-24)

### 🏡 Chore

- bump mediawiki to 1.42.4

- bump mediawiki extensions

- bump php to 8.3.16

- bump to mediawiki 1.42.5

## 3.0.2 (2024-10-28)

### 🏡 Chore

- bump mediawiki to 1.42.3, bump extensions

## 3.0.1 (2024-10-09)

### 📖 Documentation

- Link to MediaWiki bundled extensions
- Switch from `.example.com` to `.example`

### 🏡 Chore

- Removes re-installation of extensions already packaged with MediaWiki (ConfirmEdit, Nuke, Scribunto, SyntaxHighlight_Geshi, VisualEditor)
- Updates Wikibase EDTF extension

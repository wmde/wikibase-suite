#!/bin/sh
set -eu

root=/tmp/quickstatements/public_html/assets
mkdir -p "$root/cdnjs/ajax/libs" "$root/tooltranslate/data"

fetch() {
    url=$1
    expected=$2
    destination=$3
    mkdir -p "$(dirname "$destination")"
    # Pass $argv literally to PHP rather than expanding it in the shell.
    # shellcheck disable=SC2016
    php -r 'exit(copy($argv[1], $argv[2]) ? 0 : 1);' "$url" "$destination"
    printf '%s  %s\n' "$expected" "$destination" | sha256sum --check --status
}

cdnjs=https://cdnjs.cloudflare.com/ajax/libs
fetch "$cdnjs/twitter-bootstrap/4.0.0/css/bootstrap.min.css" 2c0f3dcfe93d7e380c290fe4ab838ed8cadff1596d62697f5444be460d1f876d "$root/cdnjs/ajax/libs/twitter-bootstrap/4.0.0/css/bootstrap.min.css"
fetch "$cdnjs/twitter-bootstrap/4.0.0/js/bootstrap.bundle.min.js" bb3d017273ed487674d9766d8401cf458228596adcc0c3a6024f44ae715090db "$root/cdnjs/ajax/libs/twitter-bootstrap/4.0.0/js/bootstrap.bundle.min.js"
fetch "$cdnjs/jquery/3.3.1/jquery.min.js" 160a426ff2894252cd7cebbdd6d6b7da8fcd319c65b70468f10b6690c45d02ef "$root/cdnjs/ajax/libs/jquery/3.3.1/jquery.min.js"
fetch "$cdnjs/vue/2.5.13/vue.min.js" d50daae61836617a7d7d894cfbeb0811739c51bf014520d4b10d735ef2c1aa60 "$root/cdnjs/ajax/libs/vue/2.5.13/vue.min.js"
fetch "$cdnjs/vue-router/3.0.1/vue-router.min.js" c8407d8d4943e758b99312599738337d1e97995288efa365d56440d5aa888a55 "$root/cdnjs/ajax/libs/vue-router/3.0.1/vue-router.min.js"
fetch "$cdnjs/leaflet/1.3.1/leaflet.css" 8985209ab6a97c31af06b78f24facc59064370e6dd01c4ad281a633f7033fb7b "$root/cdnjs/ajax/libs/leaflet/1.3.1/leaflet.css"
fetch "$cdnjs/leaflet/1.3.1/leaflet.js" 08d9beedcdba0d34c219142433dbe9eda3fce641c532ab3d3213c4bb2b45f9f4 "$root/cdnjs/ajax/libs/leaflet/1.3.1/leaflet.js"
fetch "$cdnjs/leaflet/1.3.1/images/layers-2x.png" 066daca850d8ffbef007af00b06eac0015728dee279c51f3cb6c716df7c42edf "$root/cdnjs/ajax/libs/leaflet/1.3.1/images/layers-2x.png"
fetch "$cdnjs/leaflet/1.3.1/images/layers.png" 1dbbe9d028e292f36fcba8f8b3a28d5e8932754fc2215b9ac69e4cdecf5107c6 "$root/cdnjs/ajax/libs/leaflet/1.3.1/images/layers.png"
fetch "$cdnjs/leaflet/1.3.1/images/marker-icon.png" 574c3a5cca85f4114085b6841596d62f00d7c892c7b03f28cbfa301deb1dc437 "$root/cdnjs/ajax/libs/leaflet/1.3.1/images/marker-icon.png"
fetch "$cdnjs/leaflet/1.3.1/images/marker-icon-2x.png" 00179c4c1ee830d3a108412ae0d294f55776cfeb085c60129a39aa6fc4ae2528 "$root/cdnjs/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png"
fetch "$cdnjs/leaflet/1.3.1/images/marker-shadow.png" 264f5c640339f042dd729062cfc04c17f8ea0f29882b538e3848ed8f10edb4da "$root/cdnjs/ajax/libs/leaflet/1.3.1/images/marker-shadow.png"

# The npm distribution contains the exact CSS served by CDNJS, together with
# its relative SVG/image dependencies.
fetch https://registry.npmjs.org/oojs-ui/-/oojs-ui-0.49.2.tgz ed4945031bdc7c81dbe486c6885c4ab7371f287af61181573cf124dfc4afa472 /tmp/oojs-ui.tgz
mkdir -p "$root/cdnjs/ajax/libs/oojs-ui/0.49.2"
tar -xzf /tmp/oojs-ui.tgz -C "$root/cdnjs/ajax/libs/oojs-ui/0.49.2" --strip-components=2 package/dist
rm /tmp/oojs-ui.tgz

fetch https://codeberg.org/magnusmanske/tooltranslate/archive/477585a9d1d8469ad950e53ce3c7b9a78961be65.tar.gz 6366123e7020f13a94198d0487ef77dfaeaf705c9e99e9a65cb31c51bcd5b07f /tmp/tooltranslate.tar.gz
tar -xOzf /tmp/tooltranslate.tar.gz tooltranslate/public_html/tt.js > "$root/tooltranslate/tt.js"
rm /tmp/tooltranslate.tar.gz

# MagnusTools is already pinned and fetched by this Dockerfile. Expose only the
# resources requested by QuickStatements under Apache's document root.
mkdir -p "$root/magnustools/resources/html" "$root/magnustools/resources/js" "$root/magnustools/resources/vue"
cp /tmp/magnustools/public_html/resources/html/wikimedia.css "$root/magnustools/resources/html/"
cp /tmp/magnustools/public_html/resources/js/wikidata.js "$root/magnustools/resources/js/"
for component in wd-date wd-link tool-translate commons-thumbnail; do
    cp "/tmp/magnustools/public_html/resources/vue/$component.html" "$root/magnustools/resources/vue/"
done
cp -R /tmp/tooltranslate-data/data "$root/tooltranslate/"

#!/bin/sh
# This file is provided by the wikibase/wdqs-frontend docker image.

# Test if required environment variables have been set
if [ -z "$WIKIBASE_HOST" ]; then
	echo "WIKIBASE_HOST is required but isn't set. You should pass it to docker. See: https://docs.docker.com/engine/reference/commandline/run/#set-environment-variables--e---env---env-file";
	exit 1;
fi

if [ -z "$WDQS_HOST" ]; then
	echo "WDQS_HOST is required but isn't set. You should pass it to docker. See: https://docs.docker.com/engine/reference/commandline/run/#set-environment-variables--e---env---env-file";
	exit 1;
fi

set -eu

export DOLLAR='$'

# Generate initial config from template and put it to /config
if ! [ -e "/config/wdqs-frontend-config.json" ]; then
    envsubst < /templates/wdqs-frontend-config.json.template > /config/wdqs-frontend-config.json
fi

# The GUI merges custom-config.json over default-config.json. Make the packaged
# default local, while keeping an intentional non-Wikidata custom source.
wikibase_base_url="${WIKIBASE_PUBLIC_URL%/w/api.php}"
jq --arg server "${wikibase_base_url}/" '
    .api.examples = {
        server: $server,
        apiPath: "w/api.php",
        pageTitle: "Project:SPARQL/examples",
        pagePathElement: "wiki/"
    }
' /usr/share/nginx/html/default-config.json > /tmp/default-config.json
mv /tmp/default-config.json /usr/share/nginx/html/default-config.json

# Migrate the old WBS default out of the persisted operator configuration.
# Other examples sources remain fully under the operator's control.
if jq -e '
    (.api.examples.server? | type == "string") and
    (.api.examples.server | sub("/+$"; "") == "https://www.wikidata.org")
' /config/wdqs-frontend-config.json > /dev/null; then
    jq 'del(.api.examples)' /config/wdqs-frontend-config.json > /tmp/wdqs-frontend-config.json
    mv /tmp/wdqs-frontend-config.json /config/wdqs-frontend-config.json
fi

# Use config from /config
cp /config/wdqs-frontend-config.json /usr/share/nginx/html/custom-config.json

envsubst < /templates/nginx-default.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"

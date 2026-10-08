#!/usr/bin/env bash

set -eu

private_key=/config/oauth2-private.pem
public_key=/config/oauth2-public.pem

if [ -s "$private_key" ] && [ -s "$public_key" ]; then
    chown www-data:www-data "$private_key" "$public_key"
    chmod 0600 "$private_key" "$public_key"
    echo "OAuth 2 signing keys already exist."
    exit 0
fi

temporary_directory=$(mktemp -d /config/.oauth2-keys.XXXXXX)
trap 'rm -rf "$temporary_directory"' EXIT

openssl genpkey \
    -algorithm RSA \
    -pkeyopt rsa_keygen_bits:2048 \
    -out "$temporary_directory/private.pem"
openssl pkey \
    -in "$temporary_directory/private.pem" \
    -pubout \
    -out "$temporary_directory/public.pem"

# Apache needs the key to be readable only by its own user.
chown www-data:www-data "$temporary_directory/private.pem"
chown www-data:www-data "$temporary_directory/public.pem"
chmod 0600 "$temporary_directory/private.pem" "$temporary_directory/public.pem"
mv "$temporary_directory/private.pem" "$private_key"
mv "$temporary_directory/public.pem" "$public_key"
echo "OAuth 2 signing keys generated in /config."

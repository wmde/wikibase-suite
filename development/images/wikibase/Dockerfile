# Build configuration
ARG PHP_IMAGE_URL
ARG COMPOSER_IMAGE_URL
ARG COMPOSER_IMAGE_PLATFORM=linux/amd64

# ###########################################################################
# Based on https://github.com/wikimedia/mediawiki-docker/blob/1161796f04d6a6bcbec9fb4c67a8ce7248392403/1.41/apache/Dockerfile
# hadolint ignore=DL3006
FROM ${PHP_IMAGE_URL} AS mediawiki

SHELL ["/bin/bash", "-exu", "-c"]

# System dependencies
RUN apt-get update; \
    apt-get install -y --no-install-recommends \
        git \
        gettext-base \
        librsvg2-bin \
        imagemagick \
        # Required by SyntaxHighlighting MediaWiki Extension
        python3 \
        # Required by Scribunto MediaWiki Extension
        lua5.1 \
        # Required by PdfHandler MediaWiki Extension
        ghostscript poppler-utils \
        # Required by PagedTiffHandler MediaWiki Extension
    	exiv2 libtiff-tools \
        # Required by TimedMediaHandler MediaWiki Extension
        ffmpeg \
        # Required by VipsScaler MediaWiki Extension
    	libvips-tools \
        ; \
    rm -rf /var/lib/apt/lists/*

# Install the PHP extensions we need
# hadolint ignore=DL4006
RUN savedAptMark="$(apt-mark showmanual)"; \
    \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        libicu-dev \
        libonig-dev \
        libbz2-dev=1.* \
        ; \
    \
    docker-php-ext-install -j "$(nproc)" \
        bz2 \
        calendar \
        intl \
        mbstring \
        mysqli \
        opcache \
        ; \
    \
    pecl install APCu-5.1.21 redis-6.3.0; \
        docker-php-ext-enable \
        apcu redis \
        ; \
    rm -r /tmp/pear; \
    \
    # reset apt-mark's "manual" list so that "purge --auto-remove" will remove all build dependencies
    apt-mark auto '.*' > /dev/null; \
    apt-mark manual $savedAptMark; \
    ldd "$(php -r 'echo ini_get("extension_dir");')"/*.so \
        | awk '/=>/ { print $3 }' \
        | sort -u \
        | xargs -r dpkg-query -S \
        | cut -d: -f1 \
        | sort -u \
        | xargs -rt apt-mark manual; \
    \
    apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false; \
    rm -rf /var/lib/apt/lists/*

# Enable Short URLs
RUN a2enmod rewrite; \
    { \
    echo "<Directory /var/www/html>"; \
    echo "  RewriteEngine On"; \
    echo "  RewriteCond %{REQUEST_FILENAME} !-f"; \
    echo "  RewriteCond %{REQUEST_FILENAME} !-d"; \
    echo "  RewriteRule ^ %{DOCUMENT_ROOT}/index.php [L]"; \
    echo "</Directory>"; \
    } > "$APACHE_CONFDIR/conf-available/short-url.conf"; \
    a2enconf short-url

# Enable AllowEncodedSlashes for VisualEditor
RUN sed -i "s/<\/VirtualHost>/\tAllowEncodedSlashes NoDecode\n<\/VirtualHost>/" "$APACHE_CONFDIR/sites-available/000-default.conf"

# set recommended PHP.ini settings
# see https://secure.php.net/manual/en/opcache.installation.php
RUN { \
    echo 'opcache.memory_consumption=128'; \
    echo 'opcache.interned_strings_buffer=8'; \
    echo 'opcache.max_accelerated_files=4000'; \
    echo 'opcache.revalidate_freq=60'; \
    } > /usr/local/etc/php/conf.d/opcache-recommended.ini

# MediaWiki setup
WORKDIR /var/www/html
ARG MEDIAWIKI_VERSION
# Set the user agent as releases.wikimedia.org will 403 us otherwise
# hadolint ignore=DL4006
RUN set -eux; \
    curl -A "Mozilla/5.0" -fSL "https://releases.wikimedia.org/mediawiki/$(echo ${MEDIAWIKI_VERSION} | cut -d. -f1,2)/mediawiki-${MEDIAWIKI_VERSION}.tar.gz" -o mediawiki.tar.gz; \
    tar -x --strip-components=1 -f mediawiki.tar.gz; \
    rm -r mediawiki.tar.gz; \
    install -d /var/log/mediawiki -o www-data

# ###########################################################################
# The Composer builder is only published for AMD64 and produces portable PHP dependencies.
# hadolint ignore=DL3006,DL3029
FROM --platform=${COMPOSER_IMAGE_PLATFORM} ${COMPOSER_IMAGE_URL} AS composer

COPY --from=mediawiki --chown=nobody:nogroup /var/www/html /var/www/html
WORKDIR /var/www/html

# Ensure relaxed permissions so that the file is readable by the container user
COPY --chown=nobody:nogroup --chmod=755 build/composer.local.json composer.local.json

USER root
RUN set -eux; \
    sed -i 's|http://mirrors.wikimedia.org/debian/|http://deb.debian.org/debian/|g' /etc/apt/sources.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        patch \
        ; \
    rm -rf /var/lib/apt/lists/*
USER nobody

COPY --chown=nobody:nogroup --chmod=755 build/extensions.json /tmp/extensions.json
COPY --chown=nobody:nogroup --chmod=755 build/InstallExtensions.php /tmp/InstallExtensions.php
COPY --chown=nobody:nogroup --chmod=755 build/patches /tmp/patches
COPY --chown=nobody:nogroup --chmod=755 runtime/var/www/html/extensions /tmp/wbs-local-sources/runtime/var/www/html/extensions

SHELL ["/bin/bash", "-euo", "pipefail", "-c"]
RUN php /tmp/InstallExtensions.php /tmp/extensions.json /tmp/wbs-local-sources && \
    rm -rf composer.lock && \
    composer update --no-dev -vv -n

# ###########################################################################
# hadolint ignore=DL3006
FROM mediawiki AS wikibase

LABEL org.opencontainers.image.source="https://github.com/wmde/wikibase-suite"

ARG WIKIBASE_IMAGE_VERSION

ENV WIKIBASE_IMAGE_VERSION=${WIKIBASE_IMAGE_VERSION}

# Set error_reporting PHP.ini settings
# This is needed with PHP8+ and MediaWiki 1.39, as Wikibase contains deprecated code
# TODO: remove this and see how far we get
RUN { \
    echo 'error_reporting = E_ALL ^ E_DEPRECATED'; \
} > /usr/local/etc/php/conf.d/error_reporting.ini

COPY --from=composer --chown=nobody:nogroup /var/www/html /var/www/html
COPY --from=composer --chown=nobody:nogroup /tmp/extensions.json /opt/wbs/extensions.json

# Remove world writable flag, in combination with sticky bit it breaks the w link
# https://github.com/wmde/wikibase-suite/commit/545c7aeec8d0245dc597d500afc934b40e656b3c
# Make upload path writable for the webserver user
RUN chmod o-w /var/www/html && \
    ln -s /var/www/html/ /var/www/html/w && \
    chown www-data /var/www/html/images -R

# Copy image-owned runtime files into their final container paths. The generated
# /opt/wbs/extensions.json above remains separate because it comes from build.
COPY runtime/ /

RUN chmod 755 \
    /entrypoint.sh \
    /healthcheck.sh \
    /opt/wbs/setup/setup.sh \
    /opt/wbs/setup/migration/migrate.sh \
    /opt/wbs/setup/scripts/*.sh

ENV DB_NAME=my_wiki \
    MW_CONFIG_FILE=/opt/wbs/Settings.php \
    MW_WG_SITENAME=wikibase \
    MW_WG_LANGUAGE_CODE=en

ENTRYPOINT ["/entrypoint.sh"]
CMD ["web"]

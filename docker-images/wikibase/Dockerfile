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
    pecl install APCu-5.1.21; \
        docker-php-ext-enable \
        apcu \
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
COPY --chown=nobody:nogroup --chmod=755 composer.local.json composer.local.json

USER root
RUN set -eux; \
    sed -i 's|http://mirrors.wikimedia.org/debian/|http://deb.debian.org/debian/|g' /etc/apt/sources.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        patch \
        ; \
    rm -rf /var/lib/apt/lists/*
USER nobody

ARG WMF_EXTENSIONS="Wikibase,Babel,cldr,CirrusSearch,Elastica,Echo,EntitySchema,OAuth,PluggableAuth,UniversalLanguageSelector,WikibaseCirrusSearch,WikibaseManifest,WSOAuth"
ARG WIKIBASE_COMMIT
ARG BABEL_COMMIT
ARG CLDR_COMMIT
ARG CIRRUSSEARCH_COMMIT
ARG ELASTICA_COMMIT
ARG ECHO_COMMIT
ARG ENTITYSCHEMA_COMMIT
ARG OAUTH_COMMIT
ARG PLUGGABLEAUTH_COMMIT
ARG UNIVERSALLANGUAGESELECTOR_COMMIT
ARG WIKIBASECIRRUSSEARCH_COMMIT
ARG WIKIBASEMANIFEST_COMMIT
ARG WSOAUTH_COMMIT

# third-party extensions
ARG WIKIBASEEDTF_COMMIT
ARG WIKIBASELOCALMEDIA_COMMIT
ARG WIKIBASEINWIKITEXT_COMMIT

# WORKAROUND for https://phabricator.wikimedia.org/T372458
# Take wikibase submodules from github as phabricator rate limits us
COPY --chown=nobody:nogroup --chmod=755 \
  wikibase-submodules-from-github-instead-of-phabricator.patch \
  /tmp/wikibase-submodules-from-github-instead-of-phabricator.patch

SHELL ["/bin/bash", "-euo", "pipefail", "-c"]
RUN set -x; \
    IFS=',' read -ra EXTENSIONS <<< ${WMF_EXTENSIONS}; \
    for EXTENSION in "${EXTENSIONS[@]}"; do \
        rm -rf "extensions/${EXTENSION}" && \
        mkdir -p "extensions/${EXTENSION}" && \
        pushd "extensions/${EXTENSION}" && \
        git init . && \
        git remote add origin "https://gerrit.wikimedia.org/r/mediawiki/extensions/${EXTENSION}" && \
        EXTENSION_COMMIT_VAR="${EXTENSION^^}_COMMIT"; \
        EXTENSION_COMMIT="${!EXTENSION_COMMIT_VAR}"; \
        git fetch origin --depth 1 ${EXTENSION_COMMIT} && \
        git checkout ${EXTENSION_COMMIT} && \
        \
        if [ "${EXTENSION}" = "Wikibase" ]; then \
            patch -d /var/www/html/extensions/Wikibase -Np1 </tmp/wikibase-submodules-from-github-instead-of-phabricator.patch; \
        fi && \
        \
        git submodule update --init --recursive --depth 1 && \
        find . -name ".git*" -exec rm -rf {} + && \
        popd; \
    done && \
    \
    git clone "https://github.com/ProfessionalWiki/WikibaseEdtf.git" "extensions/WikibaseEdtf" && \
    git -C "extensions/WikibaseEdtf" checkout "${WIKIBASEEDTF_COMMIT}" && \
    rm -rf "extensions/WikibaseEdtf/.git*" && \
    \
    git clone "https://github.com/ProfessionalWiki/WikibaseLocalMedia.git" "extensions/WikibaseLocalMedia" && \
    git -C "extensions/WikibaseLocalMedia" checkout "${WIKIBASELOCALMEDIA_COMMIT}" && \
    rm -rf "extensions/WikibaseLocalMedia/.git*" && \
    \
    git clone "https://github.com/wbstack/mediawiki-extensions-WikibaseInWikitext.git" "extensions/WikibaseInWikitext" && \
    git -C "extensions/WikibaseInWikitext" checkout "${WIKIBASEINWIKITEXT_COMMIT}" && \
    rm -rf "extensions/WikibaseInWikitext/.git*" && \
    \
    rm -rf vendor && \
    rm -rf composer.lock && \
    ls -la && pwd && \
    composer install --no-dev -vv -n

# WORKAROUND for oauth on same domain problem introduced 
# by https://phabricator.wikimedia.org/T299737#8171169
COPY --chown=nobody:nogroup --chmod=755 \
  mediawiki-extensions-OAuth-same-domain.patch \
  /tmp/mediawiki-extensions-OAuth-same-domain.patch
RUN patch -d /var/www/html/extensions/OAuth -Np1 </tmp/mediawiki-extensions-OAuth-same-domain.patch

# ###########################################################################
# hadolint ignore=DL3006
FROM mediawiki AS wikibase

LABEL org.opencontainers.image.source="https://github.com/wmde/wikibase-release-pipeline"

ARG WIKIBASE_IMAGE_VERSION

ENV WIKIBASE_IMAGE_VERSION=${WIKIBASE_IMAGE_VERSION}

# Set error_reporting PHP.ini settings
# This is needed with PHP8+ and MediaWiki 1.39, as Wikibase contains deprecated code
# TODO: remove this and see how far we get
RUN { \
    echo 'error_reporting = E_ALL ^ E_DEPRECATED'; \
} > /usr/local/etc/php/conf.d/error_reporting.ini

COPY --from=composer --chown=nobody:nogroup /var/www/html /var/www/html

# Remove world writable flag, in combination with sticky bit it breaks the w link
# https://github.com/wmde/wikibase-release-pipeline/commit/545c7aeec8d0245dc597d500afc934b40e656b3c
# Make upload path writable for the webserver user
RUN chmod o-w /var/www/html && \
    ln -s /var/www/html/ /var/www/html/w && \
    chown www-data /var/www/html/images -R

COPY wikibase-php.ini /usr/local/etc/php/conf.d/wikibase-php.ini
COPY entrypoint.sh /entrypoint.sh
COPY callback.sh /callback.sh
COPY jobrunner-entrypoint.sh /jobrunner-entrypoint.sh
COPY --chmod=755 healthcheck.sh /healthcheck.sh
COPY htaccess /var/www/html/.htaccess
COPY extensions/WikibaseSuite /var/www/html/extensions/WikibaseSuite
COPY LocalSettings.d LocalSettings.d
COPY LocalSettings.MediaWiki.php /LocalSettings.MediaWiki.php
COPY LocalSettings.Extensions.php /LocalSettings.Extensions.php
COPY default-extra-install.sh /default-extra-install.sh
COPY oauth.ini /templates/oauth.ini
COPY LocalSettings.wbs.php /templates/LocalSettings.wbs.php

ENV DB_NAME=my_wiki \
    MW_WG_SITENAME=wikibase \
    MW_WG_LANGUAGE_CODE=en

ENTRYPOINT ["/bin/bash"]
CMD ["/entrypoint.sh"]

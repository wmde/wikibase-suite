ARG COMPOSER_IMAGE_URL
ARG COMPOSER_IMAGE_PLATFORM=linux/amd64
ARG PHP_IMAGE_URL

# ###########################################################################
# The Composer builder is only published for AMD64 and produces portable PHP dependencies.
# hadolint ignore=DL3006,DL3029
FROM --platform=${COMPOSER_IMAGE_PLATFORM} ${COMPOSER_IMAGE_URL} AS composer
ARG QUICKSTATEMENTS_COMMIT
ARG MAGNUSTOOLS_COMMIT
ARG MAGNUSTOOLS_ARCHIVE_SHA

RUN \
    git clone https://github.com/magnusmanske/quickstatements /tmp/quickstatements && \
    git -C /tmp/quickstatements checkout ${QUICKSTATEMENTS_COMMIT} && \
    git -C /tmp/quickstatements submodule update --init --recursive && \
    \
    php -r "exit(copy('https://codeberg.org/magnusmanske/magnustools/archive/${MAGNUSTOOLS_COMMIT}.tar.gz', '/tmp/magnustools.tar.gz') ? 0 : 1);" && \
    printf '%s  %s\n' "${MAGNUSTOOLS_ARCHIVE_SHA}" /tmp/magnustools.tar.gz > /tmp/magnustools.sha256 && \
    sha256sum --check --status /tmp/magnustools.sha256 && \
    mkdir /tmp/magnustools && \
    tar -xzf /tmp/magnustools.tar.gz --strip-components=1 -C /tmp/magnustools && \
    rm /tmp/magnustools.tar.gz /tmp/magnustools.sha256

WORKDIR /tmp/quickstatements
RUN composer install --no-dev

# ###########################################################################
# hadolint ignore=DL3006
FROM ${PHP_IMAGE_URL}
LABEL org.opencontainers.image.source="https://github.com/wmde/wikibase-release-pipeline"

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends gettext-base jq libicu-dev && \
    rm -rf /var/lib/apt/lists/* && \
    \
    docker-php-ext-configure intl && \
    docker-php-ext-install intl

COPY --from=composer /tmp/quickstatements /var/www/html/quickstatements
COPY --from=composer /tmp/magnustools /var/www/html/magnustools

COPY entrypoint.sh /entrypoint.sh

COPY config.json /templates/config.json
COPY oauth.ini /templates/oauth.ini
COPY php.ini /templates/php.ini

ENV APACHE_DOCUMENT_ROOT /var/www/html/quickstatements/public_html
RUN sed -ri -e "s!/var/www/html!${APACHE_DOCUMENT_ROOT}!g" /etc/apache2/sites-available/*.conf && \
    sed -ri -e "s!/var/www/!${APACHE_DOCUMENT_ROOT}!g" /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

ENV SITENAME=wikibase \
    LANGUAGE_CODE=en \
    PHP_TIMEZONE=UTC \
    WB_ITEM_NAMESPACE=120 \
    WB_PROPERTY_NAMESPACE=122 \
    WB_ITEM_PREFIX="Item:" \
    WB_PROPERTY_PREFIX="Property:"

RUN install -d -owww-data /var/log/quickstatements

ENTRYPOINT ["/bin/bash"]
CMD ["/entrypoint.sh"]

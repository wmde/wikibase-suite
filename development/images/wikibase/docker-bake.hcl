# Wikibase image manifest
#
# Extension source metadata and pins are in build/extensions.json.
# This file selects image-level build inputs, metadata, and tags.

variable "IMAGE_NAME" {
  default = "wikibase"
}

variable "IMAGE_VERSION" {
  default = "8.1.0"

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+\\.[0-9]+$", IMAGE_VERSION))
    error_message = "IMAGE_VERSION must be a stable MAJOR.MINOR.PATCH version."
  }
}

variable "IMAGE_REPOSITORY" {
  default = "wikibase/wikibase"
}

variable "TAGS" {
  type    = list(string)
  default = ["latest"]
}

# ==============================================================================
# MediaWiki
# ==============================================================================
# Selection, compatibility, and version-impact policy: ./UPDATING.md

variable "MEDIAWIKI" {
  default = {
    version       = "1.46.0"
    source        = "https://releases.wikimedia.org/mediawiki/"
    release_notes = "https://www.mediawiki.org/wiki/Release_notes/{line}"
  }
}

# ==============================================================================
# Base images
# ==============================================================================

variable "COMPOSER_IMAGE" {
  default = {
    image    = "docker-registry.wikimedia.org/releng/composer-php83"
    tag      = "8.3.23-s5"
    platform = "linux/amd64"
    source   = "https://docker-registry.wikimedia.org/releng/composer-php83/tags/"
  }
}

# Update only patch versions for security releases.
# Choose the latest LTS version for major releases.
variable "PHP_IMAGE" {
  default = {
    image  = "php"
    tag    = "8.3.23-apache-bookworm"
    source = "https://hub.docker.com/_/php"
    info   = "https://www.php.net/supported-versions.php"
  }
}

function "image_tags" {
  params = [tag]
  result = [for repository in split(",", IMAGE_REPOSITORY) : "${repository}:${tag}"]
}

target "wikibase-base" {
  args = {
    WIKIBASE_IMAGE_VERSION = IMAGE_VERSION
    MEDIAWIKI_VERSION      = MEDIAWIKI.version
    COMPOSER_IMAGE_URL     = "${COMPOSER_IMAGE.image}:${COMPOSER_IMAGE.tag}"
    COMPOSER_IMAGE_PLATFORM = COMPOSER_IMAGE.platform
    PHP_IMAGE_URL          = "${PHP_IMAGE.image}:${PHP_IMAGE.tag}"
  }

  labels = {
    "org.opencontainers.image.title"       = IMAGE_NAME
    "org.opencontainers.image.description" = "Wikibase Suite: a production-ready Wikibase stack"
    "org.opencontainers.image.version"     = IMAGE_VERSION
    "org.opencontainers.image.source"      = "https://github.com/wmde/wikibase-suite"
    "org.opencontainers.image.licenses"    = "GPL-2.0-or-later"
  }
}

target "wikibase" {
  inherits = ["wikibase-base"]
  tags     = image_tags(TAGS[0])
}

target "wikibase-release" {
  inherits = ["wikibase-base"]
  tags     = distinct(flatten(concat(image_tags(IMAGE_VERSION), [for tag in TAGS : image_tags(tag)])))
}

group "default" {
  targets = ["wikibase"]
}

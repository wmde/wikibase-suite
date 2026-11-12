# OpenSearch image manifest. Runtime build policy is supplied by wbs-dev.

variable "IMAGE_NAME" { default = "opensearch" }
variable "IMAGE_VERSION" { default = "1.0.0" }
variable "IMAGE_REPOSITORY" { default = "wikibase/opensearch" }
variable "TAGS" {
  type    = list(string)
  default = ["latest"]
}

# Selection, compatibility, and version-impact policy: ./UPDATING.md
variable "OPENSEARCH_IMAGE" {
  default = {
    image  = "opensearchproject/opensearch"
    tag    = "1.3.20"
    source = "https://hub.docker.com/r/opensearchproject/opensearch/tags"
  }
}

variable "OPENSEARCH_PLUGIN_WIKIMEDIA_EXTRA" {
  default = {
    version = "1.3.20-wmf9"
    source  = "https://central.sonatype.com/artifact/org.wikimedia.search/opensearch-extra"
  }
}

variable "OPENSEARCH_PLUGIN_WIKIMEDIA_HIGHLIGHTER" {
  default = {
    version = "1.3.20-wmf5"
    source  = "https://central.sonatype.com/artifact/org.wikimedia.search.highlighter/cirrus-highlighter-opensearch-plugin"
  }
}

function "image_tags" {
  params = [tags]
  result = [for tag in tags : "${IMAGE_REPOSITORY}:${tag}"]
}

# Prereleases keep the full version tag but do not move stable aliases.
function "release_tags" {
  params = [stable_aliases]
  result = image_tags(concat(
    [IMAGE_VERSION],
    length(split("-", IMAGE_VERSION)) > 1 ? [] : stable_aliases
  ))
}

target "opensearch-base" {
  context    = "."
  dockerfile = "Dockerfile"
  args = {
    OPENSEARCH_IMAGE_URL                    = "${OPENSEARCH_IMAGE.image}:${OPENSEARCH_IMAGE.tag}"
    OPENSEARCH_PLUGIN_WIKIMEDIA_EXTRA       = OPENSEARCH_PLUGIN_WIKIMEDIA_EXTRA.version
    OPENSEARCH_PLUGIN_WIKIMEDIA_HIGHLIGHTER = OPENSEARCH_PLUGIN_WIKIMEDIA_HIGHLIGHTER.version
  }
  labels = {
    "org.opencontainers.image.source"  = "https://github.com/wmde/wikibase-suite"
    "org.opencontainers.image.version" = IMAGE_VERSION
  }
}

target "opensearch" {
  inherits = ["opensearch-base"]
  tags     = image_tags(TAGS)
  output   = [{ type = "docker" }]
}

target "opensearch-release" {
  inherits = ["opensearch-base"]
  tags = release_tags([
    split(".", IMAGE_VERSION)[0],
    join(".", slice(split(".", IMAGE_VERSION), 0, 2)),
    "os${OPENSEARCH_IMAGE.tag}"
  ])
}

group "default" { targets = ["opensearch"] }

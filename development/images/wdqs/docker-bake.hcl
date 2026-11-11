# Query Service image manifest. Runtime build policy is supplied by wbs-dev.

variable "IMAGE_NAME" { default = "wdqs" }
variable "IMAGE_VERSION" { default = "2.2.0" }
variable "IMAGE_REPOSITORY" { default = "wikibase/wdqs" }
variable "TAGS" {
  type    = list(string)
  default = ["latest"]
}

# Selection, compatibility, and version-impact policy: ./UPDATING.md
variable "WDQS" {
  default = {
    kind            = "github-tags"
    repo            = "https://github.com/wikimedia/wikidata-query-rdf.git"
    tag_prefix      = "query-service-parent-"
    version         = "0.3.165"
    distribution    = "https://gitlab.wikimedia.org/api/v4/projects/2745/packages/maven/org/wikidata/query/rdf/service/{version}/service-{version}-dist.tar.gz"
  }
}

variable "JRE_IMAGE" {
  default = {
    image  = "eclipse-temurin"
    tag    = "8u412-b08-jre-jammy"
    source = "https://hub.docker.com/_/eclipse-temurin"
  }
}

variable "DEBIAN_IMAGE" {
  default = {
    image  = "debian"
    tag    = "bookworm-slim"
    source = "https://hub.docker.com/_/debian"
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

target "wdqs-base" {
  context    = "."
  dockerfile = "Dockerfile"
  args = {
    WDQS_VERSION     = WDQS.version
    JRE_IMAGE_URL    = "${JRE_IMAGE.image}:${JRE_IMAGE.tag}"
    DEBIAN_IMAGE_URL = "${DEBIAN_IMAGE.image}:${DEBIAN_IMAGE.tag}"
  }
  labels = {
    "org.opencontainers.image.source"  = "https://github.com/wmde/wikibase-suite"
    "org.opencontainers.image.version" = IMAGE_VERSION
  }
}

target "wdqs" {
  inherits = ["wdqs-base"]
  tags     = image_tags(TAGS)
  output   = [{ type = "docker" }]
}

target "wdqs-release" {
  inherits = ["wdqs-base"]
  tags = release_tags([
    split(".", IMAGE_VERSION)[0],
    join(".", slice(split(".", IMAGE_VERSION), 0, 2)),
    "wdqs${WDQS.version}"
  ])
}

group "default" { targets = ["wdqs"] }

# Wikidata Query Service compatibility proxy. Runtime build policy is supplied
# by wbs-dev. The upstream branch and immutable commit are deliberately both
# recorded so update tooling can track Foundation work reproducibly.

variable "IMAGE_NAME" { default = "wdqs-qlever-proxy" }
variable "IMAGE_VERSION" { default = "0.1.0" }
variable "IMAGE_REPOSITORY" { default = "wikibase/wdqs-qlever-proxy" }
variable "TAGS" {
  type    = list(string)
  default = ["latest"]
}

variable "WDQS_PROXY" {
  default = {
    repo   = "https://gitlab.wikimedia.org/repos/wikidata-platform/wdqs/wdqs-proxy.git"
    ref    = "refs/heads/label_service_mark2"
    commit = "b675070a5dbd828beaa33cd65ab1df5f29e407a1"
  }
}

variable "BUILD_IMAGE" {
  default = {
    image  = "eclipse-temurin"
    tag    = "25-jdk-noble"
    source = "https://hub.docker.com/_/eclipse-temurin"
  }
}

variable "RUNTIME_IMAGE" {
  default = {
    image  = "eclipse-temurin"
    tag    = "25-jre-noble"
    source = "https://hub.docker.com/_/eclipse-temurin"
  }
}

function "image_tags" {
  params = [tags]
  result = [for tag in tags : "${IMAGE_REPOSITORY}:${tag}"]
}

target "wdqs-qlever-proxy-base" {
  context    = "."
  dockerfile = "Dockerfile"
  args = {
    BUILD_IMAGE            = "${BUILD_IMAGE.image}:${BUILD_IMAGE.tag}"
    RUNTIME_IMAGE          = "${RUNTIME_IMAGE.image}:${RUNTIME_IMAGE.tag}"
    WDQS_PROXY_REPOSITORY  = WDQS_PROXY.repo
    WDQS_PROXY_COMMIT      = WDQS_PROXY.commit
  }
  labels = {
    "org.opencontainers.image.source"  = "https://github.com/wmde/wikibase-suite"
    "org.opencontainers.image.version" = IMAGE_VERSION
    "org.opencontainers.image.revision" = WDQS_PROXY.commit
  }
}

target "wdqs-qlever-proxy" {
  inherits = ["wdqs-qlever-proxy-base"]
  tags     = image_tags(TAGS)
  output   = [{ type = "docker" }]
}

target "wdqs-qlever-proxy-release" {
  inherits = ["wdqs-qlever-proxy-base"]
  tags = image_tags([
    IMAGE_VERSION,
    split(".", IMAGE_VERSION)[0],
    join(".", slice(split(".", IMAGE_VERSION), 0, 2))
  ])
}

group "default" { targets = ["wdqs-qlever-proxy"] }

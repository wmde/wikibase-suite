# Query Service frontend image manifest. Runtime policy is supplied by wbs-dev.

variable "IMAGE_NAME" { default = "wdqs-frontend" }
variable "IMAGE_VERSION" { default = "2.2.1" }
variable "IMAGE_REPOSITORY" { default = "wikibase/wdqs-frontend" }
variable "TAGS" {
  type    = list(string)
  default = ["latest"]
}

# Selection, review, and version-impact policy: ./UPDATING.md
variable "WDQS_QUERY_GUI" {
  default = {
    name     = "Wikidata Query GUI"
    repo     = "https://gitlab.wikimedia.org/repos/wmde/wikidata-query-gui.git"
    ref      = "refs/heads/main"
    commit   = "176149abd58c475f8670965fa6f695ca10274a56"
  }
}

variable "NGINX_IMAGE" {
  default = {
    image  = "nginx"
    tag    = "1.27.0-bookworm"
    source = "https://hub.docker.com/_/nginx"
  }
}

variable "NODE_IMAGE" {
  default = {
    image  = "node"
    tag    = "24.19.0-bookworm"
    source = "https://hub.docker.com/_/node"
  }
}

function "image_tags" {
  params = [tags]
  result = [for tag in tags : "${IMAGE_REPOSITORY}:${tag}"]
}

target "wdqs-frontend-base" {
  context    = "."
  dockerfile = "Dockerfile"
  args = {
    WDQSQUERYGUI_COMMIT = WDQS_QUERY_GUI.commit
    NGINX_IMAGE_URL     = "${NGINX_IMAGE.image}:${NGINX_IMAGE.tag}"
    NODE_IMAGE_URL      = "${NODE_IMAGE.image}:${NODE_IMAGE.tag}"
  }
  labels = {
    "org.opencontainers.image.source"  = "https://github.com/wmde/wikibase-suite"
    "org.opencontainers.image.version" = IMAGE_VERSION
  }
}

target "wdqs-frontend" {
  inherits = ["wdqs-frontend-base"]
  tags     = image_tags(TAGS)
  output   = [{ type = "docker" }]
}

target "wdqs-frontend-release" {
  inherits = ["wdqs-frontend-base"]
  tags = image_tags([
    IMAGE_VERSION,
    split(".", IMAGE_VERSION)[0],
    join(".", slice(split(".", IMAGE_VERSION), 0, 2))
  ])
}

group "default" { targets = ["wdqs-frontend"] }

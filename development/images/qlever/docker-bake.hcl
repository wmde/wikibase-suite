# QLever runtime image manifest. Runtime build policy is supplied by wbs-dev.

variable "IMAGE_NAME" { default = "qlever" }
variable "IMAGE_VERSION" { default = "0.1.0" }
variable "IMAGE_REPOSITORY" { default = "wikibase/qlever" }
variable "TAGS" {
  type = list(string)
  default = ["latest"]
}

# Pin the upstream multi-platform image by immutable OCI index digest.
variable "QLEVER_IMAGE" {
  default = {
    image = "adfreiburg/qlever"
    digest = "sha256:03b296357a1cec7e620e8e907d3f15dfc7bc845a5bcd7a295770e26fbd9a5a2e"
    source = "https://hub.docker.com/r/adfreiburg/qlever"
  }
}

function "image_tags" {
  params = [tags]
  result = [for tag in tags : "${IMAGE_REPOSITORY}:${tag}"]
}

target "qlever-base" {
  context = "."
  dockerfile = "Dockerfile"
  args = { QLEVER_IMAGE_URL = "${QLEVER_IMAGE.image}@${QLEVER_IMAGE.digest}" }
  labels = {
    "org.opencontainers.image.source" = "https://github.com/wmde/wikibase-suite"
    "org.opencontainers.image.version" = IMAGE_VERSION
  }
}
target "qlever" {
  inherits = ["qlever-base"]
  tags = image_tags(TAGS)
  output = [{ type = "docker" }]
}
target "qlever-release" {
  inherits = ["qlever-base"]
  tags = image_tags([IMAGE_VERSION, split(".", IMAGE_VERSION)[0], join(".", slice(split(".", IMAGE_VERSION), 0, 2))])
}
group "default" { targets = ["qlever"] }

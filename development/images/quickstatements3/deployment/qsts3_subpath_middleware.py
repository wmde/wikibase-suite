from urllib.parse import urlsplit, urlunsplit

from django.conf import settings


class PrefixRootRedirectMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.prefix = getattr(settings, "FORCE_SCRIPT_NAME", None)

    def __call__(self, request):
        response = self.get_response(request)
        location = response.get("Location")
        if self.prefix and location:
            parts = urlsplit(location)
            if not parts.scheme and not parts.netloc and parts.path.startswith("/"):
                if parts.path != self.prefix and not parts.path.startswith(self.prefix + "/"):
                    response["Location"] = urlunsplit(
                        (parts.scheme, parts.netloc, self.prefix + parts.path, parts.query, parts.fragment)
                    )
        return response

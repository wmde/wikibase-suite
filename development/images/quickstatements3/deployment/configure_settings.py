import sys
from pathlib import Path


settings_file = Path(sys.argv[1])
settings = settings_file.read_text()

replacements = (
    (
        'ALLOWED_HOSTS = ["qs-dev.toolforge.org", "localhost"]\n'
        'CSRF_TRUSTED_ORIGINS = ["http://localhost:8000", "https://qs-dev.toolforge.org/"]',
        'ALLOWED_HOSTS = [host.strip() for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if host.strip()]\n'
        'CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "http://localhost:8000").split(",") if origin.strip()]\n'
        'SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")',
    ),
    (
        '    "django.middleware.security.SecurityMiddleware",\n',
        '    "django.middleware.security.SecurityMiddleware",\n'
        '    "whitenoise.middleware.WhiteNoiseMiddleware",\n',
    ),
    (
        'STATIC_ROOT = os.getenv("STATIC_ROOT", os.path.join(BASE_DIR, "static"))',
        'QS3_URL_PREFIX = os.getenv("QS3_URL_PREFIX", "").rstrip("/")\n'
        'FORCE_SCRIPT_NAME = QS3_URL_PREFIX or None\n'
        'STATIC_URL = (QS3_URL_PREFIX + "/static/") if QS3_URL_PREFIX else "/static/"\n'
        'STATIC_ROOT = os.getenv("STATIC_ROOT", os.path.join(BASE_DIR, "static"))\n'
        'STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"',
    ),
    (
        'LOGIN_URL = "/auth/login/"',
        'LOGIN_URL = (os.getenv("QS3_URL_PREFIX", "").rstrip("/") + "/auth/login/") or "/auth/login/"',
    ),
    (
        'DEFAULT_WIKIBASE_URL = os.getenv("DEFAULT_WIKIBASE_URL", "https://www.wikidata.org")',
        'DEFAULT_WIKIBASE_URL = os.getenv("DEFAULT_WIKIBASE_URL", "https://www.wikidata.org")\n'
        'WIKIBASE_API_URL = os.getenv("WIKIBASE_API_URL", "").rstrip("/")',
    ),
    (
        '    "django.middleware.common.CommonMiddleware",\n',
        '    "django.middleware.common.CommonMiddleware",\n'
        '    "qsts3_subpath_middleware.PrefixRootRedirectMiddleware",\n',
    ),
)

for old, new in replacements:
    if settings.count(old) != 1:
        raise SystemExit(f"Expected one occurrence of upstream settings block: {old!r}")
    settings = settings.replace(old, new)

settings_file.write_text(settings)

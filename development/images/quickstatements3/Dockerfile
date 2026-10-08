ARG PYTHON_IMAGE=python:3.11-slim-bookworm

FROM ${PYTHON_IMAGE} AS build

ARG QUICKSTATEMENTS3_COMMIT=6821180999eba09a89c1dc5a1c62a01ebe5faa06

RUN apt-get update && apt-get install --yes --no-install-recommends \
        build-essential \
        default-libmysqlclient-dev \
        git \
        gettext \
        pkg-config \
    && rm -rf /var/lib/apt/lists/* \
    && git clone --depth 1 https://github.com/wikimediabrasil/quickstatements3.git /source \
    && git -C /source fetch --depth 1 origin "${QUICKSTATEMENTS3_COMMIT}" \
    && git -C /source checkout --detach FETCH_HEAD \
    && python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r /source/src/requirements.txt \
    && /opt/venv/bin/pip install --no-cache-dir gunicorn==23.0.0 whitenoise==6.9.0

FROM ${PYTHON_IMAGE}

LABEL org.opencontainers.image.title="QuickStatements 3"
LABEL org.opencontainers.image.source="https://github.com/wmde/wikibase-suite"
LABEL org.opencontainers.image.description="Wikibase Suite proof of concept for QuickStatements 3"

RUN apt-get update && apt-get install --yes --no-install-recommends \
        gettext \
        libmariadb3 \
        supervisor \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --home-dir /var/lib/quickstatements3 qs3 \
    && install -d -o qs3 -g qs3 /var/lib/quickstatements3/static

WORKDIR /app/src

COPY --from=build /opt/venv /opt/venv
COPY --from=build --chown=qs3:qs3 /source/src /app/src
COPY --from=build --chown=qs3:qs3 /source/translations /app/translations
COPY --from=build --chown=qs3:qs3 /source/LICENSE /app/LICENSE
COPY deployment/configure_settings.py /configure_settings.py
COPY deployment/patch_upstream.py /patch_upstream.py
COPY deployment/entrypoint.sh /entrypoint.sh
COPY deployment/entrypoint.py /deployment/entrypoint.py
COPY deployment/qsts3_subpath_middleware.py /app/src/qsts3_subpath_middleware.py
COPY deployment/supervisord.conf /etc/supervisor/conf.d/quickstatements3.conf

RUN python /configure_settings.py /app/src/qsts3/settings.py \
    && python /patch_upstream.py /app/src/core/models.py \
    && rm /configure_settings.py /patch_upstream.py \
    && chmod 755 /entrypoint.sh

ENV PATH=/opt/venv/bin:$PATH \
    PYTHONPATH=/app/src \
    DJANGO_SETTINGS_MODULE=qsts3.settings \
    QSTS_DEBUG=False \
    STATIC_ROOT=/var/lib/quickstatements3/static

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=90s --retries=3 \
    CMD curl --fail --silent http://localhost:8000/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]

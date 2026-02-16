# Removing Wikibase Suite Completely with all its Data

‼️ **This will destroy all data! [Back up](#back-up-your-data) anything you wish to retain.**

To reset the configuration and data, remove the Docker containers, Docker volumes and the generated `deploy/config` files.

```sh
docker compose down --volumes
rm -vf config/{LocalSettings.php,wikibase-php.ini,wdqs-frontend-config.json}
```

Removing the `traefik-letsencrypt-data` volume will request a new certificate from LetsEncrypt on the next launch of your instance. Certificate generation on LetsEncrypt is [rate-limited](https://letsencrypt.org/docs/rate-limits/); eventually you may be blocked from generating new certificates **for multiple days**. To avoid that outcome, change to the LetsEncrypt staging server by appending the following line to the `traefik` `command` stanza of your `docker-compose.yml` file:

```yml
--certificatesresolvers.letsencrypt.acme.caserver=https://acme-staging-v02.api.letsencrypt.org/directory
```

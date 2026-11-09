## Updating Existing Wikibase

This guide will help you update your current Wikibase to use the new Federated Statements feature which is in its Alpha Version. If you need to install a fresh Wikibase to try out the feature, please refer to our [other installation guide](./README.md).

---

### 1. Taking down your current instance

In order to take down your current Wikibase instance, you will need to SSH into your server.

Once you've done that, run:

```sh
docker compose down
```

---

### 2. Pulling new changes to install the feature

```sh
git fetch origin && git switch --detach origin/test-alpha-deployment
```
---

### 3. Restart your instance

```sh
docker compose pull
docker compose up -d
```

The first start may take a couple of minutes. You can check the status of the stack by running `docker compose ps` from another terminal. When your WBS Deploy instance is ready, the `wikibase` service will be marked `healthy`.

Your instance is now ready! It will already have the new feature ready for you to try 🎉

> [!NOTE]
> If anything goes wrong, you can run `docker logs <CONTAINER_NAME>` to see some helpful error messages. Should you run into some issues in this step, see [Troubleshooting](./docs/troubleshooting.md) after you fix the error.

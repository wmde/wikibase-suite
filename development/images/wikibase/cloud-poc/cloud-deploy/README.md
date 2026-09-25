# VPS deployment configuration mirror

This directory captures the non-secret configuration added to the POC VPS.
Its layout mirrors the target paths where practical. It is not a replacement
for `wbaas-deploy`: OpenTofu state, Kubernetes resources, Minikube's profile,
and DNS records are runtime infrastructure state.

The full repeatable setup and the reason for each deviation are in the
[Kubernetes validation record](../docs/kubernetes-validation.md).

## Files to install or apply

| Repository file | Target / operation |
| --- | --- |
| `etc/caddy/Caddyfile` | `/etc/caddy/Caddyfile`, then reload Caddy |
| `etc/systemd/system/minikube-wbaas-tunnel.service` | install at the same target path, daemon-reload, then enable it |
| `usr/local/bin/helm` | `/usr/local/bin/helm`; preserve the original binary as `/usr/local/bin/helm-real` |
| `etc/hosts` | append its managed record to `/etc/hosts` |
| `etc/cloud/templates/hosts.debian.tmpl` | append its managed record to the distribution's cloud-init template |
| `kubernetes/argocd/*.yaml` | apply with the documented `kubectl patch --type merge --patch-file` commands |

## Private POC Git remotes

The VPS holds private bare repositories at `/srv/git/api.git` and
`/srv/git/wbaas-deploy.git`. The local working copies use a `vps-poc` remote
that points to these repositories. The VPS deployment checkout at
`/root/wbaas-deploy` has the corresponding fetch remote; `/root/api-poc` is a
checkout of the API bare repository.

For an experimental branch, push from a local checkout with:

```sh
git push vps-poc HEAD:refs/heads/poc/<topic>
```

Then fetch and explicitly switch the relevant VPS checkout. This transfer does
not deploy a change: API source changes require an image build and deployment
reconciliation, while deployment-source changes require their normal render
and reconciliation steps.

## Values that must be refreshed for a rebuilt cluster

The mirrored configurations preserve the values used by the current VPS.
They are not portable constants:

- `10.96.129.101` is the Minikube tunnel's ingress LoadBalancer address. Obtain
  the new value with `kubectl -n ingress-nginx get svc ingress-nginx-controller`.
- `10.110.42.50` in the Caddyfile is the current `platform-nginx` ClusterIP.
  Obtain the new value with `kubectl -n default get svc platform-nginx`.
- `cloud-poc.wikibase-test-one.de` and its wildcard require matching public DNS
  records. Replace both the Caddy hostnames and Argo parameter values when a
  different controlled domain is used.

The wildcard proxy points directly to platform-nginx because the upstream local
Anubis image currently cannot be pulled with its placeholder registry secret.
That is a POC workaround and should be revisited before treating this layout as
a normal Cloud edge configuration.

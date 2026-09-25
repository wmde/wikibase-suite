# POC rollout strategy

The 32 GiB VPS runs the normal 1.43 services and the parallel 1.46 release at
the same time. A default rolling update temporarily adds a second pod, which
does not fit within the node's requested CPU capacity. After applying Helm or
Argo changes, use this temporary POC strategy for each deployment below:

```sh
for deployment in \
  mediawiki-146-app-alpha mediawiki-146-app-api \
  mediawiki-146-app-backend mediawiki-146-app-web \
  api-app-backend api-app-web api-queue-default api-scheduler
do
  kubectl -n default patch deployment "$deployment" --type merge \
    -p '{"spec":{"strategy":{"type":"RollingUpdate","rollingUpdate":{"maxSurge":0,"maxUnavailable":1}}}}'
done
```

This is an operational capacity workaround, not a recommended Cloud rollout
policy. Helm and Argo can restore their chart defaults on a later reconcile.

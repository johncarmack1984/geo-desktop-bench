# Deploy — geobench.johncarmack.com (AWS CDK)

CDK (TypeScript) app mirroring `manifest`'s setup. Provisions a private S3 bucket +
CloudFront (OAC) + ACM cert (us-east-1, DNS-validated) + Route53 alias in the
`johncarmack.com` zone (account `735853783919`), and uploads `site/dist` via
`BucketDeployment` (which also invalidates CloudFront).

## One-time

```sh
pnpm -C infra install
# only if this account/region has never run CDK:
pnpm -C infra exec cdk bootstrap aws://735853783919/us-east-1
```

## Deploy

```sh
export AWS_PROFILE=<admin-profile>
pnpm -C site build      # assemble report + live demos → site/dist
pnpm -C infra deploy    # cdk deploy: provision + upload + CloudFront invalidation
# or just: scripts/deploy.sh
```

`cdk deploy` does the HostedZone lookup (needs creds), stands everything up, and the
`BucketDeployment` syncs `site/dist`. First deploy takes a few minutes (cert validation +
CloudFront). A CloudFront Function rewrites `/render/` and `/capstone/` to their
`index.html` (OAC S3 origins are REST endpoints — no website index resolution).

## Notes

- `firenze.pmtiles` (~6 MB) is part of `site/dist` and lands at the bucket root, where
  `pmtiles:///firenze.pmtiles` resolves it for every demo. Run
  `scripts/fetch-sample-data.sh` first if it's missing locally.
- DNS: unlike albumclouds (records in `my-infra/dns`), this stack creates the `geobench`
  alias + cert-validation records itself via the zone lookup — no conflict with
  `my-infra/dns`.
- `cdk destroy` tears it all down (the bucket is `autoDeleteObjects`).

#!/usr/bin/env sh
# Build the site and deploy it to geobench.johncarmack.com via CDK. BucketDeployment
# uploads site/dist + invalidates CloudFront. Requires admin AWS creds. See infra/DEPLOY.md.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

pnpm -C "$ROOT/site" build
pnpm -C "$ROOT/infra" deploy

echo "deployed → https://geobench.johncarmack.com"

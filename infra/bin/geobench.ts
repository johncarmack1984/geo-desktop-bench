#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GeobenchStack } from '../lib/geobench-stack';
import { GeobenchCiStack } from '../lib/geobench-ci-stack';

const app = new cdk.App();
new GeobenchStack(app, 'GeobenchStack', {
  // The johncarmack.com hosted zone lives in this account (same as albumclouds);
  // the ACM cert must be us-east-1 for CloudFront.
  env: { account: '735853783919', region: 'us-east-1' },
});

// GitHub Actions CI deploy role (OIDC). Deployed by the routine `cdk deploy --all`
// (deploy.yml) alongside the site, so the role definition — including its
// main-pinned trust — stays in sync from CI with no local command. The CI deploy
// role updates its own stack through the CDK bootstrap roles; the initial create
// was a one-time admin `cdk deploy GeobenchCiStack`. The printed ARN is set as the
// repo variable AWS_DEPLOY_ROLE_ARN.
new GeobenchCiStack(app, 'GeobenchCiStack', {
  env: { account: '735853783919', region: 'us-east-1' },
});

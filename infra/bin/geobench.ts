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

// GitHub Actions CI deploy role (OIDC). Synthesized ONLY when explicitly targeting it
// (GEOBENCH_CI_DEPLOY=1), so the routine `cdk deploy` never touches it. Deploy once
// with admin creds, then set the printed ARN as the repo variable AWS_DEPLOY_ROLE_ARN.
if (process.env.GEOBENCH_CI_DEPLOY === '1') {
  new GeobenchCiStack(app, 'GeobenchCiStack', {
    env: { account: '735853783919', region: 'us-east-1' },
  });
}

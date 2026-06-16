#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GeobenchStack } from '../lib/geobench-stack';

const app = new cdk.App();
new GeobenchStack(app, 'GeobenchStack', {
  // The johncarmack.com hosted zone lives in this account (same as albumclouds);
  // the ACM cert must be us-east-1 for CloudFront.
  env: { account: '735853783919', region: 'us-east-1' },
});

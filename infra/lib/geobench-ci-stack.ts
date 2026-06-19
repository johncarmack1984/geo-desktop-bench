import * as cdk from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';

const GH = 'token.actions.githubusercontent.com';
const GITHUB_REPO = 'johncarmack1984/geo-desktop-bench';
const CDK_QUALIFIER = 'hnb659fds'; // default CDK bootstrap qualifier
// The account already has one GitHub OIDC provider (shared with manifest et al.);
// only one per host is allowed, so reuse it by ARN rather than create a second.
const OIDC_PROVIDER_ARN = `arn:aws:iam::735853783919:oidc-provider/${GH}`;

/**
 * GitHub Actions CI deploy role (OIDC) — the role `.github/workflows/deploy.yml`
 * assumes via a short-lived OIDC token, so the repo holds no long-lived AWS keys.
 * It can run `cdk deploy` (by assuming the account's CDK bootstrap roles) and nothing
 * else. Synthesized only with GEOBENCH_CI_DEPLOY=1 and deployed once with admin
 * creds — never by the routine `cdk deploy`.
 */
export class GeobenchCiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GitHubOidc',
      OIDC_PROVIDER_ARN,
    );

    const role = new iam.Role(this, 'DeployRole', {
      roleName: 'geobench-ci-deploy',
      description: 'GitHub Actions OIDC deploy role for geobench.johncarmack.com.',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        StringEquals: { [`${GH}:aud`]: 'sts.amazonaws.com' },
        // Only this repo's workflows (any branch/tag/PR) may assume the role.
        StringLike: { [`${GH}:sub`]: `repo:${GITHUB_REPO}:*` },
      }),
    });

    // `cdk deploy` does its work by assuming the account's CDK bootstrap roles
    // (deploy / file-publishing / lookup), so that assume-role is the only privilege
    // the deploy role itself needs.
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AssumeCdkBootstrapRoles',
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-${CDK_QUALIFIER}-*`],
      }),
    );

    new cdk.CfnOutput(this, 'CiDeployRoleArn', {
      description: 'Set this as the repo variable AWS_DEPLOY_ROLE_ARN',
      value: role.roleArn,
    });
  }
}

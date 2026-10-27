#!/usr/bin/env python3
"""
Deploy the Try1Second Edge Relay to AWS — NO docker required.

Creates: IAM role -> Lambda (python3.12 zip with curl_cffi) -> Function URL
         -> API Gateway HTTP API (POST / , prod stage)

Usage:
  AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... python3 deploy_zip.py
  (or set T1S_AWS_ACCESS_KEY_ID / T1S_AWS_SECRET_KEY, or AWS_ACCESS_KEY_ID_3 style names)

Prints EDGE_RELAY_AWS_URL / EDGE_RELAY_AWS_TOKEN for hPanel when done.

NOTE: the target account must NOT be blocked by an SCP for lambda:* and
apigateway:* (an explicit deny in a service control policy cannot be bypassed
by IAM). Run `aws sts get-caller-identity` first and confirm the account ID.
"""
import io
import json
import os
import secrets
import sys
import time

import boto3
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION_NAME_OVERRIDE", "ap-south-1")
FN_NAME = "try1second-edge-relay"
ROLE_NAME = "try1second-edge-relay-role"
API_NAME = "try1second-edge-relay-api"
HERE = os.path.dirname(os.path.abspath(__file__))
ZIP_PATH = os.path.join(HERE, "edge_relay_lambda.zip")


def creds():
    for ak, sk in (
        ("T1S_AWS_ACCESS_KEY_ID", "T1S_AWS_SECRET_KEY"),
        ("AWS_ACCESS_KEY_ID_3", "AWS_SECRET_ACCESS_KEY"),
        ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"),
    ):
        if os.environ.get(ak) and os.environ.get(sk):
            return os.environ[ak], os.environ[sk]
    sys.exit("No AWS credentials found in environment.")


def main():
    ak, sk = creds()
    kw = dict(aws_access_key_id=ak, aws_secret_access_key=sk, region_name=REGION)

    sts, iam, lam, apigw = (boto3.client(s, **kw) for s in ("sts", "iam", "lambda", "apigatewayv2"))
    ident = sts.get_caller_identity()
    account = ident["Account"]
    print(f"Account {account} | {ident['Arn']} | region {REGION}")

    # Fail fast with a clear message if the org SCP blocks us.
    for label, call in (
        ("lambda:ListFunctions", lambda: lam.list_functions(MaxItems=1)),
        ("apigateway:GetApis", lambda: apigw.get_apis(MaxResults="5")),
    ):
        try:
            call()
        except ClientError as e:
            msg = e.response["Error"].get("Message", "")
            print(f"BLOCKED {label}: {e.response['Error']['Code']} {msg[:200]}")
            if "service control policy" in msg:
                sys.exit("\nThis account is blocked by an AWS Organizations SCP.\n"
                         "Use the ORG MASTER account (SCPs do not apply there) or another account.")
            sys.exit(f"\nNo permission for {label}. Attach lambda:* and apigateway:* to the IAM user.")

    # ---- IAM role ----
    trust = {"Version": "2012-10-17", "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"}]}
    try:
        role_arn = iam.get_role(RoleName=ROLE_NAME)["Role"]["Arn"]
        print("role exists:", role_arn)
    except ClientError:
        role_arn = iam.create_role(RoleName=ROLE_NAME, AssumeRolePolicyDocument=json.dumps(trust))["Role"]["Arn"]
        iam.attach_role_policy(RoleName=ROLE_NAME,
                              PolicyArn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole")
        print("role created:", role_arn)
        time.sleep(12)  # IAM propagation

    token = os.environ.get("RELAY_TOKEN") or secrets.token_hex(24)

    # ---- Lambda ----
    with open(ZIP_PATH, "rb") as f:
        zbytes = f.read()
    print(f"package: {len(zbytes)/1024/1024:.1f} MB")
    cfg = dict(Runtime="python3.12", Role=role_arn, Handler="handler.lambda_handler",
               Timeout=60, MemorySize=2048, Environment={"Variables": {"RELAY_TOKEN": token}})
    try:
        lam.get_function(FunctionName=FN_NAME)
        lam.update_function_code(FunctionName=FN_NAME, ZipFile=zbytes)
        waiter = lam.get_waiter("function_updated")
        waiter.wait(FunctionName=FN_NAME)
        lam.update_function_configuration(FunctionName=FN_NAME, **{k: v for k, v in cfg.items() if k != "Runtime"})
        print("lambda updated")
    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
        lam.create_function(FunctionName=FN_NAME, ZipFile=zbytes, **cfg)
        lam.get_waiter("function_active").wait(FunctionName=FN_NAME)
        print("lambda created")

    fn = lam.get_function(FunctionName=FN_NAME)
    fn_arn = fn["Configuration"]["FunctionArn"]

    # ---- Function URL (fallback endpoint) ----
    try:
        fn_url = lam.get_function_url_config(FunctionName=FN_NAME)["FunctionUrl"]
    except ClientError:
        fn_url = lam.create_function_url_config(FunctionName=FN_NAME, AuthType="NONE")["FunctionUrl"]
        try:
            lam.add_permission(FunctionName=FN_NAME, StatementId="FunctionURLPublic",
                               Action="lambda:InvokeFunctionUrl", Principal="*",
                               FunctionUrlAuthType="NONE")
        except ClientError:
            pass

    # ---- API Gateway HTTP API (owner's preference) ----
    api_id = None
    for item in apigw.get_apis(MaxResults="100").get("Items", []):
        if item["Name"] == API_NAME:
            api_id = item["ApiId"]
            break
    if not api_id:
        api_id = apigw.create_api(Name=API_NAME, ProtocolType="HTTP")["ApiId"]
        integ = apigw.create_integration(ApiId=api_id, IntegrationType="AWS_PROXY",
                                        IntegrationUri=fn_arn, PayloadFormatVersion="2.0")["IntegrationId"]
        apigw.create_route(ApiId=api_id, RouteKey="POST /", Target=f"integrations/{integ}")
        apigw.create_stage(ApiId=api_id, StageName="prod", AutoDeploy=True)
        try:
            lam.add_permission(FunctionName=FN_NAME, StatementId="apigw-invoke",
                               Action="lambda:InvokeFunction", Principal="apigateway.amazonaws.com",
                               SourceArn=f"arn:aws:execute-api:{REGION}:{account}:{api_id}/*")
        except ClientError:
            pass
        print("api gateway created:", api_id)

    api_url = f"https://{api_id}.execute-api.{REGION}.amazonaws.com/prod/"
    print("\n" + "=" * 62)
    print("Put these in hPanel -> Environment Variables:")
    print(f"EDGE_RELAY_AWS_URL={api_url}")
    print(f"EDGE_RELAY_AWS_TOKEN={token}")
    print(f"# Function URL fallback: {fn_url}")
    print("=" * 62)
    print("\nSmoke test (run from anywhere):")
    print(f"""  curl -s -X POST "{api_url}" -H 'x-relay-token: {token}' \\
    -H 'content-type: application/json' \\
    -d '{{"url":"https://m.uber.com/looking","impersonate":"chrome"}}' | head -c 120""")


if __name__ == "__main__":
    main()

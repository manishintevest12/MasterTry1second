#!/usr/bin/env bash
# Deploy the Try1Second Edge Relay to AWS Lambda (container image + Function URL).
#
# Run this from a machine that has: docker, aws CLI (logged in), and network.
# AWS CloudShell works too (docker + aws preinstalled).
#
#   cd deploy/edge-relay-lambda
#   RELAY_TOKEN='some-long-random-secret' AWS_REGION=ap-south-1 ./deploy.sh
#
# It prints the Function URL at the end — paste that into hPanel env vars as
# EDGE_RELAY_AWS_URL, and the same RELAY_TOKEN as EDGE_RELAY_AWS_TOKEN.
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
FN="${RELAY_FN:-try1second-edge-relay}"
REPO="${RELAY_REPO:-try1second-edge-relay}"
TOKEN="${RELAY_TOKEN:-}"
MEM="${RELAY_MEM:-2048}"
TIMEOUT="${RELAY_TIMEOUT:-60}"

if [ -z "$TOKEN" ]; then
  echo "RELAY_TOKEN is required (shared secret). Example:" >&2
  echo "  RELAY_TOKEN=\"\$(openssl rand -hex 24)\" ./deploy.sh" >&2
  exit 1
fi

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
ECR="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

echo "==> ECR repo ${REPO} (${REGION})"
aws ecr describe-repositories --repository-names "$REPO" --region "$REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$REPO" --region "$REGION" >/dev/null

echo "==> docker build"
docker build --platform linux/amd64 -t "${REPO}:latest" .

echo "==> docker push"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR"
docker tag "${REPO}:latest" "${ECR}/${REPO}:latest"
docker push "${ECR}/${REPO}:latest"

echo "==> lambda function ${FN}"
if aws lambda get-function --function-name "$FN" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FN" --image-uri "${ECR}/${REPO}:latest" --region "$REGION" >/dev/null
  aws lambda wait function-updated --function-name "$FN" --region "$REGION"
  aws lambda update-function-configuration --function-name "$FN" \
    --timeout "$TIMEOUT" --memory-size "$MEM" \
    --environment "Variables={RELAY_TOKEN=${TOKEN}}" --region "$REGION" >/dev/null
else
  aws lambda create-function --function-name "$FN" \
    --package-type Image --code ImageUri="${ECR}/${REPO}:latest" \
    --role "$(aws iam get-role --role-name "${RELAY_ROLE:-try1second-edge-relay-role}" --query Role.Arn --output text 2>/dev/null || echo '')" \
    --timeout "$TIMEOUT" --memory-size "$MEM" \
    --environment "Variables={RELAY_TOKEN=${TOKEN}}" --region "$REGION" >/dev/null
fi

echo "==> Function URL (auth NONE — the RELAY_TOKEN header is the gate)"
URL="$(aws lambda get-function-url-config --function-name "$FN" --region "$REGION" --query FunctionUrl --output text 2>/dev/null || true)"
if [ -z "$URL" ] || [ "$URL" = "None" ]; then
  URL="$(aws lambda create-function-url-config --function-name "$FN" --auth-type NONE --region "$REGION" --query FunctionUrl --output text)"
  aws lambda add-permission --function-name "$FN" --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl --principal '*' --function-url-auth-type NONE --region "$REGION" >/dev/null 2>&1 || true
fi


echo "==> API Gateway (HTTP API in front of the Lambda)"
LAMBDA_ARN="$(aws lambda get-function --function-name "$FN" --query Configuration.FunctionArn --output text)"
API_ID="$(aws apigatewayv2 get-apis --query "Items[?Name=='${FN}-api'].ApiId | [0]" --output text)"
if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
  API_ID="$(aws apigatewayv2 create-api --name "${FN}-api" --protocol-type HTTP --query ApiId --output text)"
  INTEG="$(aws apigatewayv2 create-integration --api-id "$API_ID" --integration-type AWS_PROXY \
    --integration-uri "$LAMBDA_ARN" --payload-format-version "2.0" --query IntegrationId --output text)"
  aws apigatewayv2 create-route --api-id "$API_ID" --route-key 'POST /' --target "integrations/${INTEG}" >/dev/null
  aws apigatewayv2 create-stage --api-id "$API_ID" --stage-name prod --auto-deploy >/dev/null
  aws lambda add-permission --function-name "$FN" --statement-id apigw-invoke \
    --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT}:${API_ID}/*" >/dev/null 2>&1 || true
fi
API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod/"
echo "API Gateway URL: ${API_URL}"

cat <<EOF

============================================================
Deployed. Put these in hPanel -> Environment Variables:

  EDGE_RELAY_AWS_URL=${API_URL}
  # (Lambda Function URL, also works: ${URL})
  EDGE_RELAY_AWS_TOKEN=${TOKEN}

Then restart the Node app. No app/website build needed.
Smoke test:
  curl -s -X POST "${URL}" -H 'x-relay-token: ${TOKEN}' \\
    -H 'content-type: application/json' \\
    -d '{"url":"https://example.com","impersonate":"chrome"}'
============================================================
EOF

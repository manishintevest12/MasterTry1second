# Try1Second Edge Relay — AWS Lambda (container image)
#
# curl_cffi ships native code, so a container image is the reliable Lambda
# packaging (no manylinux wheel juggling). Build & push with deploy.sh.
FROM public.ecr.aws/lambda/python:3.12

# curl_cffi: Chrome/Safari TLS impersonation inside Lambda
RUN pip install --no-cache-dir "curl_cffi==0.13.0"

COPY handler.py ${LAMBDA_TASK_ROOT}/

# 2048 MB gives ~1 vCPU+ and fast TLS handshakes; raise for more concurrency.
CMD ["handler.lambda_handler"]

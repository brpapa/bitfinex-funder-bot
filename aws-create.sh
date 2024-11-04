#!/bin/zsh

source ./aws-vars.sh

# Step 1: Create ECR Repository (only if it doesn't already exist)
aws ecr describe-repositories --repository-names "${IMAGE_NAME}" --profile "${PROFILE}" > /dev/null 2>&1 || \
aws ecr create-repository --repository-name "${IMAGE_NAME}" --profile "${PROFILE}"

# Step 2: Authenticate Docker with ECR
aws ecr get-login-password --region "${REGION}" --profile "${PROFILE}" | docker login --username AWS --password-stdin "${ECR_REPO}"

# Step 3: Build, Tag, and Push Docker Image to ECR
docker build --platform linux/arm64 --tag "${IMAGE_NAME}" .
docker tag "${IMAGE_NAME}:latest" "${ECR_REPO}:latest"
docker push "${ECR_REPO}:latest"

# Step 4: Create Lambda Function Using the Container Image
aws lambda create-function --function-name "${FUNCTION_NAME}" \
--package-type Image \
--code ImageUri="${ECR_REPO}:latest" \
--role "arn:aws:iam::${AWS_ACCOUNT_ID}:role/service-role/basic-lambda-execute-rule" \
--profile "${PROFILE}"

# Step 5: Create an EventBridge Rule for Scheduled Invocation (every hour)
aws events put-rule --schedule-expression "cron(0 * * * ? *)" --name "${EVENT_RULE_NAME}" --profile "${PROFILE}"

# Step 6: Add Lambda as a Target for the Rule
aws events put-targets --rule "${EVENT_RULE_NAME}" --targets "Id"="1","Arn"="arn:aws:lambda:${REGION}:${AWS_ACCOUNT_ID}:function:${FUNCTION_NAME}" --profile "${PROFILE}"

# Step 7: Grant EventBridge Permission to Invoke Lambda
aws lambda add-permission --function-name "${FUNCTION_NAME}" \
--statement-id "${EVENT_RULE_NAME}Permission" \
--action 'lambda:InvokeFunction' \
--principal events.amazonaws.com \
--source-arn "arn:aws:events:${REGION}:${AWS_ACCOUNT_ID}:rule/${EVENT_RULE_NAME}" \
--profile "${PROFILE}"

echo "Creation script completed successfully."
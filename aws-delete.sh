#!/bin/zsh

source ./aws-vars.sh

echo "Deleting all resources for Lambda function '${FUNCTION_NAME}'..."

# Step 1: Remove EventBridge Rule and Target
# First, remove the target associated with the rule, then delete the rule itself.
aws events remove-targets --rule "${EVENT_RULE_NAME}" --ids "1" --profile "${PROFILE}" --region "${REGION}"
aws events delete-rule --name "${EVENT_RULE_NAME}" --profile "${PROFILE}" --region "${REGION}"

echo "EventBridge rule and target deleted."

# Step 2: Delete the Lambda Function
aws lambda delete-function --function-name "${FUNCTION_NAME}" --profile "${PROFILE}" --region "${REGION}"

echo "Lambda function deleted."

# Step 3: Delete the ECR Repository
aws ecr delete-repository --repository-name "${IMAGE_NAME}" --force --profile "${PROFILE}" --region "${REGION}"

echo "ECR repository and images deleted."

echo "All resources have been deleted successfully."
#!/bin/zsh

source ./aws-vars.sh

# Step 1: Authenticate Docker with ECR (skip this if already authenticated in the session)
aws ecr get-login-password --region "${REGION}" --profile "${PROFILE}" | docker login --username AWS --password-stdin "${ECR_REPO}"

# Step 2: Rebuild, Tag, and Push Docker Image to ECR
docker build --platform linux/arm64 --tag "${IMAGE_NAME}" .
docker tag "${IMAGE_NAME}:latest" "${ECR_REPO}:latest"
docker push "${ECR_REPO}:latest"

# Step 3: Update the Lambda Function to Use the New Image
aws lambda update-function-code --function-name "${FUNCTION_NAME}" \
--image-uri "${ECR_REPO}:latest" \
--profile "${PROFILE}"

# Step 4: List Images and Delete Old Images
# Get image digests of all images except the latest one
OLD_IMAGES=$(aws ecr list-images --repository-name "${IMAGE_NAME}" \
  --filter "tagStatus=UNTAGGED" \
  --query 'imageIds[*]' \
  --profile "${PROFILE}" \
  --region "${REGION}")

# Check if there are any old images to delete
if [ -n "$OLD_IMAGES" ]; then
  # Delete all old (untagged) images
  aws ecr batch-delete-image --repository-name "${IMAGE_NAME}" \
    --image-ids "$OLD_IMAGES" \
    --profile "${PROFILE}" \
    --region "${REGION}"
  echo "Old images deleted."
else
  echo "No old images to delete."
fi

echo "Update script completed successfully."

provider "aws" {
  profile    = var.profile
  region     = var.region
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key

  default_tags {
    tags = {
      app = "bitfinex-bot"
    }
  }
}

# ecr repository

resource "aws_ecr_repository" "this" {
  name                 = var.image_name
  image_tag_mutability = "MUTABLE"
}


resource "aws_ecr_lifecycle_policy" "this" {
  # ecr lifecycle policy to expire/remove untagged images

  depends_on = [aws_ecr_repository.this]
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images older than 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# if any file within lambda/** changes, run docker build locally and push a new image with latest tag to ECR repository 

locals {
  lambda_path         = "${path.module}/../lambda"
  lambda_files_hashes = join("", [for file in fileset("${local.lambda_path}", "**/*") : md5(file("${local.lambda_path}/${file}"))])
  lambda_hash         = md5(local.lambda_files_hashes)
}

resource "null_resource" "local_docker_build_tag_push" {
  depends_on = [aws_ecr_repository.this]

  triggers = {
    lambda_hash = local.lambda_hash
  }

  provisioner "local-exec" {
    working_dir = local.lambda_path
    command     = <<EOT
      aws ecr get-login-password --profile ${var.profile} --region ${var.region} | docker login --username AWS --password-stdin ${aws_ecr_repository.this.repository_url}

      docker build --platform linux/arm64 -t ${var.image_name} .
      docker tag ${var.image_name}:latest ${aws_ecr_repository.this.repository_url}:latest
      docker push ${aws_ecr_repository.this.repository_url}:latest
    EOT
  }
}

data "aws_ecr_image" "latest" {
  # to get the current image digest of image with latest tag, whichi it will force lambda changes if a new image was pushed
  depends_on = [null_resource.local_docker_build_tag_push]

  repository_name = aws_ecr_repository.this.name
  image_tag       = "latest"
}

# lambda

resource "aws_lambda_function" "this" {
  depends_on = [data.aws_ecr_image.latest]

  function_name = var.function_name
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.this.repository_url}@${data.aws_ecr_image.latest.image_digest}"
  role          = aws_iam_role.lambda_execution.arn
  timeout       = 30
}

# scheduled lambda invocation
resource "aws_cloudwatch_event_rule" "this" {
  name                = var.event_rule_name
  schedule_expression = "cron(0 * * * ? *)" # every hour
}

resource "aws_cloudwatch_event_target" "this" {
  rule      = aws_cloudwatch_event_rule.this.name
  target_id = "1"
  arn       = aws_lambda_function.this.arn
}

resource "aws_lambda_permission" "this" {
  # grant eventbridge permission to invoke lambda
  statement_id  = "${var.event_rule_name}Permission"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.this.arn
}

# alert topic

resource "aws_sns_topic" "alerts" {
  name = var.alerts_topic_name
}

resource "aws_sns_topic_subscription" "this" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "sms"
  endpoint  = var.alerts_phone_number # this number must be verified in sandbox destination phone numbers
}

# iam role that the lambda will assume
resource "aws_iam_role" "lambda_execution" {
  name = "lambda_execution_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_policy" {
  name        = "lambda_policy"
  description = "Policy for Lambda to publish to SNS and write logs to CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.alerts.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attachment" {
  # attach policy to the role
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

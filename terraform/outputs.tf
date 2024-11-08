output "ecr_repository_url" {
  value       = aws_ecr_repository.this.repository_url
}

output "event_rule_arn" {
  value       = aws_cloudwatch_event_rule.this.arn
}

output "lambda_function_arn" {
  value       = aws_lambda_function.this.arn
}

output "aws_sns_topic" {
  value       = aws_sns_topic.alerts.arn
}

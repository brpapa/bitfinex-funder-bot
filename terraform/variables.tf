variable "profile" {
  description = "AWS CLI profile to use"
  type        = string
}

variable "region" {
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  type        = string
}

variable "aws_access_key" {
  type      = string
  sensitive = true
}

variable "aws_secret_key" {
  type      = string
  sensitive = true
}

variable "image_name" {
  type        = string
}

variable "function_name" {
  type        = string
}

variable "event_rule_name" {
  type        = string
}

variable "alerts_topic_name" {
  type        = string
}

variable "alerts_phone_number" {
  type        = string
}

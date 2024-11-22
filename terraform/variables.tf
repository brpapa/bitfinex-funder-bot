variable "profile" {
  type    = string
  default = "default"
}

variable "region" {
  type = string
}

variable "aws_account_id" {
  type = string
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
  type = string
}

variable "function_name" {
  type = string
}

variable "bucket_name_prefix" {
  type = string
}

variable "event_rule_name" {
  type = string
}

variable "alerts_topic_name" {
  type = string
}

variable "alerts_email" {
  type = string
}

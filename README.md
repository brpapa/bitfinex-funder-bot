# Overview

No need to constantly check if your funds are lent on Bitfinex Funding. This bot automatically runs every 30 minutes, creating or updating funding offers to target the best available rates and periods. It also sends email alerts if your balance remains idle beyond a specified threshold.

Ensure you have a USD, EUR, or GBP balance in your funding wallet.

# Deployment

In the lambda folder:
  - Set up your `.env.prod` file with the necessary configuration.
  - Define your strategy [here](./lambda/src/funder/index.ts).
  
In the terraform folder:
  - Run `terraform init` to initialize Terraform.
  - Create a `terraform.tfvars` file to define your variables.
  - Run `terraform plan` to preview the deployment.
  - Run `terraform apply` to apply the changes and deploy the bot.

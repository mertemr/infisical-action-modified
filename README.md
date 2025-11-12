# Infisical Secrets Action

**⚠️ DISCLAIMER:** This is a forked version of the original [Infisical Secrets Action](https://github.com/Infisical/secrets-action) made by [Infisical](https://infisical.com). The modifications include additional features and updates not present in the original repository.

---

This GitHub Action enables you to import secrets from Infisical—whether hosted in the cloud or self-hosted—directly into your GitHub workflows.

### 🎉 New Changes in v1.1.0

- ⬆️ **Node.js 24 LTS**: Updated runtime from v20.7.0 to **v24.11.1** (latest LTS version)
- 🔒 **Security Updates**: Updated all dependencies to address known vulnerabilities
- 📦 **Package Modernization**: Refreshed npm packages to their latest stable versions

### Features in v1.0.16

- ✨ **Environment Variable Prefix/Suffix**: Add custom prefixes and suffixes to exported environment variables (e.g., `TF_VAR_`, `APP_*_PROD`)
- 📁 **Multiple File Formats**: Export secrets as `.env`, `.tfvars` (Terraform), `.sh` (Shell), or raw format
- 🧹 **Automatic File Cleanup**: Post-processing step automatically deletes exported files (optional, enabled by default)
- 🔒 **Docker-Safe Formatting**: Improved `.env` file format with proper escaping for Docker `--env-file`
- 🛡️ **Enhanced Special Character Handling**: Proper escaping for quotes, dollar signs, newlines, and more...

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage](#usage)
- [Examples](#examples)
- [Inputs Reference](#inputs)
- [Advanced Topics](#using-infisical-secrets-action-with-internal-ca-certificate)

## Quick Start

### Prerequisites

1. **Machine Identity**: Configure a [Machine Identity](https://infisical.com/docs/documentation/platform/identities/machine-identities) for your project.
2. **Authentication Method**: Choose one of three authentication methods:
   - [AWS IAM Auth](https://infisical.com/docs/documentation/platform/identities/aws-auth)
   - [OIDC](https://infisical.com/docs/documentation/platform/identities/oidc-auth/github)
   - [Universal Auth](https://infisical.com/docs/documentation/platform/identities/universal-auth) (client ID/secret)

### Minimal Workflow Example

```yaml
name: Deploy with Secrets
on: push

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Fetch secrets from Infisical
        uses: mertemr/infisical-action-modified@v1.0.16
        with:
          method: "universal"
          client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
          client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
          project-slug: "my-project"
          env-slug: "production"

      - name: Use secrets in deployment
        run: npm run deploy
        env:
          DATABASE_URL: ${{ env.DATABASE_URL }}
```

## Configuration

- In order to use this, you will need to configure a [Machine Identity](https://infisical.com/docs/documentation/platform/identities/machine-identities) for your project.
- This action supports three ways to authenticate your workflows with Infisical - [AWS IAM Auth](https://infisical.com/docs/documentation/platform/identities/aws-auth), [OIDC](https://infisical.com/docs/documentation/platform/identities/oidc-auth/github) and [universal auth](https://infisical.com/docs/documentation/platform/identities/universal-auth).

### AWS IAM Auth

- Configure a machine identity to use the "AWS Auth" method. Set the allowed principal ARNs, account IDs, and other settings as needed for your setup. Refer to the setup guide [here](https://infisical.com/docs/documentation/platform/identities/aws-auth).
- Get the machine identity's ID.
- Set `method` to aws-iam and configure the `identity-id` input parameter.
- Your GitHub Action runner must have access to AWS credentials (either through IAM roles, environment variables, or other AWS credential providers).
- Ensure your runner has network access to AWS STS API endpoints.

```yaml
- uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "aws-iam"
    identity-id: "24be0d94-b43a-41c4-812c-1e8654d9ce1e"
    domain: "https://app.infisical.com" # Update to the instance URL when using EU (https://eu.infisical.com), a dedicated instance, or a self-hosted instance
    env-slug: "dev"
    project-slug: "cli-integration-tests-9-edj"
```

### OIDC Auth

- Configure a machine identity to use the "OIDC Auth" method. Set the bound audience, bound subject, and bound claims as needed for your setup. Refer to the setup guide [here](https://infisical.com/docs/documentation/platform/identities/oidc-auth/github).
- Get the machine identity's ID.
- Set `method` to oidc and configure the `identity-id` input parameter. Optionally, customize the JWT's aud field by setting the `oidc-audience` input parameter.
- For debugging OIDC configuration issues, you can use GitHub's [actions-oidc-debugger](https://github.com/github/actions-oidc-debugger) tool. This tool helps you inspect the JWT claims and verify they match your configuration.
- Add `id-token: write` to the permissions for your workflow:

```
permissions:
  id-token: write
  contents: read
```

### Universal Auth

- Configure a machine identity to have an auth method of "Universal Auth".
- Get the machine identity's `client_id` and `client_secret` and store them as Github secrets (recommended) or environment variables.
- Set the `client-id` and `client-secret` input parameters.

## Usage

This action supports multiple export modes and formats for maximum flexibility:

- **Export as Environment Variables** - Inject secrets directly into your workflow
- **Export as File** - Generate `.env`, `.tfvars`, `.sh`, or raw files
- **Custom Prefixes/Suffixes** - Transform variable names (e.g., `TF_VAR_`, `APP_*_PROD`)
- **Multiple Formats** - Docker-safe `.env`, Terraform HCL, Shell scripts, and more
- **Automatic Cleanup** - Optional post-processing file deletion

### Quick Start

#### 1. Export as Environment Variables (Default)

Secrets are injected as environment variables and can be referenced by subsequent workflow steps.

```yaml
- uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "oidc"
    identity-id: "24be0d94-b43a-41c4-812c-1e8654d9ce1e"
    project-slug: "my-project"
    env-slug: "production"

- name: Use secrets in next step
  run: echo "Database URL: $DATABASE_URL"
```

#### 2. Export as Docker-Safe .env File

Perfect for containerized applications using `docker run --env-file`.

```yaml
- uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "oidc"
    identity-id: "24be0d94-b43a-41c4-812c-1e8654d9ce1e"
    project-slug: "my-project"
    env-slug: "production"
    export-type: "file"
    file-output-path: "/.env"
    file-output-format: "dotenv"

- name: Build and Run Docker Container
  run: docker run --env-file .env my-app:latest
```

#### 3. Export as Terraform Variables

Generate `.tfvars` file for Terraform deployments with automatic prefix.

```yaml
- uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "universal"
    client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
    client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
    project-slug: "terraform-project"
    env-slug: "staging"
    export-type: "file"
    file-output-path: "/terraform.tfvars"
    file-output-format: "terraform"
    env-prefix: "TF_VAR_"
    clean: "false" # Keep file for terraform apply

- name: Run Terraform Plan
  run: terraform plan
```

Generated file example:

```hcl
TF_VAR_database_url = "postgresql://user:pass@host/db"
TF_VAR_api_key = "sk_prod_abc123"
```

#### 4. Export with Custom Prefix and Suffix

Transform variable names to match your naming conventions.

```yaml
- uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "universal"
    client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
    client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
    project-slug: "my-app"
    env-slug: "production"
    env-prefix: "APP_"
    env-suffix: "_PROD"

- name: Use prefixed/suffixed variables
  run: echo "URL: $APP_api_url_PROD"
```

Result: `api_url` becomes `APP_api_url_PROD`

#### 5. Export as Shell Script

Generate executable shell script for sourcing.

```yaml
- uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "oidc"
    identity-id: ${{ secrets.INFISICAL_IDENTITY_ID }}
    project-slug: "my-project"
    env-slug: "development"
    export-type: "file"
    file-output-path: "/secrets.sh"
    file-output-format: "shell"
    clean: "false"

- name: Source and Use Secrets
  run: |
    source ./secrets.sh
    ./deploy.sh
```

Generated file example:

```bash
export DATABASE_URL='postgresql://user:pass@localhost/db'
export API_KEY='secret_key_value'
```

#### 6. Export All Secrets with Recursive and Imports

Fetch all secrets from a path including nested directories and imports.

```yaml
- uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "aws-iam"
    identity-id: ${{ secrets.INFISICAL_IDENTITY_ID }}
    project-slug: "microservices"
    env-slug: "production"
    secret-path: "/"
    recursive: "true" # Include all subdirectories
    include-imports: "true" # Include imported secrets
    export-type: "file"
    file-output-path: "/.env"
    file-output-format: "dotenv"
```

## Examples

### Example 1: Basic Environment Variables Export

```yaml
- name: Fetch Infisical Secrets
  uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "universal"
    client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
    client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
    project-slug: "my-project"
    env-slug: "production"
```

### Example 2: Export Secrets as .env File for Docker

```yaml
- name: Fetch and Export Secrets
  uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "oidc"
    identity-id: ${{ secrets.INFISICAL_IDENTITY_ID }}
    project-slug: "my-project"
    env-slug: "production"
    export-type: "file"
    file-output-path: "/.env"
    file-output-format: "dotenv" # Docker-safe format with double quotes

- name: Build and Run Docker Container
  run: docker run --env-file .env my-app:latest
```

### Example 3: Terraform Variables with Prefix

```yaml
- name: Fetch Secrets for Terraform
  uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "universal"
    client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
    client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
    project-slug: "terraform-project"
    env-slug: "staging"
    export-type: "file"
    file-output-path: "/terraform.tfvars"
    file-output-format: "terraform"
    env-prefix: "TF_VAR_"
    clean: "false" # Keep file for terraform apply

- name: Run Terraform Plan
  run: terraform plan
```

### Example 4: Custom Prefix and Suffix

```yaml
- name: Fetch Secrets with Custom Naming
  uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "universal"
    client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
    client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
    project-slug: "my-app"
    env-slug: "production"
    env-prefix: "APP_"
    env-suffix: "_PROD"
    # Result: db_password becomes APP_db_password_PROD

- name: Use Custom Variables
  run: echo "Database URL: $APP_db_url_PROD"
```

### Example 5: Shell Script Export

```yaml
- name: Export Secrets as Shell Script
  uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "oidc"
    identity-id: ${{ secrets.INFISICAL_IDENTITY_ID }}
    project-slug: "my-project"
    env-slug: "development"
    export-type: "file"
    file-output-path: "/secrets.sh"
    file-output-format: "shell"
    clean: "false"

- name: Source and Use Secrets
  run: |
    source ./secrets.sh
    ./deploy.sh
```

### Example 6: Recursive Secrets with Imports

```yaml
- name: Fetch All Project Secrets
  uses: mertemr/infisical-action-modified@v1.0.16
  with:
    method: "aws-iam"
    identity-id: ${{ secrets.INFISICAL_IDENTITY_ID }}
    project-slug: "microservices"
    env-slug: "production"
    secret-path: "/"
    recursive: "true" # Include all subdirectories
    include-imports: "true" # Include imported secrets
    export-type: "file"
    file-output-path: "/.env"
```

### Example 7: Multiple Environment Exports

```yaml
- name: Fetch Development Secrets
  uses: mertemr/infisical-action-modified@v1.0.16
  id: dev-secrets
  with:
    method: "universal"
    client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
    client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
    project-slug: "my-project"
    env-slug: "development"
    env-prefix: "DEV_"

- name: Fetch Production Secrets
  uses: mertemr/infisical-action-modified@v1.0.16
  id: prod-secrets
  with:
    method: "universal"
    client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
    client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
    project-slug: "my-project"
    env-slug: "production"
    env-prefix: "PROD_"
```

## Inputs

### `method`

**Optional**. The authentication method to use. Defaults to `universal`. Possible values are `universal`, `oidc`, and `aws-iam`

### `client-id`

**Optional**. Machine Identity client ID

### `client-secret`

**Optional**. Machine Identity secret key

### `identity-id`

**Optional**. Machine Identity ID

### `oidc-audience`

**Optional**. Custom aud claim for the signed Github ID token

### `project-slug`

**Required**. Source project slug

### `env-slug`

**Required**. Source environment slug

### `domain`

**Optional**. Infisical URL. Defaults to https://app.infisical.com. If you're using Infisical EU (https://eu.infisical.com) or a self-hosted/dedicated instance, you will need to set the appropriate value for this field.

### `export-type`

**Optional**. If set to `env`, it will set the fetched secrets as environment variables for subsequent steps of a workflow. If set to `file`, it will export the secrets in a .env file in the defined file-output-path. Defaults to `env`

### `file-output-path`

**Optional**. The path to save the file when export-type is set to `file`. Defaults to `/.env`

### `secret-path`

**Optional**. Source secret path. Defaults to `/`. Example: `/my-secret-path`.

### `include-imports`

**Optional**. If set to `true`, it will include imported secrets. Defaults to `true`

### `recursive`

**Optional**. If set to `true`, it will fetch all secrets from the specified base path and all of its subdirectories. Defaults to `false`

### `extra-headers`

**Optional**. You can optionally provide extra headers that will be included in every request made to Infisical. This is useful if your Infisical instance is behind a header-based firewall.

Example:

```yaml
extra-headers: |
  Example-Header: Header-Value
  X-Request-Id: 1234567890
  X-Authentication-Secret: ${{ secrets.AUTH_SECRET }}
```

### `env-prefix`

**Optional**. Prefix to add to all exported environment variable names. Useful for tools like Terraform that require prefixed variables (e.g., `TF_VAR_`). Defaults to empty string.

Example:

```yaml
- uses: mertemr/infisical-action-modified@v1.0.16
  with:
    env-prefix: "TF_VAR_"
    # Result: my_secret becomes TF_VAR_my_secret
```

### `env-suffix`

**Optional**. Suffix to add to all exported environment variable names. Defaults to empty string.

Example:

```yaml
- uses: mertemr/infisical-action-modified@v1.0.16
  with:
    env-prefix: "APP_"
    env-suffix: "_PROD"
    # Result: db_password becomes APP_db_password_PROD
```

### `file-output-format`

**Optional**. File format when export-type is set to `file`. Options:

- `dotenv` (default, **RECOMMENDED for Docker**): Uses double quotes, safe with `docker run --env-file`
- `dotenv-safe`: Alias for dotenv with enhanced escaping
- `terraform`: Terraform `.tfvars` format (use with `.tfvars` extension)
- `shell`: Shell export format with `export` keyword (use with `.sh` extension)
- `raw`: Unquoted format with minimal escaping

Defaults to `dotenv`. **For Docker environments, always use `dotenv` format to avoid parsing issues.**

Example:

```yaml
- uses: mertemr/infisical-action-modified@v1.0.16
  with:
    export-type: "file"
    file-output-path: "/terraform.tfvars"
    file-output-format: "terraform"
    # Generates: KEY = "value" (Terraform format)
```

### `clean`

**Optional**. If set to `true`, the exported `.env` file will be deleted after the workflow step completes (automatic cleanup). This uses a post-processing step to ensure cleanup happens even if subsequent steps fail. Defaults to `true`.

Example:

```yaml
# Keep the file for later use
- uses: mertemr/infisical-action-modified@v1.0.16
  with:
    export-type: "file"
    clean: "false"

# Or use default cleanup
- uses: mertemr/infisical-action-modified@v1.0.16
  with:
    export-type: "file"
    # clean: "true" (default)
```

# Using Infisical Secrets Action with Internal CA Certificate

When your Infisical instance uses an internal Certificate Authority (CA) that isn't trusted by default in GitHub Actions runners, you'll need to configure the action to recognize your custom CA certificate.

## Setup

### 1. Add your CA certificate to your repository

- Save your CA certificate file (e.g., `ca-certificate.pem`) in your repository root or `.github/` directory
- Ensure the certificate is in PEM format

### 2. Configure the GitHub Actions workflow to use it

```yaml
jobs:
  your-job-name:
    runs-on: ubuntu-latest
    env:
      NODE_EXTRA_CA_CERTS: ./ca-certificate.pem # Path to your CA certificate
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Infisical Secrets
        uses: mertemr/infisical-action-modified@v1.0.16
        with:
          method: "universal"
          domain: "https://<infisical instance url>" # Your internal Infisical domain
          # rest of the parameters
```

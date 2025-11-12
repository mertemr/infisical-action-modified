import core from "@actions/core";
import { UALogin, getRawSecrets, oidcLogin, awsIamLogin, createAxiosInstance } from "./infisical";
import fs from "fs/promises";
import { AuthMethod } from "./constants";

function parseHeadersInput(inputKey: string) {
  const rawHeadersString = core.getInput(inputKey) || "";

  const headerStrings = rawHeadersString
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const parsedHeaderStrings = headerStrings.reduce(
    (obj, line) => {
      const seperator = line.indexOf(":");
      const key = line.substring(0, seperator).trim().toLowerCase();
      const value = line.substring(seperator + 1).trim();
      if (obj[key]) {
        obj[key] = [obj[key], value].join(", ");
      } else {
        obj[key] = value;
      }
      return obj;
    },
    {} as Record<string, string>
  );

  return parsedHeaderStrings;
}

function formatSecretsContent(secrets: Record<string, string>, format: string, prefix: string, suffix: string): string {
  const entries = Object.entries(secrets).map(([key, value]) => {
    const prefixedKey = `${prefix}${key}${suffix}`;

    if (format === "terraform") {
      // Terraform format: key = "value"
      // Escape double quotes and newlines in the value
      const escapedValue = value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
      return `${prefixedKey} = "${escapedValue}"`;
    } else if (format === "raw") {
      // Raw format: key=value (no quotes)
      // Escape special shell characters
      const escapedValue = value.replace(/(['"\$`\\])/g, "\\$1");
      return `${prefixedKey}=${escapedValue}`;
    } else if (format === "shell") {
      // Shell export format: export key='value'
      // Escape single quotes using '\'' technique
      const escapedValue = value.replace(/'/g, "'\\''");
      return `export ${prefixedKey}='${escapedValue}'`;
    } else if (format === "dotenv" || format === "dotenv-safe") {
      // DotEnv format with double quotes (Docker/node-dotenv safe)
      // More reliable than single quotes for Docker --env-file
      // Escape: backslash, double quotes, newlines, and variable expansion ($)
      const escapedValue = value
        .replace(/\\/g, "\\\\") // Escape backslashes first
        .replace(/"/g, '\\"') // Escape double quotes
        .replace(/\$/g, "\\$") // Escape $ to prevent variable expansion
        .replace(/\n/g, "\\n") // Escape newlines
        .replace(/\r/g, "\\r"); // Escape carriage returns
      return `${prefixedKey}="${escapedValue}"`;
    }

    // Fallback to dotenv-safe (double quotes) if format is not recognized
    const escapedValue = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\$/g, "\\$")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
    return `${prefixedKey}="${escapedValue}"`;
  });

  return entries.join("\n");
}

function getRecommendedFileExtension(format: string): string {
  switch (format.toLowerCase()) {
    case "terraform":
      return ".tfvars";
    case "shell":
      return ".sh";
    case "raw":
    case "dotenv":
    default:
      return ".env";
  }
}

function validateAndAdjustPath(filePath: string, format: string): { path: string; warning?: string } {
  const recommendedExt = getRecommendedFileExtension(format);
  const hasCorrectExt = filePath.endsWith(recommendedExt);

  if (!hasCorrectExt) {
    const warning = `Warning: Format is '${format}' but file extension is not '${recommendedExt}'. Recommended: ${filePath.replace(/\.[^/.]+$/, recommendedExt)}`;
    return { path: filePath, warning };
  }

  return { path: filePath };
}

const main = async () => {
  try {
    const method = core.getInput("method");
    const UAClientId = core.getInput("client-id");
    const UAClientSecret = core.getInput("client-secret");
    const identityId = core.getInput("identity-id");
    const oidcAudience = core.getInput("oidc-audience");
    const domain = core.getInput("domain");
    const envSlug = core.getInput("env-slug");
    const projectSlug = core.getInput("project-slug");
    const secretPath = core.getInput("secret-path");
    const exportType = core.getInput("export-type");
    const fileOutputPath = core.getInput("file-output-path");
    const fileOutputFormat = core.getInput("file-output-format");
    const shouldIncludeImports = core.getBooleanInput("include-imports");
    const shouldRecurse = core.getBooleanInput("recursive");
    const extraHeaders = parseHeadersInput("extra-headers");
    const envPrefix = core.getInput("env-prefix");
    const envSuffix = core.getInput("env-suffix");

    // get infisical token using credentials
    let infisicalToken;

    const axiosInstance = createAxiosInstance(domain, extraHeaders);

    switch (method) {
      case AuthMethod.Universal: {
        if (!(UAClientId && UAClientSecret)) {
          throw new Error("Missing universal auth credentials");
        }
        infisicalToken = await UALogin({
          axiosInstance,
          clientId: UAClientId,
          clientSecret: UAClientSecret
        });
        break;
      }
      case AuthMethod.Oidc: {
        if (!identityId) {
          throw new Error("Missing identity ID for OIDC auth");
        }
        infisicalToken = await oidcLogin({
          axiosInstance,
          identityId,
          oidcAudience
        });
        break;
      }
      case AuthMethod.AwsIam: {
        if (!identityId) {
          throw new Error("Missing identity ID for AWS IAM auth");
        }
        infisicalToken = await awsIamLogin({
          axiosInstance,
          identityId
        });
        break;
      }
      default:
        throw new Error(`Invalid authentication method: ${method}`);
    }

    // get secrets from Infisical using input params
    const keyValueSecrets = await getRawSecrets({
      axiosInstance,
      envSlug,
      infisicalToken,
      projectSlug,
      secretPath,
      shouldIncludeImports,
      shouldRecurse
    });

    core.debug(`Exporting the following envs", ${JSON.stringify(Object.keys(keyValueSecrets))}`);

    // export fetched secrets
    if (exportType === "env") {
      // Write the secrets to action ENV
      Object.entries(keyValueSecrets).forEach(([key, value]) => {
        const prefixedKey = `${envPrefix}${key}${envSuffix}`;
        core.setSecret(value);
        core.exportVariable(prefixedKey, value);
      });
      core.info("Injected secrets as environment variables");
    } else if (exportType === "file") {
      // Write the secrets to a file at the specified path
      const fileContent = formatSecretsContent(keyValueSecrets, fileOutputFormat, envPrefix, envSuffix);

      try {
        const filePath = `${process.env.GITHUB_WORKSPACE}${fileOutputPath}`;

        // Validate file extension matches format
        const validation = validateAndAdjustPath(fileOutputPath, fileOutputFormat);
        if (validation.warning) {
          core.warning(validation.warning);
        }

        core.info(`Exporting secrets to ${filePath} in ${fileOutputFormat} format`);
        await fs.writeFile(filePath, fileContent);
        core.info("Successfully exported secrets to file");
      } catch (err) {
        core.error(`Error writing file: ${(err as Error)?.message}`);
        throw err;
      }
    }
  } catch (err) {
    core.setFailed((err as Error)?.message);
  }
};

main();

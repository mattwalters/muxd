import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { execSync } from "child_process";
import { Config, ConfigSchema, ProcessConfig } from "./schema";

// Determine configuration file path from command line args
function getConfigFilePath(): string {
  const args = process.argv.slice(2);
  const configFlagIndex = args.indexOf("-C");

  if (configFlagIndex !== -1 && args[configFlagIndex + 1]) {
    return path.resolve(process.cwd(), args[configFlagIndex + 1]);
  } else {
    return path.resolve(process.cwd(), "muxd.config.json");
  }
}

// Load and validate the configuration file
export function loadConfig(): Config {
  const configFilePath = getConfigFilePath();
  console.log("configFilePath", configFilePath);

  if (!fs.existsSync(configFilePath)) {
    console.error("Configuration file not found:", configFilePath);
    process.exit(1);
  }

  const configContent = fs.readFileSync(configFilePath, "utf8");
  const parsedConfig = ConfigSchema.safeParse(JSON.parse(configContent));

  if (!parsedConfig.success) {
    console.error("Invalid configuration:", parsedConfig.error.format());
    process.exit(1);
  }

  const config = parsedConfig.data;
  console.log("config", config);

  // Handle docker-compose if specified
  if (config.dockerCompose) {
    processDockerComposeConfig(config);
  }

  return config;
}

// Process docker-compose configuration
function processDockerComposeConfig(config: Config): void {
  console.log("Using docker compose...");
  const composePath = path.resolve(process.cwd(), config.dockerCompose!.file);

  if (!fs.existsSync(composePath)) {
    console.error("Docker-compose file not found:", composePath);
    process.exit(1);
  }

  console.log(`Using docker-compose file: ${composePath}`);

  // Start docker-compose services
  try {
    console.log("Starting docker compose services...");
    let profile = config.dockerCompose?.profile ?? "";
    if (profile) {
      profile = ` --profile ${profile}`;
    }
    const dockerCommand = `docker compose${profile} -f "${composePath}" up -d`;
    console.log("dockerCompose aaaaaa", dockerCommand);
    execSync(dockerCommand, {
      stdio: "inherit",
    });
  } catch (err: any) {
    console.error("Failed to start docker-compose services:", err.message);
    process.exit(1);
  }

  // Add docker-compose services to the configuration
  try {
    addDockerComposeServices(config, composePath);
  } catch (err: any) {
    console.error("Error processing docker-compose file:", err.message);
    process.exit(1);
  }
}

// Add services from docker-compose to the configuration
function addDockerComposeServices(config: Config, composePath: string): void {
  const composeContent = fs.readFileSync(composePath, "utf8");
  const composeDoc: any = yaml.load(composeContent);

  if (
    composeDoc &&
    typeof composeDoc === "object" &&
    "services" in composeDoc
  ) {
    const services = Object.keys(composeDoc.services);

    // For each service that is not already defined in services, add a new ProcessConfig
    services.forEach((serviceName) => {
      if (config.services.find((p) => p.name === serviceName)) return;

      config.services.push({
        name: serviceName,
        // Use docker compose to stream logs for the service
        cmd: "docker",
        args: ["compose", "-f", composePath, "logs", "-f", serviceName],
      });
    });
  } else {
    console.error(
      "docker-compose file does not contain a valid 'services' section.",
    );
    process.exit(1);
  }
}

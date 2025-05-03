import { z } from "zod";

// Zod schemas for configuration validation
export const ReadyCheckSchema = z.object({
  type: z.enum(["command", "url"]),
  command: z.string().optional(),
  url: z.string().optional(),
  interval: z.number().optional(),
  timeout: z.number().optional(),
});

export const ProcessConfigSchema = z.object({
  name: z.string(),
  cmd: z.string(),
  args: z.array(z.string()).optional(),
  dependsOn: z.array(z.string()).optional(),
  ready: ReadyCheckSchema.optional(),
  color: z.string().optional(),
});

export const CompleteProcessConfigSchema = z.object({
  name: z.string(),
  cmd: z.string(),
  args: z.array(z.string()).optional(),
  dependsOn: z.array(z.string()).optional(),
  ready: ReadyCheckSchema.optional(),
  color: z.string(),
  mute: z.boolean(),
  solo: z.boolean(),
});

export const DockerComposeSchema = z.object({
  file: z.string(), // relative or absolute path to docker-compose.yml
  profile: z.string().optional(),
});

export const ConfigSchema = z.object({
  services: z.array(ProcessConfigSchema),
  dockerCompose: DockerComposeSchema.optional(),
});

// Export type definitions derived from the schemas
export type ReadyCheck = z.infer<typeof ReadyCheckSchema>;
export type ProcessConfig = z.infer<typeof ProcessConfigSchema>;
export type DockerComposeConfig = z.infer<typeof DockerComposeSchema>;
export type Config = z.infer<typeof ConfigSchema>;

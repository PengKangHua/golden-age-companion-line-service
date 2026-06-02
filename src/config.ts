import "dotenv/config";
import { z } from "zod";

const ConfigSchema = z.object({
  port: z.coerce.number().int().positive().default(3000),
  databasePath: z.string().min(1).default(".data/companion.sqlite"),
  lineChannelAccessToken: z.string().optional(),
  lineChannelSecret: z.string().optional()
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): AppConfig {
  return ConfigSchema.parse({
    port: process.env.PORT,
    databasePath: process.env.DATABASE_PATH,
    lineChannelAccessToken: emptyToUndefined(process.env.LINE_CHANNEL_ACCESS_TOKEN),
    lineChannelSecret: emptyToUndefined(process.env.LINE_CHANNEL_SECRET)
  });
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

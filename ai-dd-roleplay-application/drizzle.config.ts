import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Загружаем переменные из .env.local
dotenv.config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Берем адрес базы прямо из вашего .env.local!
    url: process.env.DATABASE_URL as string, 
  },
});
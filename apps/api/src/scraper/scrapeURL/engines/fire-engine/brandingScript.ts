import { readFileSync } from "fs";
import { join } from "path";

export const fireEngineBrandingScript = readFileSync(
  join(__dirname, "brandingScript.js"),
  "utf-8"
);

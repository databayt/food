/**
 * Verify i18n translation-key parity across every locale dictionary, and that
 * every user-facing Prisma enum value has a label in every locale.
 *
 *   tsx scripts/dev-i18n-sync.ts          # report drift, exit 1 if any (build gate)
 *   tsx scripts/dev-i18n-sync.ts --fix    # inject [XX] placeholders for missing keys
 *
 * Ported from mkan (two-locale en/ar) and generalized to loop `i18n.locales`,
 * so adding a locale to config.ts automatically extends the gate. en.json is
 * the reference dictionary. The schema is multi-file (prisma/models/*.prisma).
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

import { i18n } from "../src/components/internationalization/config";

const I18N_DIR = join(
  process.cwd(),
  "src",
  "components",
  "internationalization",
);
const PRISMA_DIR = join(process.cwd(), "prisma");
const REFERENCE = i18n.defaultLocale;

const FIX = process.argv.slice(2).includes("--fix");

type Json = Record<string, unknown>;

/**
 * Prisma enums rendered as user-facing labels, each paired with the dictionary
 * map that must carry a label for EVERY value in EVERY locale.
 */
const ENUM_LABEL_MAPS: Array<{ enum: string; path: string }> = [
  { enum: "OrderStatus", path: "enums.orderStatus" },
  { enum: "PaymentStatus", path: "enums.paymentStatus" },
  { enum: "PaymentMethod", path: "enums.paymentMethod" },
  { enum: "FulfillmentType", path: "enums.fulfillment" },
  { enum: "UserRole", path: "enums.userRole" },
];

function readSchema(): string {
  const files: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "migrations") walk(full);
      else if (entry.name.endsWith(".prisma")) files.push(full);
    }
  };
  walk(PRISMA_DIR);
  return files.map((f) => readFileSync(f, "utf-8")).join("\n");
}

function parseEnumValues(schema: string, name: string): string[] {
  const block = schema.match(new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`));
  if (!block?.[1]) return [];
  return block[1]
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter((l) => l.length > 0 && /^[A-Za-z]/.test(l));
}

function getAllKeys(obj: unknown, prefix = ""): string[] {
  const keys: string[] = [];
  if (typeof obj !== "object" || obj === null || Array.isArray(obj))
    return keys;
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getNestedValue(obj: Json, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object"
          ? (current as Json)[key]
          : undefined,
      obj,
    );
}

function setNestedValue(obj: Json, path: string, value: unknown): void {
  const keys = path.split(".");
  const lastKey = keys.pop()!;
  const target = keys.reduce<Json>((current, key) => {
    if (typeof current[key] !== "object" || current[key] === null)
      current[key] = {};
    return current[key] as Json;
  }, obj);
  target[lastKey] = value;
}

function main() {
  const dicts = Object.fromEntries(
    i18n.locales.map((locale) => [
      locale,
      JSON.parse(
        readFileSync(join(I18N_DIR, `${locale}.json`), "utf-8"),
      ) as Json,
    ]),
  ) as Record<string, Json>;

  const ref = dicts[REFERENCE]!;
  const refKeys = new Set(getAllKeys(ref));
  let parityOk = true;

  console.log(
    `i18n parity check — reference ${REFERENCE}.json (${refKeys.size} keys)`,
  );
  for (const locale of i18n.locales) {
    if (locale === REFERENCE) continue;
    const dict = dicts[locale]!;
    const keys = new Set(getAllKeys(dict));
    const missing = [...refKeys].filter((k) => !keys.has(k)).sort();
    const extra = [...keys].filter((k) => !refKeys.has(k)).sort();
    if (missing.length === 0 && extra.length === 0) {
      console.log(`  ✓ ${locale}.json in sync (${keys.size} keys)`);
      continue;
    }
    parityOk = false;
    if (missing.length) {
      console.log(`  ✗ missing in ${locale}.json (${missing.length}):`);
      missing.forEach((k) => console.log(`      - ${k}`));
    }
    if (extra.length) {
      console.log(
        `  ✗ not in ${REFERENCE}.json but in ${locale}.json (${extra.length}):`,
      );
      extra.forEach((k) => console.log(`      - ${k}`));
    }
    if (FIX) {
      for (const key of missing) {
        setNestedValue(
          dict,
          key,
          `[${locale.toUpperCase()}] ${String(getNestedValue(ref, key))}`,
        );
      }
      writeFileSync(
        join(I18N_DIR, `${locale}.json`),
        JSON.stringify(dict, null, 2) + "\n",
      );
    }
  }
  if (FIX && !parityOk) {
    console.log(
      "\nPlaceholders injected. Replace the [XX] markers with real translations.",
    );
    parityOk = true;
  }

  console.log("\nenum-label coverage — prisma/**/*.prisma vs dictionaries");
  let enumOk = true;
  const schema = readSchema();
  for (const { enum: enumName, path } of ENUM_LABEL_MAPS) {
    const values = parseEnumValues(schema, enumName);
    if (values.length === 0) {
      console.log(`  ✗ enum ${enumName} not found in schema`);
      enumOk = false;
      continue;
    }
    const missing: string[] = [];
    for (const locale of i18n.locales) {
      const map = getNestedValue(dicts[locale]!, path);
      for (const v of values) {
        if (!(map && typeof map === "object" && (map as Json)[v] != null))
          missing.push(`${locale} ${path}.${v}`);
      }
    }
    if (missing.length) {
      enumOk = false;
      console.log(
        `  ✗ ${enumName} → ${path} — ${missing.length} missing label(s):`,
      );
      missing.forEach((m) => console.log(`      - ${m}`));
    } else {
      console.log(
        `  ✓ ${enumName} → ${path} (${values.length} values × ${i18n.locales.length} locales)`,
      );
    }
  }

  if (parityOk && enumOk) {
    console.log("\n✓ i18n guard passed.");
    process.exit(0);
  }
  if (!parityOk)
    console.log(
      "\nRun `pnpm i18n:sync` to add placeholder keys, then translate them.",
    );
  if (!enumOk)
    console.log("Add the missing enum labels to every locale dictionary.");
  process.exit(1);
}

main();

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const element = () => ({
  value: "", checked: false, disabled: false, textContent: "", innerHTML: "", dataset: {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  addEventListener() {}, querySelector: () => element()
});
const context = vm.createContext({
  console,
  document: {
    querySelector: () => element(), querySelectorAll: () => [], addEventListener() {},
    createElement: () => element(), body: { appendChild() {} }
  },
  window: { scrollTo() {} },
  localStorage: { getItem: () => null, setItem() {} },
  navigator: { clipboard: { writeText: async () => {} } },
  URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  Blob, TextEncoder, setTimeout: () => 0, clearTimeout() {}
});

vm.runInContext(appSource, context, { filename: "app.js" });

const testRows = [
  { DATABASE_NAME: "ANALYTICS", SCHEMA_NAME: "LANDING", TABLE_NAME: "CUSTOMERS", COLUMN_NAME: "CUSTOMER_ID", DATA_TYPE: "NUMBER", IS_NULLABLE: "NO", ORDINAL_POSITION: 1, NUMERIC_PRECISION: 38, NUMERIC_SCALE: 0 },
  { DATABASE_NAME: "ANALYTICS", SCHEMA_NAME: "LANDING", TABLE_NAME: "CUSTOMERS", COLUMN_NAME: "EMAIL", DATA_TYPE: "VARCHAR", IS_NULLABLE: "YES", ORDINAL_POSITION: 2, CHARACTER_MAXIMUM_LENGTH: 320 },
  { TABLE_CATALOG: "ANALYTICS", TABLE_SCHEMA: "LANDING", TABLE_NAME: "ORDERS", COLUMN_NAME: "ORDER_ID", DATA_TYPE: "NUMBER", IS_NULLABLE: false, ORDINAL_POSITION: 1 }
];
context.testRows = testRows;

const normalized = JSON.parse(vm.runInContext("JSON.stringify(normalizeFlatCatalogueRows(testRows, { source: 'catalogue.xlsx' }))", context));
assert.equal(normalized.source, "catalogue.xlsx");
assert.equal(normalized.tables.length, 2);
assert.equal(normalized.tables[0].name, "ANALYTICS.LANDING.CUSTOMERS");
assert.equal(normalized.tables[0].columns[0].name, "CUSTOMER_ID");
assert.equal(normalized.tables[0].columns[0].nullable, "NO");
assert.equal(normalized.tables[0].columns[1].length, 320);

context.normalizedInput = {
  source: "catalog.json",
  database: "OPS",
  schema: "STAGE",
  tables: [{ name: "EVENTS", columns: [{ name: "EVENT_ID", type: "TEXT", nullable: "NO", ordinal: 1 }] }]
};
const fromJson = JSON.parse(vm.runInContext("JSON.stringify(normalizeCatalogueJson(normalizedInput))", context));
assert.equal(fromJson.tables[0].name, "OPS.STAGE.EVENTS");

context.duplicateRows = [testRows[0], { ...testRows[0] }];
assert.throws(
  () => vm.runInContext("normalizeFlatCatalogueRows(duplicateRows)", context),
  /Duplicate column/
);

context.missingTypeRows = [{ TABLE_NAME: "CUSTOMERS", COLUMN_NAME: "ID" }];
assert.throws(
  () => vm.runInContext("normalizeFlatCatalogueRows(missingTypeRows)", context),
  /missing DATA_TYPE/
);

console.log("PASS: catalogue import normalization and validation");

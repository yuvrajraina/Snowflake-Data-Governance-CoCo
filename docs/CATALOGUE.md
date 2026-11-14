# Catalogue maintenance

## Import-first catalogue

The application does not load a fixed catalogue. A reviewer imports an XLSX, XLS, XLSB, CSV, or normalized JSON file at the start of each browser session. The file is parsed locally and becomes the source for table selection, governance review, and SQL generation.

`data/catalog.json` remains as a legacy/sample normalized catalogue generated from `Book 6.xlsx` on **12 November 2026**. It is not loaded automatically.

| Scope | Count |
|---|---:|
| Database/schema | `DEV.RAW` |
| Tables | 258 |
| Columns | 5,689 |

The repository does not contain `Book 6.xlsx`. Users can import their current export without changing application source files.

## What the catalogue proves

For each table and column, the snapshot records:

- fully qualified table name;
- column name;
- base Snowflake data type;
- nullability;
- ordinal position;
- character length, numeric precision and scale when available.

It does not prove current object existence, comments, keys, tags, masking policies, ownership, row counts, data contents, downstream use or business meaning.

## Live-schema review is mandatory

Loaders can add technical fields after the catalogue is exported. For example, the catalogue listed 13 fields for `DEV.RAW.DUTCHIE_LOYALTY_REGISTRATION`, while the inspected live table also contained `INSERTED_AT`.

Run this query for the selected table:

```sql
SELECT
    ORDINAL_POSITION,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH,
    NUMERIC_PRECISION,
    NUMERIC_SCALE
FROM DEV.INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'RAW'
  AND TABLE_NAME = '<TABLE_NAME>'
ORDER BY ORDINAL_POSITION;
```

Then use the application to:

- add live columns absent from the snapshot;
- exclude snapshot columns absent from the live object;
- confirm the comparison.

## JSON format

The asset has this structure:

```json
{
  "source": "Book 6.xlsx",
  "generatedDate": "2026-11-12",
  "database": "DEV",
  "schema": "RAW",
  "tables": [
    {
      "name": "DEV.RAW.EXAMPLE_TABLE",
      "columns": [
        {
          "name": "ID",
          "type": "NUMBER",
          "nullable": "YES",
          "ordinal": 1,
          "length": null,
          "precision": "38",
          "scale": "0"
        }
      ]
    }
  ]
}
```

## Spreadsheet format

The importer finds the header row on each sheet and accepts these standard fields:

| Required | Accepted headers |
|---|---|
| Table | `TABLE_NAME`, `TABLE`, `OBJECT_NAME` |
| Column | `COLUMN_NAME`, `COLUMN`, `FIELD_NAME`, `FIELD` |
| Type | `DATA_TYPE`, `COLUMN_TYPE`, `TYPE`, `SNOWFLAKE_TYPE` |

Optional fields include `DATABASE_NAME`/`TABLE_CATALOG`, `SCHEMA_NAME`/`TABLE_SCHEMA`, `IS_NULLABLE`, `ORDINAL_POSITION`, `CHARACTER_MAXIMUM_LENGTH`, `NUMERIC_PRECISION`, and `NUMERIC_SCALE`. Database and schema default to `DEV.RAW` when omitted. A workbook with one table per non-generic sheet may omit `TABLE_NAME`; the sheet name is used as the table name.

Imports are limited to 25 MB and 200,000 column rows. Duplicate columns, missing required fields, and invalid unquoted Snowflake identifiers are rejected with an error.

## Optional sample refresh procedure

1. Export a new column-level catalogue from Snowflake.
2. Normalize names to uppercase and retain the JSON structure above.
3. Sort tables by fully qualified name and columns by ordinal position.
4. Update `source` and `generatedDate`.
5. Confirm that table names are unique and column ordinals are ordered.
6. Compare added, removed and renamed tables with the previous snapshot.
7. Re-run the checks in [Testing](TESTING.md).
8. Update counts and snapshot date in `README.md` and this file.

Do not silently delete a table because it disappeared from one export. Confirm whether the object was intentionally retired, renamed, inaccessible to the export role or temporarily absent.

## Suggested verification script

After replacing the asset:

```powershell
@'
from pathlib import Path
import json

data = json.loads(Path('data/catalog.json').read_text(encoding='utf-8'))
tables = data['tables']
assert len({table['name'] for table in tables}) == len(tables)
assert all(table['name'].startswith('DEV.RAW.') for table in tables)
assert all(
    [column['ordinal'] for column in table['columns']] ==
    sorted(column['ordinal'] for column in table['columns'])
    for table in tables
)
print(len(tables), sum(len(table['columns']) for table in tables))
'@ | python -
```

## Sensitive information boundary

The catalogue must contain schema metadata only. Never include sample values, query results containing PII, credentials, secrets or user-specific access history in `catalog.json`.

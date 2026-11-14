# Governance Script Studio

Governance Script Studio is a static web application that imports a column-level data catalogue and converts a human-reviewed governance configuration into eight Snowflake SQL files.

The user supplies the catalogue as XLSX, XLS, XLSB, CSV, or normalized JSON. Parsing and governance work happen in the browser; the application does not upload catalogue data, connect to Snowflake, call an AI service, or execute SQL. An optional handoff generates a self-contained task that Snowflake CoCo executes autonomously before returning structured recommendations for human review.

## Core principles

- **Human decisions remain human.** The application can identify names such as `EMAIL`, `PHONE`, `ZIP` or `COMMENT`, but these are review prompts and are never approved automatically.
- **The catalogue is a starting point.** A reviewer must compare the selected table with the current Snowflake schema and record additions or exclusions.
- **Generation is review-gated.** Scripts cannot be generated until live-schema review, masking review and governance approval are confirmed.
- **Output is deterministic.** The same catalogue and exported configuration produce the same SQL content.
- **No privileged runtime connection.** The browser only downloads files; authorized users execute reviewed SQL separately in Snowflake.

## What the application supports

- Browser-local import, validation, search, and selection across the user-supplied catalogue.
- Optional Snowflake CoCo review-kit generation and guarded recommendation import.
- Live-schema additions and catalogue-column exclusions.
- Snowflake semantic and privacy classification assignments.
- Tag-based masking tiers: `FULL`, `PARTIAL_EMAIL`, `PARTIAL_PHONE`, `PARTIAL_ZIP` and `CONDITIONAL`.
- `CDE` and `PII_DERIVED` column tags plus table-level source/layer/retention tags.
- Row count, duplicate count, null count and timestamp freshness DMFs.
- Table comments, column comments and business-term evidence.
- Explicit row-access and de-identification decisions.
- Local draft persistence and reviewed configuration import/export.
- Individual SQL downloads and a dependency-free ZIP containing all eight scripts.

## Quick start

Run a local static server from the repository root:

```powershell
python -m http.server 8080
```

Open `http://localhost:8080`, import a catalogue, select a table and follow the seven application steps. After table selection, optionally download the autonomous CoCo task, give it to CoCo Agent mode and import its completed JSON before beginning human review. Spreadsheet import uses the pinned SheetJS browser build from its official CDN, so the browser needs network access when importing Excel files; normalized JSON remains available as a fallback.

The root URL opens the public product landing page. Choose **Open studio** or navigate directly to `/#studio` to enter the governance workspace.

## Search and sharing metadata

The landing page includes semantic product content, WebSite, SoftwareApplication and FAQ structured data, Open Graph and Twitter metadata, a 1200×630 social card, install icons and a web application manifest. The Netlify build injects the production origin into canonical and sharing URLs, emits an absolute sitemap and keeps deploy previews out of search indexes.

## Generated files

For a table such as `DEV.RAW.DUTCHIE_LOYALTY_REGISTRATION`, the application generates:

```text
1_DEV.RAW.DUTCHIE_LOYALTY_REGISTRATION_pre_checks_and_grants-v1.1.sql
2_DEV.RAW.DUTCHIE_LOYALTY_REGISTRATION_classify-v1.1.sql
3_DEV.RAW.DUTCHIE_LOYALTY_REGISTRATION_mask-v1.1.sql
4_DEV.RAW.DUTCHIE_LOYALTY_REGISTRATION_assign_tags-v1.1.sql
5_DEV.RAW.DUTCHIE_LOYALTY_REGISTRATION_quality_checks-v1.1.sql
6_DEV.RAW.DUTCHIE_LOYALTY_REGISTRATION_assign_business_terms-v1.1.sql
7_DEV.RAW.DUTCHIE_LOYALTY_REGISTRATION_row_access-v1.1.sql
8_DEV.RAW.DUTCHIE_LOYALTY_REGISTRATION_deidentification_check-v1.1.sql
```

See [Generated SQL reference](docs/GENERATED_SQL.md) for the responsibility and execution order of each file.

## Documentation

- [User guide](docs/USER_GUIDE.md) — complete browser workflow and reviewer checklist.
- [Snowflake CoCo review workflow](docs/COCO_REVIEW_WORKFLOW.md) — review-kit queries, JSON handoff and approval boundary.
- [Configuration reference](docs/CONFIGURATION_REFERENCE.md) — exported JSON fields and examples.
- [Catalogue maintenance](docs/CATALOGUE.md) — snapshot limitations, live-schema comparison and catalogue format.
- [Generated SQL reference](docs/GENERATED_SQL.md) — the eight scripts, roles, prerequisites and rollback boundaries.
- [Architecture and security](docs/ARCHITECTURE_AND_SECURITY.md) — data flow, trust boundaries and privileged-input risks.
- [Deployment](docs/DEPLOYMENT.md) — local preview and Git-connected Netlify deployment.
- [Testing](docs/TESTING.md) — completed verification and repeatable release checks.
- [Contributing](CONTRIBUTING.md) — repository workflow and change requirements.

## Repository layout

```text
.
├── index.html                 # Application structure
├── styles.css                 # Responsive visual system
├── app.js                     # State, validation, SQL generation and ZIP creation
├── 404.html                   # Branded not-found page
├── assets/                    # Social preview and install icons
├── scripts/build.mjs          # Production-aware Netlify/SEO build
├── data/
│   └── catalog.json           # Legacy/sample normalized catalogue
├── tests/
│   └── coco-review.test.mjs   # Review-kit and guarded-import regression test
├── docs/                      # Operational and technical documentation
├── favicon.svg
├── robots.txt                 # Search crawler policy
├── site.webmanifest           # Install and application metadata
├── package.json               # Build and verification commands
├── netlify.toml               # Netlify build and deploy-context configuration
├── CONTRIBUTING.md
└── README.md
```

## Important limitations

1. Every imported catalogue is a snapshot. Loader-managed fields such as `INSERTED_AT` may be absent and must be added during live-schema review.
2. Column names and types cannot prove business meaning, PII presence, uniqueness, acceptable null levels, retention, row-access requirements or de-identification policy.
3. The application validates configuration structure and generated-file completeness; it does not compile SQL against Snowflake.
4. Existing shared tags, masking policies, roles, warehouses and DMFs must exist and be authorized in the target Snowflake account.
5. Some generated commands are privileged. Every file requires code review and execution by authorized roles.
6. CoCo output is preliminary evidence and recommendations only. It can be incomplete or incorrect and never satisfies the application's review confirmations or final approval.

## Netlify

Netlify runs the regression suite, builds production-aware SEO assets into `dist`, verifies the deploy output and publishes `dist`. Production receives indexable canonical metadata and a sitemap; deploy previews receive layered `noindex` directives. See [Deployment](docs/DEPLOYMENT.md) for the GitHub-to-Netlify process.

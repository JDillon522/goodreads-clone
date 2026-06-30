# API Contract Types

Run from the repo root:

```bash
npm run api:types
```

`bookshelf-api.types.ts` is generated from the backend OpenAPI document at `http://localhost:3000/docs-json`.

Do not edit generated files directly. Add ergonomic frontend aliases in `api.types.ts`.

Generation is intentionally type/interface-only. Do not generate runtime DTO classes, Angular services, or client architecture from OpenAPI without an explicit decision.

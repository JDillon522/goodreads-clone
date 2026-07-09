# Bookshelf DB MCP

Read-only MCP server for inspecting the local Bookshelf Postgres database running through Docker Compose.

## Connection

The Compose override exposes Postgres on the host at:

```txt
127.0.0.1:5433
```

Default development URL:

```txt
postgresql://bookshelf:bookshelf@127.0.0.1:5433/bookshelf
```

For MCP usage, prefer a read-only role:

```sql
CREATE USER bookshelf_readonly WITH PASSWORD 'readonly-password';
GRANT CONNECT ON DATABASE bookshelf TO bookshelf_readonly;
GRANT USAGE ON SCHEMA public TO bookshelf_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bookshelf_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO bookshelf_readonly;
```

The same setup is committed as `sql/create-readonly-role.sql` for local development.

Then use:

```txt
postgresql://bookshelf_readonly:readonly-password@127.0.0.1:5433/bookshelf
```

## Run

From the repo root:

```sh
bin/run mcp-db
```

The server uses stdio, so it is meant to be launched by an MCP client. It should not print application logs to stdout.

## MCP Client Example

Use an absolute repo path in your client config. A committable example lives at `mcp-config.example.json`:

```json
{
  "mcpServers": {
    "bookshelf-db": {
      "command": "node",
      "args": ["/absolute/path/to/personal-reading-list/bin/run", "mcp-db"],
      "env": {
        "BOOKSHELF_MCP_DATABASE_URL": "postgresql://bookshelf_readonly:readonly-password@127.0.0.1:5433/bookshelf",
        "BOOKSHELF_MCP_SCHEMA": "public",
        "BOOKSHELF_MCP_MAX_ROWS": "200",
        "BOOKSHELF_MCP_STATEMENT_TIMEOUT_MS": "5000"
      }
    }
  }
}
```

Keep credentials in your local MCP client config or local environment. Do not commit real secrets.

## Tools

- `database_overview`: shows database, user, schema, and table/view counts.
- `list_tables`: lists tables and optionally views for one schema.
- `describe_table`: lists columns, constraints, indexes, and foreign keys for one table.
- `query_readonly`: runs a single read-only `SELECT`, `WITH`, or `VALUES` query and caps returned rows.

## Safety Model

This server is intentionally defensive:

- It opens transactions as `READ ONLY`.
- It sets a statement timeout and lock timeout.
- `query_readonly` rejects multiple statements and mutation/DDL/control keywords.
- `query_readonly` only accepts `SELECT`, `WITH`, or `VALUES`.
- Results are wrapped with an outer `LIMIT`.

The safest setup is still a Postgres read-only role. The SQL gate is a seatbelt, not a replacement for database permissions.

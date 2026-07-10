# Bookshelf DB MCP

Read-only MCP server for inspecting the local Bookshelf Postgres database running through Docker Compose.

## Config

Add to your codex config:

```txt
[mcp_servers.bookshelf-db]
command = "node"
args = ["<absolute path to the project>/bin/run", "mcp-db"]
startup_timeout_sec = 30
```

The MCP client does not need credentials in its config. `bin/run mcp-db` loads the repo root `.env`, and the MCP server builds its connection from the `Database` and `Read-only database MCP server` sections.

## Connection

The Compose override exposes Postgres on the host at:

```txt
127.0.0.1:5433
```

Default development URL shape:

```txt
postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_HOST_PORT}/${POSTGRES_DB}
```

For MCP usage, prefer a read-only role. Configure the role name and password in root `.env`, then run:

```sh
bin/run mcp-db-role
```

That command applies grants using `POSTGRES_DB`, `POSTGRES_SCHEMA`, `POSTGRES_USER`, `BOOKSHELF_MCP_POSTGRES_USER`, and `BOOKSHELF_MCP_POSTGRES_PASSWORD` from root `.env`. A variable-based SQL reference is committed at `sql/create-readonly-role.sql`.

The MCP server connection URL shape is:

```txt
postgresql://${BOOKSHELF_MCP_POSTGRES_USER}:${BOOKSHELF_MCP_POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_HOST_PORT}/${POSTGRES_DB}
```

## Run

From the repo root:

```sh
bin/run mcp-db
```

The server uses stdio, so it is meant to be launched by an MCP client. It should not print application logs to stdout.
Startup feedback is written to stderr, including the credential-free database target and a reminder that the process stays open while the MCP client is connected.
Each MCP tool call also writes access, completion, and failure messages to stderr with the tool name and duration.

## MCP Client Example

Use an absolute repo path in your client config. A committable example lives at `mcp-config.example.json`:

```json
{
  "mcpServers": {
    "bookshelf-db": {
      "command": "node",
      "args": ["/absolute/path/to/personal-reading-list/bin/run", "mcp-db"]
    }
  }
}
```

Keep credentials in root `.env`. Do not commit real secrets.

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

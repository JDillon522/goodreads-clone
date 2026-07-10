#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { z } from "zod";
import {
  assertReadonlySql,
  normalizeQueryLimit,
  SqlSafetyError,
} from "./sql-safety.mjs";

/**
 * Overview: Starts the read-only Bookshelf Postgres MCP server and exposes safe inspection tools over stdio.
 */
const { Pool, escapeIdentifier } = pg;

const DEFAULT_SCHEMA = "public";
const DEFAULT_MAX_ROWS = 200;
const DEFAULT_STATEMENT_TIMEOUT_MS = 5000;

loadRootEnv();

const databaseUrl =
  process.env.BOOKSHELF_MCP_DATABASE_URL ??
  process.env.DATABASE_URL ??
  databaseUrlFromParts();
const defaultSchema = readIdentifierEnv("BOOKSHELF_MCP_SCHEMA", DEFAULT_SCHEMA);
const maxRows = readPositiveIntEnv("BOOKSHELF_MCP_MAX_ROWS", DEFAULT_MAX_ROWS);
const statementTimeoutMs = readPositiveIntEnv(
  "BOOKSHELF_MCP_STATEMENT_TIMEOUT_MS",
  DEFAULT_STATEMENT_TIMEOUT_MS,
);

const pool = new Pool({
  application_name: "bookshelf-db-mcp",
  connectionString: databaseUrl,
  max: 2,
});

const server = new McpServer({
  name: "bookshelf-db-mcp",
  version: "0.1.0",
});

server.registerTool(
  "database_overview",
  {
    title: "Database overview",
    description:
      "Show the connected database, current user, active schema, and relation counts.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  withToolAccessLog("database_overview", async () => {
    const result = await withReadonlyClient(async (client) => {
      const database = await client.query(
        "select current_database() as database, current_user as user, version() as version",
      );
      const relations = await client.query(
        `
          select table_type, count(*)::int as count
          from information_schema.tables
          where table_schema = $1
          group by table_type
          order by table_type
        `,
        [defaultSchema],
      );

      return {
        connection: {
          database: database.rows[0]?.database,
          user: database.rows[0]?.user,
          schema: defaultSchema,
          maxRows,
          statementTimeoutMs,
        },
        version: database.rows[0]?.version,
        relationCounts: relations.rows,
      };
    });

    return jsonResult(result);
  }),
);

server.registerTool(
  "list_tables",
  {
    title: "List tables",
    description: "List tables, and optionally views, for a schema.",
    inputSchema: {
      schema: z
        .string()
        .min(1)
        .default(defaultSchema)
        .describe("Postgres schema name. Defaults to public."),
      includeViews: z
        .boolean()
        .default(true)
        .describe("Whether to include views in the result."),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  withToolAccessLog("list_tables", async ({ schema, includeViews }) => {
    assertIdentifier(schema, "schema");

    const result = await withReadonlyClient(async (client) => {
      const relationTypes = includeViews
        ? ["BASE TABLE", "VIEW"]
        : ["BASE TABLE"];
      const response = await client.query(
        `
          select table_schema, table_name, table_type
          from information_schema.tables
          where table_schema = $1
            and table_type = any($2::text[])
          order by table_type, table_name
        `,
        [schema, relationTypes],
      );

      return {
        schema,
        includeViews,
        count: response.rowCount,
        relations: response.rows,
      };
    });

    return jsonResult(result);
  }),
);

server.registerTool(
  "describe_table",
  {
    title: "Describe table",
    description:
      "Show columns, constraints, indexes, and foreign keys for a table.",
    inputSchema: {
      schema: z
        .string()
        .min(1)
        .default(defaultSchema)
        .describe("Postgres schema name. Defaults to public."),
      table: z.string().min(1).describe("Table name to inspect."),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  withToolAccessLog("describe_table", async ({ schema, table }) => {
    assertIdentifier(schema, "schema");
    assertIdentifier(table, "table");

    const result = await withReadonlyClient(async (client) => {
      const [columns, constraints, indexes, foreignKeys] = await Promise.all([
        client.query(
          `
            select column_name, ordinal_position, data_type, udt_name, is_nullable, column_default
            from information_schema.columns
            where table_schema = $1
              and table_name = $2
            order by ordinal_position
          `,
          [schema, table],
        ),
        client.query(
          `
            select tc.constraint_name, tc.constraint_type, kcu.column_name
            from information_schema.table_constraints tc
            left join information_schema.key_column_usage kcu
              on tc.constraint_catalog = kcu.constraint_catalog
             and tc.constraint_schema = kcu.constraint_schema
             and tc.constraint_name = kcu.constraint_name
            where tc.table_schema = $1
              and tc.table_name = $2
            order by tc.constraint_type, tc.constraint_name, kcu.ordinal_position
          `,
          [schema, table],
        ),
        client.query(
          `
            select indexname as index_name, indexdef as definition
            from pg_indexes
            where schemaname = $1
              and tablename = $2
            order by indexname
          `,
          [schema, table],
        ),
        client.query(
          `
            select
              tc.constraint_name,
              kcu.column_name,
              ccu.table_schema as foreign_table_schema,
              ccu.table_name as foreign_table_name,
              ccu.column_name as foreign_column_name
            from information_schema.table_constraints tc
            join information_schema.key_column_usage kcu
              on tc.constraint_catalog = kcu.constraint_catalog
             and tc.constraint_schema = kcu.constraint_schema
             and tc.constraint_name = kcu.constraint_name
            join information_schema.constraint_column_usage ccu
              on ccu.constraint_catalog = tc.constraint_catalog
             and ccu.constraint_schema = tc.constraint_schema
             and ccu.constraint_name = tc.constraint_name
            where tc.constraint_type = 'FOREIGN KEY'
              and tc.table_schema = $1
              and tc.table_name = $2
            order by tc.constraint_name, kcu.ordinal_position
          `,
          [schema, table],
        ),
      ]);

      return {
        schema,
        table,
        columns: columns.rows,
        constraints: constraints.rows,
        indexes: indexes.rows,
        foreignKeys: foreignKeys.rows,
      };
    });

    return jsonResult(result);
  }),
);

server.registerTool(
  "query_readonly",
  {
    title: "Query read-only",
    description:
      "Run a single read-only SELECT/WITH/VALUES query with an enforced result limit.",
    inputSchema: {
      sql: z
        .string()
        .min(1)
        .max(20_000)
        .describe(
          "A single SELECT, WITH, or VALUES query. Do not include a trailing semicolon.",
        ),
      params: z
        .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .max(50)
        .default([])
        .describe("Optional positional parameters for $1, $2, etc."),
      limit: z
        .number()
        .int()
        .positive()
        .max(1000)
        .optional()
        .describe("Maximum rows to return. Capped by BOOKSHELF_MCP_MAX_ROWS."),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  withToolAccessLog("query_readonly", async ({ sql, params, limit }) => {
    const readonlySql = assertReadonlySql(sql);
    const rowLimit = normalizeQueryLimit(limit, maxRows);
    const limitParamIndex = params.length + 1;

    const result = await withReadonlyClient(async (client) => {
      const response = await client.query(
        `select * from (${readonlySql}) as bookshelf_mcp_result limit $${limitParamIndex}`,
        [...params, rowLimit],
      );

      return {
        rowCount: response.rowCount,
        returnedRows: response.rows.length,
        limit: rowLimit,
        columns: response.fields.map((field) => field.name),
        rows: response.rows,
      };
    });

    return jsonResult(result);
  }),
);

/**
 * Adds one stderr access log around each MCP tool call without touching stdout protocol traffic.
 */
function withToolAccessLog(featureName, handler) {
  return async (args, extra) => {
    const startedAt = Date.now();
    logStartupStatus(`Feature accessed: ${featureName}.`);

    try {
      const result = await handler(args, extra);
      logStartupStatus(
        `Feature completed: ${featureName} (${Date.now() - startedAt}ms).`,
      );
      return result;
    } catch (error) {
      logStartupStatus(
        `Feature failed: ${featureName} (${Date.now() - startedAt}ms): ${describeError(error)}.`,
      );
      throw error;
    }
  };
}

async function withReadonlyClient(callback) {
  const client = await pool.connect();

  try {
    // Every tool call runs in a read-only transaction with local timeouts so slow
    // or blocked inspection queries cannot hold the development database hostage.
    await client.query("begin read only");
    await client.query(`set local statement_timeout = ${statementTimeoutMs}`);
    await client.query(`set local lock_timeout = ${statementTimeoutMs}`);
    await client.query(
      `set local search_path to ${escapeIdentifier(defaultSchema)}, pg_catalog`,
    );

    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await rollbackQuietly(client);

    if (error instanceof SqlSafetyError) {
      return {
        error: error.message,
      };
    }

    throw error;
  } finally {
    client.release();
  }
}

async function rollbackQuietly(client) {
  try {
    await client.query("rollback");
  } catch {
    // Ignore rollback failures so the original error can surface.
  }
}
/**
 * Wraps JSON data as an MCP text result so clients can render it consistently.
 */
function jsonResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
/**
 * Reads positive integer environment overrides for query limits and timeouts.
 */
function readPositiveIntEnv(name, fallback) {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}
/**
 * Reads schema-like environment values and rejects anything beyond simple identifiers.
 */
function readIdentifierEnv(name, fallback) {
  const value = process.env[name] || fallback;
  assertIdentifier(value, name);
  return value;
}
/**
 * Guards metadata tools from using unsafe schema or table identifier strings.
 */
function assertIdentifier(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) {
    throw new Error(`${label} must be a simple Postgres identifier.`);
  }
}

/**
 * Loads the repo root .env when this server is started directly instead of through bin/run.
 */
function loadRootEnv() {
  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(currentFile), "../../..");
  const envPath = path.join(repoRoot, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1);

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Builds the MCP database URL from root .env parts when a full URL is not provided.
 */
function databaseUrlFromParts() {
  const database = requiredEnv("POSTGRES_DB");
  const user =
    process.env.BOOKSHELF_MCP_POSTGRES_USER ?? requiredEnv("POSTGRES_USER");
  const password =
    process.env.BOOKSHELF_MCP_POSTGRES_PASSWORD ??
    requiredEnv("POSTGRES_PASSWORD");
  const host =
    process.env.BOOKSHELF_MCP_POSTGRES_HOST ??
    process.env.POSTGRES_HOST ??
    "127.0.0.1";
  const port =
    process.env.BOOKSHELF_MCP_POSTGRES_PORT ??
    process.env.POSTGRES_HOST_PORT ??
    "5433";

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

/**
 * Reads a required environment variable with an actionable startup error.
 */
function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be set in the root .env file.`);
  }

  return value;
}

async function main() {
  logStartupStatus("Starting read-only Postgres MCP server over stdio.");
  logStartupStatus(
    `Database target: ${describeDatabaseTarget(databaseUrl)}; schema: ${defaultSchema}; max rows: ${maxRows}; timeout: ${statementTimeoutMs}ms.`,
  );
  logStartupStatus(
    "Stdout is reserved for MCP protocol messages; leave this process running while the client is connected.",
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logStartupStatus("Ready and waiting for MCP client requests.");
}

/**
 * Writes human-facing lifecycle messages to stderr so stdout remains valid MCP protocol output.
 */
function logStartupStatus(message) {
  process.stderr.write(`[bookshelf-db-mcp] ${message}\n`);
}

/**
 * Formats thrown values for concise stderr diagnostics.
 */
function describeError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Builds a credential-free database target label for startup feedback.
 */
function describeDatabaseTarget(connectionString) {
  try {
    const url = new URL(connectionString);
    const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
    const host = url.hostname || "localhost";
    const port = url.port ? `:${url.port}` : "";

    return `${host}${port}/${database || "(database not specified)"}`;
  } catch {
    return "custom database URL";
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    logStartupStatus(`Received ${signal}; shutting down.`);
    await pool.end();
    process.exit(0);
  });
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});

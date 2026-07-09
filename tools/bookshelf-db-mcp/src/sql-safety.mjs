/**
 * Overview: Validates ad hoc MCP SQL before it reaches Postgres so the database tool remains read-only by design.
 */
const DEFAULT_MAX_SQL_LENGTH = 20_000;

const MUTATING_OR_CONTROL_KEYWORDS = [
  "ALTER",
  "ANALYZE",
  "CALL",
  "CLUSTER",
  "COPY",
  "CREATE",
  "DELETE",
  "DISCARD",
  "DO",
  "DROP",
  "EXECUTE",
  "GRANT",
  "INSERT",
  "LISTEN",
  "LOCK",
  "MERGE",
  "NOTIFY",
  "REFRESH",
  "REINDEX",
  "RESET",
  "REVOKE",
  "SECURITY",
  "SET",
  "TRUNCATE",
  "UPDATE",
  "VACUUM",
];

export class SqlSafetyError extends Error {
  /**
   * Tags SQL validation failures so MCP tooling can return user-facing errors without hiding infrastructure failures.
   */
  constructor(message) {
    super(message);
    this.name = "SqlSafetyError";
  }
}
/**
 * Accepts only single-statement SELECT/WITH/VALUES SQL and blocks mutation, DDL, control, and locking clauses.
 */
export function assertReadonlySql(sql, options = {}) {
  const maxLength = options.maxLength ?? DEFAULT_MAX_SQL_LENGTH;

  if (typeof sql !== "string") {
    throw new SqlSafetyError("SQL must be a string.");
  }

  const trimmedSql = sql.trim();

  if (trimmedSql.length === 0) {
    throw new SqlSafetyError("SQL cannot be empty.");
  }

  if (trimmedSql.length > maxLength) {
    throw new SqlSafetyError(
      `SQL is too long. Maximum length is ${maxLength} characters.`,
    );
  }

  if (trimmedSql.includes("\0")) {
    throw new SqlSafetyError("SQL cannot contain null bytes.");
  }

  const codeOnlySql = stripSqlStringsAndComments(trimmedSql);
  const normalizedSql = codeOnlySql.replace(/\s+/g, " ").trim().toUpperCase();

  // The keyword checks operate on code with strings/comments stripped so examples
  // like `select 'delete'` do not trip the mutation guard.
  if (codeOnlySql.includes(";")) {
    throw new SqlSafetyError(
      "Only one SQL statement is allowed. Omit semicolons.",
    );
  }

  if (
    /\bFOR\s+(UPDATE|SHARE|NO\s+KEY\s+UPDATE|KEY\s+SHARE)\b/u.test(
      normalizedSql,
    )
  ) {
    throw new SqlSafetyError("Locking SELECT clauses are not allowed.");
  }

  for (const keyword of MUTATING_OR_CONTROL_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, "u").test(normalizedSql)) {
      throw new SqlSafetyError(
        `Keyword ${keyword} is not allowed in read-only queries.`,
      );
    }
  }

  if (!/^(SELECT|WITH|VALUES)\b/.test(normalizedSql)) {
    throw new SqlSafetyError(
      "Only SELECT, WITH, and VALUES queries are allowed.",
    );
  }

  if (/\bINTO\b/u.test(normalizedSql)) {
    throw new SqlSafetyError("SELECT INTO is not allowed.");
  }

  return trimmedSql;
}
/**
 * Caps requested result limits against the server maximum while keeping a modest default.
 */
export function normalizeQueryLimit(limit, maxRows) {
  const defaultLimit = Math.min(100, maxRows);

  if (limit === undefined || limit === null) {
    return defaultLimit;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new SqlSafetyError("Limit must be a positive integer.");
  }

  return Math.min(limit, maxRows);
}
/**
 * Removes strings, quoted identifiers, dollar-quoted text, and comments before keyword scanning.
 */
export function stripSqlStringsAndComments(sql) {
  let output = "";
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];
    const nextChar = sql[index + 1];

    if (char === "'") {
      const endIndex = consumeSingleQuotedString(sql, index);
      output += " ".repeat(endIndex - index);
      index = endIndex;
      continue;
    }

    if (char === '"') {
      const endIndex = consumeDoubleQuotedIdentifier(sql, index);
      output += " ".repeat(endIndex - index);
      index = endIndex;
      continue;
    }

    if (char === "-" && nextChar === "-") {
      const endIndex = consumeLineComment(sql, index);
      output += " ".repeat(endIndex - index);
      index = endIndex;
      continue;
    }

    if (char === "/" && nextChar === "*") {
      const endIndex = consumeBlockComment(sql, index);
      output += " ".repeat(endIndex - index);
      index = endIndex;
      continue;
    }

    const dollarTag = readDollarQuoteTag(sql, index);
    if (dollarTag) {
      const endIndex = consumeDollarQuotedString(sql, index, dollarTag);
      output += " ".repeat(endIndex - index);
      index = endIndex;
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}
/**
 * Consumes a Postgres single-quoted string, including escaped single quotes.
 */
function consumeSingleQuotedString(sql, startIndex) {
  let index = startIndex + 1;

  while (index < sql.length) {
    if (sql[index] === "'" && sql[index + 1] === "'") {
      index += 2;
      continue;
    }

    if (sql[index] === "'") {
      return index + 1;
    }

    index += 1;
  }

  throw new SqlSafetyError("Unterminated string literal.");
}
/**
 * Consumes a quoted identifier so table names like "User" do not affect keyword scans.
 */
function consumeDoubleQuotedIdentifier(sql, startIndex) {
  let index = startIndex + 1;

  while (index < sql.length) {
    if (sql[index] === '"' && sql[index + 1] === '"') {
      index += 2;
      continue;
    }

    if (sql[index] === '"') {
      return index + 1;
    }

    index += 1;
  }

  throw new SqlSafetyError("Unterminated quoted identifier.");
}
/**
 * Consumes a line comment through the next newline or end of input.
 */
function consumeLineComment(sql, startIndex) {
  const newlineIndex = sql.indexOf("\n", startIndex + 2);
  return newlineIndex === -1 ? sql.length : newlineIndex;
}
/**
 * Consumes a block comment and rejects unterminated comment bodies.
 */
function consumeBlockComment(sql, startIndex) {
  const endIndex = sql.indexOf("*/", startIndex + 2);

  if (endIndex === -1) {
    throw new SqlSafetyError("Unterminated block comment.");
  }

  return endIndex + 2;
}
/**
 * Detects a Postgres dollar-quote opener so function bodies can be skipped safely.
 */
function readDollarQuoteTag(sql, startIndex) {
  if (sql[startIndex] !== "$") {
    return null;
  }

  let index = startIndex + 1;

  while (index < sql.length && /[A-Za-z0-9_]/u.test(sql[index])) {
    index += 1;
  }

  if (sql[index] !== "$") {
    return null;
  }

  return sql.slice(startIndex, index + 1);
}
/**
 * Consumes a dollar-quoted string using the exact tag that opened it.
 */
function consumeDollarQuotedString(sql, startIndex, tag) {
  const endIndex = sql.indexOf(tag, startIndex + tag.length);

  if (endIndex === -1) {
    throw new SqlSafetyError("Unterminated dollar-quoted string.");
  }

  return endIndex + tag.length;
}

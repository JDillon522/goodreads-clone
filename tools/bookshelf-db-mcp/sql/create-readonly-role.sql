-- Local development reference for the Bookshelf DB MCP server.
-- `bin/run mcp-db-role` reads the actual values from the root .env and sends equivalent SQL
-- through stdin, so usernames and passwords stay out of committed SQL.
--
-- Manual psql usage:
--   \set app_database <database>
--   \set app_schema <schema>
--   \set readonly_user <readonly_user>
--   \set readonly_password <readonly_password>

select format('create role %I login password %L', :'readonly_user', :'readonly_password')
where not exists (select 1 from pg_roles where rolname = :'readonly_user')
\gexec

select format('alter role %I with login password %L', :'readonly_user', :'readonly_password')
\gexec

select format('grant connect on database %I to %I', :'app_database', :'readonly_user')
\gexec

select format('grant usage on schema %I to %I', :'app_schema', :'readonly_user')
\gexec

select format('grant select on all tables in schema %I to %I', :'app_schema', :'readonly_user')
\gexec

select format(
  'alter default privileges in schema %I grant select on tables to %I',
  :'app_schema',
  :'readonly_user'
)
\gexec

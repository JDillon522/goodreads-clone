-- Local development helper for the Bookshelf DB MCP server.
-- Change this password before using the role outside a disposable local DB.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bookshelf_readonly') then
    create role bookshelf_readonly login password 'readonly-password';
  else
    alter role bookshelf_readonly with login password 'readonly-password';
  end if;
end
$$;

grant connect on database bookshelf to bookshelf_readonly;
grant usage on schema public to bookshelf_readonly;
grant select on all tables in schema public to bookshelf_readonly;
alter default privileges in schema public grant select on tables to bookshelf_readonly;

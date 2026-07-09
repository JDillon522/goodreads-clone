import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertReadonlySql, normalizeQueryLimit, SqlSafetyError, stripSqlStringsAndComments } from './sql-safety.mjs';

describe('sql safety', () => {
  it('allows simple read-only queries', () => {
    assert.equal(assertReadonlySql('select * from "Book"'), 'select * from "Book"');
    assert.equal(assertReadonlySql('with books as (select * from "Book") select * from books'), 'with books as (select * from "Book") select * from books');
    assert.equal(assertReadonlySql('values (1), (2)'), 'values (1), (2)');
  });

  it('rejects multiple statements and semicolons', () => {
    assert.throws(() => assertReadonlySql('select 1;'), SqlSafetyError);
    assert.throws(() => assertReadonlySql('select 1; select 2'), SqlSafetyError);
  });

  it('rejects mutation and ddl keywords outside strings', () => {
    assert.throws(() => assertReadonlySql('delete from "Book"'), /DELETE/);
    assert.throws(() => assertReadonlySql('select * into temp_books from "Book"'), /INTO/);
    assert.throws(() => assertReadonlySql('select * from "Book" for update'), /Locking/);
  });

  it('ignores blocked words inside string literals and comments', () => {
    assert.equal(assertReadonlySql("select 'delete from Book' as sample"), "select 'delete from Book' as sample");
    assert.equal(assertReadonlySql('select 1 -- delete from Book'), 'select 1 -- delete from Book');
  });

  it('normalizes sql while stripping quoted content', () => {
    assert.equal(stripSqlStringsAndComments("select 'update', \"delete\", $$drop$$ -- alter").replace(/\s+/g, ' ').trim(), 'select , ,');
  });

  it('normalizes row limits', () => {
    assert.equal(normalizeQueryLimit(undefined, 200), 100);
    assert.equal(normalizeQueryLimit(25, 200), 25);
    assert.equal(normalizeQueryLimit(500, 200), 200);
    assert.throws(() => normalizeQueryLimit(0, 200), SqlSafetyError);
  });
});

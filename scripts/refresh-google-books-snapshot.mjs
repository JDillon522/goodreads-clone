import "dotenv/config";

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "data/sample-books.json");
const snapshotPath = resolve(root, "data/google-books-snapshot.json");
const baseUrl = (
  process.env.GOOGLE_BOOKS_BASE_URL ?? "https://www.googleapis.com/books/v1"
).replace(/\/+$/, "");
const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim() || null;
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (!Array.isArray(manifest)) {
  throw new Error("data/sample-books.json must contain an array.");
}

const existingSnapshot = await readExistingSnapshot();
const volumes = existingSnapshot?.volumes ?? [];
const generatedAt = new Date().toISOString();

for (const [index, book] of manifest.entries()) {
  const isbn = cleanIsbn(book.isbn13) ?? cleanIsbn(book.isbn10);

  if (volumes.some((entry) => entryMatchesBook(entry, book))) {
    process.stderr.write(
      `[${index + 1}/${manifest.length}] ${book.title} -> cached\n`,
    );
    continue;
  }

  let candidates = [];

  if (isbn) {
    try {
      candidates = await searchVolumes(`isbn:${isbn}`);
    } catch (error) {
      process.stderr.write(
        `ISBN lookup failed for ${book.title}: ${describeError(error)}\n`,
      );
    }
  }

  let volume = isbn
    ? (candidates.find((candidate) => volumeIsbnSet(candidate).has(isbn)) ??
      null)
    : null;

  if (!volume) {
    const titleQuery = `intitle:"${escapeQueryValue(book.title)}"${
      book.author ? ` inauthor:"${escapeQueryValue(book.author)}"` : ""
    }`;
    try {
      candidates = await searchVolumes(titleQuery);
    } catch (error) {
      process.stderr.write(
        `Structured title lookup failed for ${book.title}: ${describeError(error)}\n`,
      );
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
      candidates = await searchVolumes(
        `${book.title} ${book.author ?? ""}`.trim(),
      );
    }
    volume =
      (isbn
        ? candidates.find((candidate) => volumeIsbnSet(candidate).has(isbn))
        : null) ??
      candidates[0] ??
      null;
  }

  if (
    !volume ||
    typeof volume.id !== "string" ||
    typeof volume.volumeInfo !== "object"
  ) {
    throw new Error(`Google Books returned no usable volume for ISBN ${isbn}.`);
  }

  volumes.push({
    isbn10: cleanIsbn(book.isbn10) ?? volumeIdentifier(volume, "ISBN_10"),
    isbn13: cleanIsbn(book.isbn13) ?? volumeIdentifier(volume, "ISBN_13"),
    title: book.title,
    volume,
  });
  await persistSnapshot();
  process.stderr.write(
    `[${index + 1}/${manifest.length}] ${book.title} -> ${volume.id}\n`,
  );
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
}

const canonicalVolumes = manifest.map((book) => {
  const entry = volumes.find((candidate) => entryMatchesBook(candidate, book));

  if (!entry) {
    throw new Error(`Google Books snapshot is missing ${book.title}.`);
  }

  return {
    isbn10: cleanIsbn(book.isbn10) ?? cleanIsbn(entry.isbn10),
    isbn13: cleanIsbn(book.isbn13) ?? cleanIsbn(entry.isbn13),
    title: book.title,
    volume: entry.volume,
  };
});
volumes.splice(0, volumes.length, ...canonicalVolumes);
await persistSnapshot();

process.stderr.write(
  `Wrote ${volumes.length} Google Books volumes to ${snapshotPath}.\n`,
);

function cleanIsbn(value) {
  if (typeof value !== "string") {
    return null;
  }

  return value.replace(/[-\s]/g, "").toUpperCase() || null;
}

function volumeIsbnSet(volume) {
  const identifiers = Array.isArray(volume?.volumeInfo?.industryIdentifiers)
    ? volume.volumeInfo.industryIdentifiers
    : [];

  return new Set(
    identifiers
      .map((identifier) => cleanIsbn(identifier?.identifier))
      .filter((identifier) => identifier !== null),
  );
}

function volumeIdentifier(volume, type) {
  const identifiers = Array.isArray(volume?.volumeInfo?.industryIdentifiers)
    ? volume.volumeInfo.industryIdentifiers
    : [];
  const match = identifiers.find((identifier) => identifier?.type === type);
  return cleanIsbn(match?.identifier);
}

function entryMatchesBook(entry, book) {
  const isbn = cleanIsbn(book.isbn13) ?? cleanIsbn(book.isbn10);
  const entryIsbns = new Set([
    cleanIsbn(entry.isbn13),
    cleanIsbn(entry.isbn10),
    ...volumeIsbnSet(entry.volume),
  ]);

  return (isbn !== null && entryIsbns.has(isbn)) || entry.title === book.title;
}

function describeError(error) {
  return error instanceof Error ? error.message : "Unknown failure";
}

function escapeQueryValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function searchVolumes(query) {
  const url = new URL(`${baseUrl}/volumes`);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("orderBy", "relevance");
  url.searchParams.set("printType", "books");
  url.searchParams.set("projection", "full");

  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  const response = await fetchWithRetry(url);

  if (!response.ok) {
    throw new Error(`Google Books returned ${response.status}.`);
  }

  const payload = await response.json();
  return Array.isArray(payload.items) ? payload.items : [];
}

async function readExistingSnapshot() {
  try {
    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
    return snapshot.provider === "GOOGLE_BOOKS" &&
      Array.isArray(snapshot.volumes)
      ? snapshot
      : null;
  } catch {
    return null;
  }
}

async function persistSnapshot() {
  await writeFile(
    snapshotPath,
    `${JSON.stringify({ generatedAt, provider: "GOOGLE_BOOKS", volumes }, null, 2)}\n`,
    "utf8",
  );
}

async function fetchWithRetry(url) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    const retryable = response.status === 429 || response.status >= 500;

    if (!retryable || attempt === 6) {
      return response;
    }

    await new Promise((resolveDelay) =>
      setTimeout(resolveDelay, attempt * 1_000),
    );
  }

  throw new Error("Google Books retry loop ended unexpectedly.");
}

import { OpenLibraryNormalizerService } from '../src/books/open-library/open-library-normalizer.service';

describe('OpenLibraryNormalizerService', () => {
  let service: OpenLibraryNormalizerService;

  beforeEach(() => {
    service = new OpenLibraryNormalizerService();
  });

  it('normalizes search results, dedupes by work key, and keeps the strongest edition data', () => {
    const result = service.normalizeSearch(
      {
        docs: [
          {
            author_name: ['Ursula K. Le Guin'],
            edition_key: ['OL111M'],
            key: '/works/OL262758W',
            title: 'The Left Hand of Darkness',
          },
          {
            author_name: ['Ursula K. Le Guin'],
            cover_i: 9255566,
            edition_key: ['OL24631830M'],
            first_publish_year: 1969,
            isbn: ['0441478123', '9780441478125'],
            key: '/works/OL262758W',
            number_of_pages_median: 304,
            publisher: ['Ace Books'],
            subject: ['Science fiction', 'Fiction'],
            title: 'The Left Hand of Darkness',
          },
          {
            author_name: ['Octavia E. Butler'],
            key: '/works/OL123W',
            title: 'Kindred',
          },
        ],
        numFound: 3,
      },
      {
        filters: {
          filter: null,
          orderBy: 'relevance',
          printType: 'books',
        },
        limit: 10,
        page: 1,
        query: 'left hand',
      },
    );

    expect(result).toEqual({
      count: 2,
      facets: {
        availability: [{ count: 0, label: 'eBooks', value: 'ebooks' }],
        printTypes: [{ count: 2, label: 'Books', value: 'books' }],
        sortOptions: [{ count: 2, label: 'Relevance', value: 'relevance' }],
      },
      filters: {
        filter: null,
        orderBy: 'relevance',
        printType: 'books',
      },
      items: [
        expect.objectContaining({
          coverUrl: 'https://covers.openlibrary.org/b/id/9255566-L.jpg',
          dedupeKey: 'isbn13:9780441478125',
          isbn10: '0441478123',
          isbn13: '9780441478125',
          openLibraryEditionKey: '/books/OL24631830M',
          openLibraryWorkKey: '/works/OL262758W',
          pageCount: 304,
          primaryAuthor: 'Ursula K. Le Guin',
          provider: 'OPEN_LIBRARY',
          providerKey: 'works:OL262758W',
          publisher: 'Ace Books',
          sourceUrl: 'https://openlibrary.org/works/OL262758W',
          title: 'The Left Hand of Darkness',
        }),
        expect.objectContaining({
          coverUrl: null,
          dedupeKey: 'open-library:works:OL123W',
          primaryAuthor: 'Octavia E. Butler',
          title: 'Kindred',
        }),
      ],
      limit: 10,
      page: 1,
      query: 'left hand',
      total: 3,
    });
  });

  it('builds facets and infers readable online format from provider fields and title fallback', () => {
    const result = service.normalizeSearch(
      {
        docs: [
          {
            author_name: ['Nnedi Okorafor'],
            ebook_access: 'public',
            first_publish_year: 2010,
            has_fulltext: true,
            key: '/works/OL1W',
            subject: ['Fantasy'],
            title: 'Readable Book',
          },
          {
            author_name: ['Martha Wells'],
            first_publish_year: 2017,
            key: '/works/OL2W',
            subject: ['Fantasy'],
            title: 'Digital Novella eBook',
          },
        ],
        numFound: 2,
      },
      {
        filters: {
          filter: 'ebooks',
          orderBy: 'relevance',
          printType: 'books',
        },
        limit: 10,
        page: 1,
        query: 'fantasy',
      },
    );

    expect(result.filters).toEqual({
      filter: 'ebooks',
      orderBy: 'relevance',
      printType: 'books',
    });
    expect(result.facets).toEqual({
      availability: [{ count: 2, label: 'eBooks', value: 'ebooks' }],
      printTypes: [{ count: 2, label: 'Books', value: 'books' }],
      sortOptions: [{ count: 2, label: 'Relevance', value: 'relevance' }],
    });
    expect(result.items).toEqual([
      expect.objectContaining({ ebookAccess: 'public', isReadableOnline: true }),
      expect.objectContaining({ ebookAccess: null, isReadableOnline: true }),
    ]);
  });

  it('normalizes sparse edition detail without inventing fallback cover or author data', () => {
    const result = service.normalizeDetail(
      {
        covers: [-1],
        description: { value: '  A strange book.\nStill strange. ' },
        isbn_13: ['9780000000002'],
        key: '/books/OL999M',
        publish_date: '2020',
        publishers: ['Small Press'],
        subjects: ['Speculative fiction'],
        title: 'Sparse Book',
        works: [{ key: '/works/OL888W' }],
      },
      {
        id: 'OL999M',
        type: 'books',
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        authors: [],
        coverUrl: null,
        description: 'A strange book. Still strange.',
        isbn13: '9780000000002',
        openLibraryEditionKey: '/books/OL999M',
        openLibraryWorkKey: '/works/OL888W',
        primaryAuthor: null,
        providerKey: 'works:OL888W',
        publishedDate: '2020',
        publisher: 'Small Press',
        title: 'Sparse Book',
      }),
    );
  });
});

import type { APIRequestContext } from '@playwright/test';

interface GraphQLResponse {
  status: number;
  body: { data?: Record<string, unknown> | null; errors?: { message: string; extensions?: Record<string, unknown> }[] };
}

// A GraphQL error does not arrive as an HTTP status: a failed request is normally 200 with an
// `errors` array. Every helper here returns both so a test can assert on the pair — checking the
// status alone is the single most common way a GraphQL test passes while the API is broken.
export class GraphQLClient {
  constructor(private readonly request: APIRequestContext) {}

  async query(query: string, variables?: Record<string, unknown>, token?: string): Promise<GraphQLResponse> {
    const response = await this.request.post('/api/v1/graphql', {
      data: JSON.stringify({ query, variables }),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const text = await response.text();
    return { status: response.status(), body: text ? JSON.parse(text) : {} };
  }
}

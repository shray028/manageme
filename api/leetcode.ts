import { ImportError, resolveUrl } from '../lib/dsa/leetcode-import';

export const config = { maxDuration: 60 };
export const maxDuration = 60;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': status === 200 ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'no-store' },
  });

/** POST { url } → a normalised LeetCode list or problem. Read-only; never touches user data. */
export async function POST(request: Request) {
  let body: { url?: unknown };
  try {
    body = (await request.json()) as { url?: unknown };
  } catch {
    return json({ error: 'Send JSON like {"url": "https://leetcode.com/problems/two-sum/"}.' }, 400);
  }
  try {
    return json(await resolveUrl(fetch, body?.url));
  } catch (error) {
    if (error instanceof ImportError) return json({ error: error.message }, error.status);
    return json({ error: 'Something went wrong while reading LeetCode.' }, 500);
  }
}

export function GET() {
  return json({ error: 'Use POST with {"url": "..."}.' }, 405);
}

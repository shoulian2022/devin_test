// Node.js 20+，无第三方依赖。参数：推文链接或数字 ID。
const input = process.argv[2] ?? '';
const id = input.match(/^\d{1,19}$/)?.[0] ??
  input.match(/^https:\/\/(?:www\.)?(?:x|twitter)\.com\/\w+\/status\/(\d{1,19})\/?(?:[?#].*)?$/i)?.[1];
const token = process.env.X_BEARER_TOKEN;

async function main() {
  if (!id) throw new Error('请传入推文链接或数字 ID');
  if (!token) throw new Error('缺少环境变量 X_BEARER_TOKEN');

  const url = new URL(`https://api.x.com/2/tweets/${id}`);
  url.searchParams.set('tweet.fields', 'created_at,public_metrics');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const reset = res.headers.get('x-rate-limit-reset');
    throw new Error(`X API HTTP ${res.status}` +
      (res.status === 429 && reset ? `；限流重置时间（Unix 秒）：${reset}` : ''));
  }

  const { data, errors } = await res.json();
  if (data?.id !== id) throw new Error(errors?.[0]?.detail ?? '响应中没有目标推文');

  const fields = {
    impressions: 'impression_count', reposts: 'retweet_count', quotes: 'quote_count',
    likes: 'like_count', replies: 'reply_count', bookmarks: 'bookmark_count',
  };
  const metrics = Object.fromEntries(Object.entries(fields).map(([name, key]) => {
    const value = data.public_metrics?.[key];
    return [name, Number.isSafeInteger(value) && value >= 0 ? value : null];
  }));

  console.log(JSON.stringify({ post_id: id, published_at: data.created_at ?? null,
    observed_at: new Date().toISOString(), snapshot: 'current_cumulative', metrics,
    warnings: (errors ?? []).map(e => e.detail ?? e.title),
  }));
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});

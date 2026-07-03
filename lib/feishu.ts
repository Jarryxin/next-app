import "server-only";

const FEISHU_APP_ID = process.env.FEISHU_APP_ID!;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET!;
const REDIRECT_URI = process.env.FEISHU_REDIRECT_URI!;

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    app_id: FEISHU_APP_ID,
    redirect_uri: REDIRECT_URI,
    state,
  });
  return `https://open.feishu.cn/open-apis/authen/v1/index?${params}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const res = await fetch(
    "https://open.feishu.cn/open-apis/authen/v1/access_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Feishu token error: ${data.msg} (code: ${data.code})`);
  return data.data as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    name: string;
    avatar_url: string;
    avatar_thumb: string;
    avatar_middle: string;
    avatar_big: string;
    open_id: string;
    union_id: string;
    user_id: string;
  };
}

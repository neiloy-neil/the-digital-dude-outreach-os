import 'server-only';

export const OAUTH_STATE_COOKIE = 'reachmira_oauth_state';

export function getAppBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

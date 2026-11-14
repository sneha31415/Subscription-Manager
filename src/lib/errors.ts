/** Turns any thrown value into a short message that is safe to show to a person. */
export function friendlyError(e: unknown): string {
  let msg = 'Something went wrong. Please try again.';
  if (e instanceof Error) msg = e.message;
  else if (typeof e === 'object' && e !== null && 'message' in e) msg = String((e as { message: unknown }).message);
  else if (typeof e === 'string') msg = e;

  if (/network request failed|failed to fetch|network error|timed out|timeout/i.test(msg)) {
    return 'No internet connection. Check your network and try again.';
  }
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(msg)) return 'Please verify your email first — check your inbox for the confirmation link.';
  if (/user already registered/i.test(msg)) return 'An account with this email already exists. Try logging in.';
  if (/duplicate key.*payments_sub_date_unique/i.test(msg)) return 'A payment is already recorded for that date.';
  if (/rate limit|too many requests|for security purposes/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  return msg;
}

export const EMAIL_RE = /^\S+@\S+\.\S+$/;

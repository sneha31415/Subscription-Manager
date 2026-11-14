import { Redirect } from 'expo-router';
import { Loading } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

/**
 * Email links (verify email / reset password) open the app at "subtrack://auth-callback#...".
 * AuthContext reads the tokens from that URL; this screen just waits and then forwards the person on.
 */
export default function AuthCallback() {
  const { session, loading, recovering } = useAuth();
  if (loading) return <Loading label="Signing you in…" />;
  if (recovering) return <Redirect href="/reset-password" />;
  return <Redirect href={session ? '/home' : '/login'} />;
}

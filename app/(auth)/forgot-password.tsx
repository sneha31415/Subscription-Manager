import { router } from 'expo-router';
import React, { useState } from 'react';
import { Banner, Button, EmptyState, Header, Input, Screen, T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { EMAIL_RE } from '@/lib/errors';

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setBusy(true);
    const res = await sendPasswordReset(email);
    setBusy(false);
    if (res.error) setError(res.error);
    else setSent(true);
  };

  if (sent) {
    return (
      <Screen>
        <Header title="" />
        <EmptyState
          icon="mail-outline"
          title="Reset link sent"
          message={`If an account exists for ${email.trim()}, a reset link is on its way. Open it on this phone to choose a new password.`}
          actionLabel="Back to log in"
          onAction={() => router.replace('/login')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="" />
      <T variant="title">Forgot password?</T>
      <T variant="small" style={{ marginTop: 4, marginBottom: 24 }}>
        Enter your email and we'll send you a link to reset it.
      </T>
      {error && error.length > 40 ? <Banner tone="danger" text={error} /> : null}
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={error && error.length <= 40 ? error : null}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        onSubmitEditing={submit}
      />
      <Button title="Send reset link" onPress={submit} loading={busy} />
    </Screen>
  );
}

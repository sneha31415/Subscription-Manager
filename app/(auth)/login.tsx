import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Banner, Button, Header, Input, Screen, T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { EMAIL_RE } from '@/lib/errors';
import { colors } from '@/theme';

export default function Login() {
  const { signIn, resendVerification } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const unverified = !!errors.form && /verify your email/i.test(errors.form);

  const submit = async () => {
    const e: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Enter your password.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    if (res.error) setErrors({ form: res.error });
    // On success the route guard moves the person to the dashboard
  };

  const resend = async () => {
    const res = await resendVerification(email);
    Alert.alert(res.error ? 'Could not send' : 'Email sent', res.error ?? 'We sent a new verification link to your inbox.');
  };

  return (
    <Screen>
      <Header title="" />
      <T variant="title">Welcome back</T>
      <T variant="small" style={{ marginTop: 4, marginBottom: 24 }}>
        Log in to see your subscriptions.
      </T>

      {errors.form ? <Banner tone="danger" text={errors.form} actionLabel={unverified ? 'Resend' : undefined} onAction={resend} /> : null}

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="password"
        placeholder="Your password"
        onSubmitEditing={submit}
        right={
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={10}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
          </Pressable>
        }
      />
      <Pressable onPress={() => router.push('/forgot-password')} style={{ alignSelf: 'flex-end', marginBottom: 18 }}>
        <T variant="small" color={colors.primary} style={{ fontWeight: '700' }}>
          Forgot password?
        </T>
      </Pressable>
      <Button title="Log in" onPress={submit} loading={busy} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 6 }}>
        <T variant="small">New to SubTrack?</T>
        <Pressable onPress={() => router.replace('/signup')}>
          <T variant="small" color={colors.primary} style={{ fontWeight: '700' }}>
            Create an account
          </T>
        </Pressable>
      </View>
    </Screen>
  );
}

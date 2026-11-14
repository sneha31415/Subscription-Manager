import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Banner, Button, EmptyState, Header, Input, Screen, T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme';
import { EMAIL_RE } from '@/lib/errors';

export default function Signup() {
  const { signUp, resendVerification } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter your name.';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    if (password.length < 8) e.password = 'Use at least 8 characters.';
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) e.password = 'Include at least one letter and one number.';
    if (confirm !== password) e.confirm = 'Passwords do not match.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    const res = await signUp(name, email, password);
    setBusy(false);
    if (res.error) {
      setErrors({ form: res.error });
      return;
    }
    if (res.needsVerification) setSent(true);
    // If email confirmation is switched off in Supabase, a session exists and the guard takes over
  };

  const resend = async () => {
    const res = await resendVerification(email);
    Alert.alert(res.error ? 'Could not send' : 'Email sent', res.error ?? 'We sent a new verification link.');
  };

  if (sent) {
    return (
      <Screen>
        <Header title="" back={false} />
        <EmptyState
          icon="mail-unread-outline"
          title="Check your email"
          message={`We sent a verification link to ${email.trim()}. Tap it on this phone to activate your account, then log in.`}
          actionLabel="Go to log in"
          onAction={() => router.replace('/login')}
        />
        <Button title="Resend email" variant="ghost" onPress={resend} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="" />
      <T variant="title">Create account</T>
      <T variant="small" style={{ marginTop: 4, marginBottom: 24 }}>
        Your subscriptions are private to your account.
      </T>
      {errors.form ? <Banner tone="danger" text={errors.form} /> : null}
      <Input label="Name" value={name} onChangeText={setName} error={errors.name} placeholder="Your name" autoComplete="name" />
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
        hint="At least 8 characters with a letter and a number."
        secureTextEntry={!show}
        autoCapitalize="none"
        placeholder="Create a password"
        right={
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={10}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
          </Pressable>
        }
      />
      <Input
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        secureTextEntry={!show}
        autoCapitalize="none"
        placeholder="Repeat the password"
        onSubmitEditing={submit}
      />
      <Button title="Create account" onPress={submit} loading={busy} style={{ marginTop: 6 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 6 }}>
        <T variant="small">Already have an account?</T>
        <Pressable onPress={() => router.replace('/login')}>
          <T variant="small" color={colors.primary} style={{ fontWeight: '700' }}>
            Log in
          </T>
        </Pressable>
      </View>
    </Screen>
  );
}

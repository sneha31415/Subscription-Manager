import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Banner, Button, Header, Input, Screen, T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export default function ResetPassword() {
  const { setNewPassword, signOut, session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (password.length < 8) e.password = 'Use at least 8 characters.';
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) e.password = 'Include at least one letter and one number.';
    if (confirm !== password) e.confirm = 'Passwords do not match.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const res = await setNewPassword(password);
    setBusy(false);
    if (res.error) {
      setErrors({ form: res.error });
      return;
    }
    Alert.alert('Password updated', 'You can now use your new password.', [
      { text: 'Continue', onPress: () => router.replace('/home') },
    ]);
  };

  if (!session) {
    return (
      <Screen>
        <Header title="" back={false} />
        <T variant="title">Link expired</T>
        <T variant="small" style={{ marginTop: 6, marginBottom: 20 }}>
          This reset link is no longer valid. Request a new one from the login screen.
        </T>
        <Button title="Back to log in" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="" back={false} />
      <T variant="title">Choose a new password</T>
      <T variant="small" style={{ marginTop: 4, marginBottom: 24 }}>
        Pick something you haven't used before.
      </T>
      {errors.form ? <Banner tone="danger" text={errors.form} /> : null}
      <Input label="New password" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry autoCapitalize="none" />
      <Input label="Confirm password" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureTextEntry autoCapitalize="none" onSubmitEditing={submit} />
      <Button title="Update password" onPress={submit} loading={busy} />
      <Button title="Cancel" variant="ghost" onPress={() => signOut()} style={{ marginTop: 8 }} />
    </Screen>
  );
}

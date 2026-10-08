import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Colors } from '../theme';
import {
  type AuthUser,
  type Provider,
  providers,
  signIn,
  signOut,
  subscribe,
} from './session';

const labels: Record<Provider, string> = {
  google: 'Google',
  apple: 'Apple',
};

// Signs in with Google or Apple through Firebase Authentication, and shows
// who's signed in.
export function SignInBar({ colors }: { colors: Colors }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribe(setUser), []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const status = user
    ? `Signed in as ${user.name ?? user.email ?? user.uid}`
    : providers.length > 0
      ? 'Signed out'
      : "Sign-in isn't set up";

  return (
    <View style={[styles.bar, { borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text
            testID="signin-status"
            numberOfLines={1}
            style={[styles.status, { color: colors.text }]}
          >
            {status}
          </Text>
          {user && (
            <Text style={[styles.detail, { color: colors.muted }]}>
              {[user.email, user.provider].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        {user ? (
          <Button
            testID="signin-signout"
            label="Sign out"
            disabled={busy}
            onPress={() => run(signOut)}
            colors={colors}
          />
        ) : (
          providers.map((provider) => (
            <Button
              key={provider}
              testID={`signin-${provider}`}
              label={labels[provider]}
              disabled={busy}
              onPress={() => run(() => signIn(provider))}
              colors={colors}
            />
          ))
        )}
      </View>
      {error !== null && (
        <Text
          testID="signin-error"
          style={[styles.detail, { color: colors.fail }]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

function Button({
  testID,
  label,
  disabled,
  onPress,
  colors,
}: {
  testID: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
  colors: Colors;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text style={{ color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  status: {
    fontSize: 15,
  },
  detail: {
    fontSize: 12,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
});

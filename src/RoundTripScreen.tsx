import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deepEqual } from './roundTrip/deepEqual';
import { describe } from './roundTrip/describe';
import { type RoundTripResult, runRoundTrips } from './roundTrip/run';

type Run =
  | { state: 'running' }
  | { state: 'done'; results: RoundTripResult[] }
  | { state: 'error'; message: string };

const light = {
  background: '#f6f7f9',
  card: '#ffffff',
  text: '#16181d',
  muted: '#5e6573',
  border: '#e2e5ea',
  pass: '#1a7f37',
  fail: '#cf222e',
  note: '#9a6700',
};

const dark: typeof light = {
  background: '#0f1115',
  card: '#181b21',
  text: '#e8eaee',
  muted: '#9aa1ad',
  border: '#2a2f38',
  pass: '#4ac26b',
  fail: '#ff7b72',
  note: '#d29922',
};

const monospace = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, monospace',
});

export function RoundTripScreen() {
  const colors = useColorScheme() === 'dark' ? dark : light;
  const insets = useSafeAreaInsets();
  const [run, setRun] = useState<Run>({ state: 'running' });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt reruns the cases.
  useEffect(() => {
    let current = true;
    setRun({ state: 'running' });
    runRoundTrips().then(
      (results) => current && setRun({ state: 'done', results }),
      (error) => current && setRun({ state: 'error', message: String(error) }),
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  const results = run.state === 'done' ? run.results : [];
  const failed = results.filter((result) => !result.passed).length;
  const status =
    run.state === 'running'
      ? 'running'
      : run.state === 'done' && failed === 0
        ? 'passed'
        : 'failed';
  // Failures first, otherwise in case order.
  const sorted = [...results].sort(
    (a, b) => Number(a.passed) - Number(b.passed),
  );

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={[styles.header, { borderColor: colors.border }]}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>
            Bridge round trip
          </Text>
          {/* Separate Text views: a nested Text's testID isn't reachable on iOS. */}
          <View style={styles.statusRow}>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {Platform.OS} ·
            </Text>
            <Text
              testID="roundtrip-status"
              style={[
                styles.subtitle,
                {
                  color:
                    status === 'running'
                      ? colors.muted
                      : status === 'passed'
                        ? colors.pass
                        : colors.fail,
                },
              ]}
            >
              {status}
            </Text>
          </View>
          {run.state === 'done' && (
            <Text
              testID="roundtrip-summary"
              style={[styles.subtitle, { color: colors.muted }]}
            >
              {results.length - failed} passed, {failed} failed
            </Text>
          )}
          {run.state === 'error' && (
            <Text style={[styles.subtitle, { color: colors.fail }]}>
              {run.message}
            </Text>
          )}
        </View>
        <Pressable
          testID="roundtrip-run"
          accessibilityRole="button"
          disabled={run.state === 'running'}
          onPress={() => setAttempt((count) => count + 1)}
          style={({ pressed }) => [
            styles.button,
            { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={{ color: colors.text }}>Run again</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        {sorted.map((result) => (
          <ResultRow
            key={`${result.group}/${result.name}`}
            result={result}
            colors={colors}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// A case's row: tapping it shows or hides what it does and the values it sent
// and got back. Failures start open, so their values show without a tap.
function ResultRow({
  result,
  colors,
}: {
  result: RoundTripResult;
  colors: typeof light;
}) {
  const [open, setOpen] = useState(!result.passed);
  const testID = `roundtrip-case-${result.group}-${result.name}`;
  // Most cases expect their input back; show the expected value when it isn't.
  const showExpected =
    !result.passed || !deepEqual(result.expected, result.input);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      aria-expanded={open}
      onPress={() => setOpen((value) => !value)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.rowHeader}>
        <Text style={[styles.chevron, { color: colors.muted }]}>
          {open ? '▾' : '▸'}
        </Text>
        <Text style={[styles.group, { color: colors.muted }]}>
          {result.group}
        </Text>
        <Text style={[styles.name, { color: colors.text }]}>{result.name}</Text>
        {result.difference !== undefined && (
          <Text style={[styles.tag, { color: colors.note }]}>differs</Text>
        )}
        <Text
          style={[
            styles.verdict,
            { color: result.passed ? colors.pass : colors.fail },
          ]}
        >
          {result.passed ? 'pass' : 'fail'}
        </Text>
      </View>
      {open && (
        <View style={styles.details}>
          <Text
            testID={`${testID}-description`}
            style={[styles.description, { color: colors.text }]}
          >
            {result.description}
          </Text>
          <Value
            label="Sent"
            value={
              result.input === undefined
                ? 'no arguments'
                : describe(result.input)
            }
            colors={colors}
          />
          <Value
            label="Received"
            value={describe(result.actual)}
            colors={colors}
          />
          {showExpected && (
            <Value
              label="Expected"
              value={describe(result.expected)}
              colors={colors}
            />
          )}
          {result.difference !== undefined && (
            <Text style={[styles.value, { color: colors.note }]}>
              {Platform.OS} differs: {result.difference}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

function Value({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: typeof light;
}) {
  return (
    <View style={styles.labeled}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <Text
        selectable
        style={[styles.value, { color: colors.text, fontFamily: monospace }]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  row: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  chevron: {
    fontSize: 12,
    width: 10,
  },
  group: {
    fontSize: 12,
    minWidth: 64,
  },
  name: {
    flex: 1,
    fontSize: 15,
  },
  tag: {
    fontSize: 12,
  },
  verdict: {
    fontSize: 13,
    fontWeight: '600',
  },
  details: {
    gap: 8,
    marginTop: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  labeled: {
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 12,
    lineHeight: 17,
  },
});

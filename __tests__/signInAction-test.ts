import {
  idle,
  type SignInAction,
  type SignInActionEvent,
  transition,
} from '../src/auth/signInAction';

const pending = (request: number): SignInAction => ({
  status: 'pending',
  request,
});
const failed: SignInAction = { status: 'failed', message: 'Offline.' };

test.each<[SignInAction, SignInActionEvent, SignInAction]>([
  // Legal moves.
  [idle, { type: 'start', request: 1 }, pending(1)],
  [failed, { type: 'start', request: 2 }, pending(2)],
  [pending(1), { type: 'succeed', request: 1 }, idle],
  [
    pending(1),
    { type: 'fail', request: 1, message: 'Offline.' },
    { status: 'failed', message: 'Offline.' },
  ],
  // A newer attempt replaces one in flight.
  [pending(1), { type: 'start', request: 2 }, pending(2)],
  // Ignored: nothing is in flight, or the attempt is not the current one.
  [idle, { type: 'succeed', request: 1 }, idle],
  [idle, { type: 'fail', request: 1, message: 'Late.' }, idle],
  [failed, { type: 'succeed', request: 1 }, failed],
  [failed, { type: 'fail', request: 1, message: 'Late.' }, failed],
  [pending(2), { type: 'succeed', request: 1 }, pending(2)],
  [pending(2), { type: 'fail', request: 1, message: 'Late.' }, pending(2)],
])('%o + %o', (state, event, next) => {
  expect(transition(state, event)).toEqual(next);
});

test('a stale attempt cannot finish a newer one', () => {
  const events: SignInActionEvent[] = [
    { type: 'start', request: 1 },
    { type: 'fail', request: 1, message: 'Offline.' },
    { type: 'start', request: 2 },
    { type: 'succeed', request: 1 },
    { type: 'fail', request: 1, message: 'Stale.' },
  ];
  expect(events.reduce(transition, idle)).toEqual(pending(2));
});

test('a failure is only held while nothing is in flight', () => {
  // The old busy and error flags could both be set; the union cannot hold
  // a pending attempt with a message.
  const started = transition(failed, { type: 'start', request: 3 });
  expect(started).toEqual(pending(3));
  expect('message' in started).toBe(false);
});

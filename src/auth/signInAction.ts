// The sign-in bar's current sign-in or sign-out: none, one in flight, or the
// last one's failure. Each attempt carries a request number, so only the
// latest attempt can finish.

export type SignInAction =
  | { status: 'idle' }
  | { status: 'pending'; request: number }
  | { status: 'failed'; message: string };

export type SignInActionEvent =
  | { type: 'start'; request: number }
  | { type: 'succeed'; request: number }
  | { type: 'fail'; request: number; message: string };

export const idle: SignInAction = { status: 'idle' };

const current = (state: SignInAction, request: number) =>
  state.status === 'pending' && state.request === request;

export function transition(
  state: SignInAction,
  event: SignInActionEvent,
): SignInAction {
  switch (event.type) {
    // A new attempt clears the last one's failure.
    case 'start':
      return { status: 'pending', request: event.request };
    case 'succeed':
      return current(state, event.request) ? idle : state;
    case 'fail':
      return current(state, event.request)
        ? { status: 'failed', message: event.message }
        : state;
    default:
      return assertNever(event);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled sign-in event: ${JSON.stringify(value)}`);
}

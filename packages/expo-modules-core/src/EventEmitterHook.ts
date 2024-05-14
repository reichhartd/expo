import { useEffect, useState } from 'react';
import { Subscription } from './EventEmitter';

interface EventEmitterHookMethods<TEvent> {
  addListener: (listener: (event: TEvent) => void) => Subscription;
  getInitialStateAsync: () => Promise<TEvent>;
  emptyState: TEvent;
}

/**
 * Get or request permission for protected functionality within the app.
 * It uses separate permission requesters to interact with a single permission.
 * By default, the hook will only retrieve the permission status.
 */
function useEventEmitter<TEvent>(methods: EventEmitterHookMethods<TEvent>): TEvent {
  const [event, setEvent] = useState<TEvent>(methods.emptyState);

  useEffect(() => {
    methods.getInitialStateAsync().then(setEvent);
    const listener = methods.addListener((newEvent) => setEvent(newEvent));
    return listener.remove;
  }, []);

  return event;
}

/**
 * Create a new permission hook with the permission methods built-in.
 * This can be used to quickly create specific permission hooks in every module.
 */
export function createEventEmitterHook<TEvent>(methods: EventEmitterHookMethods<TEvent>) {
  return () => useEventEmitter<TEvent>(methods);
}

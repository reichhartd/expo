import { useEffect, useState } from 'react';
import { Subscription } from './EventEmitter';

interface EventEmitterHookMethods<TEvent> {
  addListener: (listener: (event: TEvent) => void) => Subscription;
  getInitialStateAsync: () => Promise<TEvent>;
  emptyState: TEvent;
}

/**
 * A React hook that provides the current state of an event and the ability to listen for changes to that event.
 * It initializes the state with an empty state and subscribes to the event to receive updates.
 * @param methods - An object with methods for interacting with the event, including initialization and event listener.
 * @returns The current state of the event.
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
 * Creates a new hook for managing event emitter interactions specific to a particular type of event.
 * This function is intended to simplify the creation of custom hooks for different modules using the same pattern.
 * @param methods - The methods for event management and initial state setup.
 * @returns A custom hook function that manages the event lifecycle and state.
 */
export function createEventEmitterHook<TEvent>(methods: EventEmitterHookMethods<TEvent>) {
  return () => useEventEmitter<TEvent>(methods);
}

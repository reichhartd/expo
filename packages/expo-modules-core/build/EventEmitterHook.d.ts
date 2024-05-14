import { Subscription } from './EventEmitter';
interface EventEmitterHookMethods<TEvent> {
    addListener: (listener: (event: TEvent) => void) => Subscription;
    getInitialStateAsync: () => Promise<TEvent>;
    emptyState: TEvent;
}
/**
 * Creates a new hook for managing event emitter interactions specific to a particular type of event.
 * This function is intended to simplify the creation of custom hooks for different modules using the same pattern.
 * @param methods - The methods for event management and initial state setup.
 * @returns A custom hook function that manages the event lifecycle and state.
 */
export declare function createEventEmitterHook<TEvent>(methods: EventEmitterHookMethods<TEvent>): () => TEvent;
export {};
//# sourceMappingURL=EventEmitterHook.d.ts.map
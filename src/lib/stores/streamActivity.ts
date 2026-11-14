import { writable, type Writable } from 'svelte/store';

/**
 * Last time (ms) any socket event arrived for an in-flight assistant message.
 * Used to tell a slow-but-alive reply apart from one that has gone silent.
 */
export const streamActivity: Writable<Record<string, number>> = writable({});

export const markStreamActivity = (messageId: string | null | undefined) => {
	if (!messageId) return;
	streamActivity.update((activity) => ({ ...activity, [messageId]: Date.now() }));
};

/**
 * Actions a mounted chat exposes to stalled-reply notices, so the notice does not need
 * these handlers threaded through every message component. More than one chat can be
 * mounted (e.g. a page chat and a notes chat), so each controller says which messages
 * it owns.
 */
export type StreamController = {
	owns: (messageId: string) => boolean;
	stop: (messageId: string) => Promise<void> | void;
	recover: (messageId: string) => Promise<void> | void;
};

export const streamControllers: Writable<StreamController[]> = writable([]);

export const registerStreamController = (controller: StreamController) => {
	streamControllers.update((list) => [...list, controller]);
	return () => streamControllers.update((list) => list.filter((entry) => entry !== controller));
};

export const findStreamController = (list: StreamController[], messageId: string) =>
	list.find((controller) => controller.owns(messageId)) ?? null;

/** Show the elapsed-time hint after this much silence. */
export const STREAM_SLOW_AFTER_MS = 15_000;
/** Offer Stop and probe the server after this much silence. */
export const STREAM_STALLED_AFTER_MS = 90_000;
/** While stalled, re-check task state this often. */
export const STREAM_RECOVER_EVERY_MS = 60_000;

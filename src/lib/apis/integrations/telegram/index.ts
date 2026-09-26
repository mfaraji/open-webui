import { WEBUI_API_BASE_URL } from '$lib/constants';

const BASE_URL = `${WEBUI_API_BASE_URL}/integrations/telegram`;

export type TelegramDestination = {
	alias: string;
	chat_id: string;
	title: string;
	username?: string | null;
	enabled: boolean;
	verified_at: string;
};

export type TelegramStatus = {
	connected: boolean;
	bot?: { bot_id?: string; username?: string; display_name?: string } | null;
	destinations: TelegramDestination[];
};

const headers = (token: string) => ({
	Accept: 'application/json',
	'Content-Type': 'application/json',
	...(token ? { Authorization: `Bearer ${token}` } : {})
});

const parse = async (response: Response) => {
	const payload = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(payload.detail ?? 'Telegram request failed.');
	return payload;
};

export const getTelegramStatus = async (token: string): Promise<TelegramStatus> =>
	parse(await fetch(`${BASE_URL}/status`, { headers: headers(token) }));

export const connectTelegram = async (token: string, botToken: string) =>
	parse(
		await fetch(`${BASE_URL}/connection`, {
			method: 'PUT',
			headers: headers(token),
			body: JSON.stringify({ bot_token: botToken })
		})
	);

export const disconnectTelegram = async (token: string) =>
	parse(await fetch(`${BASE_URL}/connection`, { method: 'DELETE', headers: headers(token) }));

export const addTelegramDestination = async (token: string, alias: string, target: string) =>
	parse(
		await fetch(`${BASE_URL}/destinations`, {
			method: 'POST',
			headers: headers(token),
			body: JSON.stringify({ alias, target })
		})
	);

export const verifyTelegramDestination = async (token: string, alias: string) =>
	parse(
		await fetch(`${BASE_URL}/destinations/${encodeURIComponent(alias)}/verify`, {
			method: 'POST',
			headers: headers(token)
		})
	);

export const removeTelegramDestination = async (token: string, alias: string) =>
	parse(
		await fetch(`${BASE_URL}/destinations/${encodeURIComponent(alias)}`, {
			method: 'DELETE',
			headers: headers(token)
		})
	);

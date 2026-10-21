import { WEBUI_API_BASE_URL } from '$lib/constants';

const BASE_URL = `${WEBUI_API_BASE_URL}/integrations/mcp-oauth`;

const headers = (token: string) => ({
	Accept: 'application/json',
	...(token ? { Authorization: `Bearer ${token}` } : {})
});

const parse = async (response: Response) => {
	const payload = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(payload.detail ?? 'MCP account linking failed.');
	return payload;
};

export const getMcpOAuthLinkStatus = async (token: string): Promise<{ linked: boolean }> =>
	parse(await fetch(`${BASE_URL}/status`, { headers: headers(token) }));

export const startMcpOAuthLink = async (token: string): Promise<{ url: string }> =>
	parse(await fetch(`${BASE_URL}/start`, { method: 'POST', headers: headers(token) }));

export const removeMcpOAuthLink = async (token: string): Promise<{ linked: false }> =>
	parse(await fetch(`${BASE_URL}/link`, { method: 'DELETE', headers: headers(token) }));

import { WEBUI_API_BASE_URL } from '$lib/constants';

const BASE_URL = `${WEBUI_API_BASE_URL}/integrations/google-drive`;

export type GoogleDriveStatus = {
	connected: boolean;
	connection_state: 'connected' | 'not_connected' | 'reauthorization_required';
	account_email?: string | null;
	authorization_url?: string;
};

export type GoogleDriveFile = {
	id: string;
	name: string;
	source_name?: string;
	mime_type: string;
	source_mime_type: string;
	size?: number | null;
	modified_time?: string | null;
	shared: boolean;
	shared_drive_id?: string | null;
	is_shortcut: boolean;
	selectable: boolean;
	unselectable_reason?: string | null;
};

export class GoogleDriveIntegrationError extends Error {
	code: string;
	status: number;
	authorizationUrl?: string;

	constructor(code: string, message: string, status: number, authorizationUrl?: string) {
		super(message);
		this.code = code;
		this.status = status;
		this.authorizationUrl = authorizationUrl;
	}
}

const authHeaders = (token: string) => ({
	Accept: 'application/json',
	...(token ? { Authorization: `Bearer ${token}` } : {})
});

const parseError = async (response: Response): Promise<GoogleDriveIntegrationError> => {
	let payload: Record<string, string> = {};
	try {
		payload = await response.json();
	} catch {
		// The backend deliberately hides non-JSON gateway failures.
	}
	return new GoogleDriveIntegrationError(
		payload.error ?? 'provider_error',
		payload.detail ?? 'Google Drive request failed.',
		response.status,
		payload.authorization_url
	);
};

export const getGoogleDriveStatus = async (token: string): Promise<GoogleDriveStatus> => {
	const response = await fetch(`${BASE_URL}/status`, { headers: authHeaders(token) });
	if (!response.ok) throw await parseError(response);
	return response.json();
};

export const searchGoogleDriveFiles = async (
	token: string,
	query = '',
	pageToken: string | null = null,
	pageSize = 25
): Promise<{ files: GoogleDriveFile[]; next_page_token?: string | null }> => {
	const params = new URLSearchParams({ q: query, page_size: String(pageSize) });
	if (pageToken) params.set('page_token', pageToken);
	const response = await fetch(`${BASE_URL}/files?${params}`, { headers: authHeaders(token) });
	if (!response.ok) throw await parseError(response);
	return response.json();
};

export const downloadGoogleDriveFile = async (
	token: string,
	file: GoogleDriveFile,
	onProgress: (progress: number) => void
): Promise<File> => {
	const response = await fetch(`${BASE_URL}/files/${encodeURIComponent(file.id)}/content`, {
		headers: authHeaders(token)
	});
	if (!response.ok) throw await parseError(response);

	const total = Number(response.headers.get('content-length') ?? file.size ?? 0);
	const reader = response.body?.getReader();
	if (!reader) return new File([await response.blob()], file.name, { type: file.mime_type });

	const chunks: BlobPart[] = [];
	let received = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		received += value.byteLength;
		onProgress(total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0);
	}
	onProgress(100);
	return new File(chunks, file.name, {
		type: response.headers.get('content-type') ?? file.mime_type ?? 'application/octet-stream'
	});
};

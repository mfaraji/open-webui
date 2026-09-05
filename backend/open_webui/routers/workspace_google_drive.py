from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from urllib.parse import quote

import aiohttp
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse

from open_webui.config import (
    ENABLE_WORKSPACE_MCP_GATEWAY_DRIVE,
    WORKSPACE_MCP_GATEWAY_SHARED_SECRET,
    WORKSPACE_MCP_GATEWAY_URL,
)
from open_webui.utils.auth import get_verified_user

log = logging.getLogger(__name__)
router = APIRouter()

_JSON_TIMEOUT = aiohttp.ClientTimeout(total=30, connect=5)
_DOWNLOAD_TIMEOUT = aiohttp.ClientTimeout(total=180, connect=5, sock_read=60)
_SAFE_ERRORS = {
    'reauth_required',
    'not_found',
    'forbidden',
    'too_large',
    'unsupported_type',
    'broken_shortcut',
    'rate_limited',
    'provider_timeout',
    'provider_error',
    'internal_error',
}


def _require_enabled() -> None:
    if not ENABLE_WORKSPACE_MCP_GATEWAY_DRIVE:
        raise HTTPException(status_code=404, detail='Google Drive integration is disabled.')
    if not WORKSPACE_MCP_GATEWAY_SHARED_SECRET:
        raise HTTPException(status_code=503, detail='Google Drive integration is not configured.')


def _headers(user) -> dict[str, str]:
    return {
        'X-Gateway-Auth': WORKSPACE_MCP_GATEWAY_SHARED_SECRET,
        'X-OpenWebUI-User-Id': str(user.id),
        'X-OpenWebUI-User-Email': user.email or '',
        'X-OpenWebUI-User-Name': user.name or '',
        'Accept': 'application/json',
    }


def _safe_error(status: int, payload: object) -> JSONResponse:
    if isinstance(payload, dict) and payload.get('error') in _SAFE_ERRORS:
        body = {
            'error': payload['error'],
            'detail': payload.get('detail') or 'Google Drive request failed.',
        }
        if payload.get('authorization_url'):
            body['authorization_url'] = payload['authorization_url']
        return JSONResponse(body, status_code=status, headers={'Cache-Control': 'no-store'})
    return JSONResponse(
        {'error': 'provider_error', 'detail': 'Google Drive request failed.'},
        status_code=status if 400 <= status < 600 else 502,
        headers={'Cache-Control': 'no-store'},
    )


async def _json_request(path: str, user, params: dict | None = None) -> JSONResponse:
    _require_enabled()
    try:
        async with aiohttp.ClientSession(timeout=_JSON_TIMEOUT, trust_env=False) as session:
            async with session.get(
                f'{WORKSPACE_MCP_GATEWAY_URL}{path}',
                headers=_headers(user),
                params=params,
            ) as response:
                try:
                    payload = await response.json(content_type=None)
                except (aiohttp.ContentTypeError, ValueError):
                    payload = None
                if response.status >= 400:
                    return _safe_error(response.status, payload)
                if not isinstance(payload, dict):
                    return _safe_error(502, None)
                return JSONResponse(payload, headers={'Cache-Control': 'no-store'})
    except TimeoutError:
        return JSONResponse(
            {'error': 'provider_timeout', 'detail': 'Google Drive did not respond in time.'},
            status_code=504,
            headers={'Cache-Control': 'no-store'},
        )
    except aiohttp.ClientError:
        log.warning('Workspace MCP gateway is unavailable for Google Drive')
        return JSONResponse(
            {'error': 'provider_error', 'detail': 'Google Drive is temporarily unavailable.'},
            status_code=502,
            headers={'Cache-Control': 'no-store'},
        )


@router.get('/status')
async def drive_status(user=Depends(get_verified_user)):
    return await _json_request('/api/drive/status', user)


@router.get('/files')
async def drive_files(
    q: str = Query('', max_length=200),
    page_token: str | None = Query(None, max_length=4096),
    page_size: int = Query(25, ge=1, le=100),
    user=Depends(get_verified_user),
):
    params = {'q': q, 'page_size': str(page_size)}
    if page_token:
        params['page_token'] = page_token
    return await _json_request('/api/drive/files', user, params)


@router.get('/files/{file_id}/content')
async def drive_file_content(file_id: str, user=Depends(get_verified_user)):
    _require_enabled()
    session = aiohttp.ClientSession(timeout=_DOWNLOAD_TIMEOUT, trust_env=False)
    try:
        response = await session.get(
            f'{WORKSPACE_MCP_GATEWAY_URL}/api/drive/files/{quote(file_id, safe="")}/content',
            headers=_headers(user),
        )
    except TimeoutError:
        await session.close()
        return JSONResponse(
            {'error': 'provider_timeout', 'detail': 'Google Drive did not respond in time.'},
            status_code=504,
            headers={'Cache-Control': 'no-store'},
        )
    except aiohttp.ClientError:
        await session.close()
        return JSONResponse(
            {'error': 'provider_error', 'detail': 'Google Drive is temporarily unavailable.'},
            status_code=502,
            headers={'Cache-Control': 'no-store'},
        )

    if response.status >= 400:
        try:
            payload = await response.json(content_type=None)
        except (aiohttp.ContentTypeError, ValueError):
            payload = None
        response.release()
        await session.close()
        return _safe_error(response.status, payload)

    async def stream() -> AsyncIterator[bytes]:
        try:
            async for chunk in response.content.iter_chunked(1024 * 1024):
                yield chunk
        finally:
            response.release()
            await session.close()

    headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}
    for source, target in (
        ('Content-Disposition', 'Content-Disposition'),
        ('Content-Length', 'Content-Length'),
    ):
        value = response.headers.get(source)
        if value:
            headers[target] = value
    return StreamingResponse(
        stream(),
        media_type=response.headers.get('Content-Type', 'application/octet-stream'),
        headers=headers,
    )

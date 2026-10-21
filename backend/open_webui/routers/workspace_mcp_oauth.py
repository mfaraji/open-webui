"""Authenticated Open WebUI proxy for gateway OAuth account linking."""

from __future__ import annotations

import logging

import aiohttp
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from open_webui.config import (
    ENABLE_WORKSPACE_MCP_GATEWAY_OAUTH_LINKING,
    WORKSPACE_MCP_GATEWAY_SHARED_SECRET,
    WORKSPACE_MCP_GATEWAY_URL,
)
from open_webui.utils.auth import get_verified_user

log = logging.getLogger(__name__)
router = APIRouter()
_TIMEOUT = aiohttp.ClientTimeout(total=15, connect=5)


async def _request(method: str, path: str, user) -> JSONResponse:
    if not ENABLE_WORKSPACE_MCP_GATEWAY_OAUTH_LINKING:
        raise HTTPException(status_code=404, detail='OAuth linking is disabled.')
    if not WORKSPACE_MCP_GATEWAY_SHARED_SECRET:
        raise HTTPException(status_code=503, detail='Gateway is not configured.')
    headers = {
        'X-Gateway-Auth': WORKSPACE_MCP_GATEWAY_SHARED_SECRET,
        'X-OpenWebUI-User-Id': str(user.id),
        'X-OpenWebUI-User-Email': user.email or '',
        'X-OpenWebUI-User-Name': user.name or '',
        'Accept': 'application/json',
    }
    try:
        async with aiohttp.ClientSession(timeout=_TIMEOUT, trust_env=False) as session:
            async with session.request(
                method, f'{WORKSPACE_MCP_GATEWAY_URL}{path}', headers=headers
            ) as response:
                payload = await response.json(content_type=None)
                if not isinstance(payload, dict):
                    raise ValueError('Invalid gateway response')
                if response.status >= 400:
                    return JSONResponse(
                        {'error': payload.get('error', 'gateway_error'),
                         'detail': payload.get('detail', 'OAuth linking failed.')},
                        status_code=response.status,
                        headers={'Cache-Control': 'no-store'},
                    )
                return JSONResponse(payload, headers={'Cache-Control': 'no-store'})
    except (aiohttp.ClientError, TimeoutError, ValueError):
        log.warning('Workspace MCP gateway is unavailable for OAuth linking')
        return JSONResponse(
            {'error': 'gateway_unavailable', 'detail': 'OAuth linking is temporarily unavailable.'},
            status_code=502,
            headers={'Cache-Control': 'no-store'},
        )


@router.get('/status')
async def oauth_link_status(user=Depends(get_verified_user)):
    return await _request('GET', '/api/oauth/link/status', user)


@router.post('/start')
async def oauth_link_start(user=Depends(get_verified_user)):
    return await _request('POST', '/api/oauth/link/start', user)


@router.delete('/link')
async def oauth_link_remove(user=Depends(get_verified_user)):
    return await _request('DELETE', '/api/oauth/link', user)

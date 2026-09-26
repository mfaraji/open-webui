from __future__ import annotations

import logging

import aiohttp
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from open_webui.config import (
    ENABLE_WORKSPACE_MCP_GATEWAY_TELEGRAM,
    WORKSPACE_MCP_GATEWAY_SHARED_SECRET,
    WORKSPACE_MCP_GATEWAY_URL,
)
from open_webui.utils.auth import get_verified_user
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)
router = APIRouter()

_TIMEOUT = aiohttp.ClientTimeout(total=35, connect=5)
_SAFE_ERRORS = {
    'conflict',
    'forbidden',
    'internal_error',
    'invalid_input',
    'not_connected',
    'not_found',
    'provider_error',
    'provider_timeout',
    'rate_limited',
    'unauthorized',
}


class TelegramConnectionBody(BaseModel):
    bot_token: str = Field(..., min_length=10, max_length=256)


class TelegramDestinationBody(BaseModel):
    alias: str = Field(..., min_length=2, max_length=64)
    target: str = Field(..., min_length=2, max_length=255)


def _require_enabled() -> None:
    if not ENABLE_WORKSPACE_MCP_GATEWAY_TELEGRAM:
        raise HTTPException(status_code=404, detail='Telegram integration is disabled.')
    if not WORKSPACE_MCP_GATEWAY_SHARED_SECRET:
        raise HTTPException(status_code=503, detail='Telegram integration is not configured.')


def _headers(user) -> dict[str, str]:
    return {
        'X-Gateway-Auth': WORKSPACE_MCP_GATEWAY_SHARED_SECRET,
        'X-OpenWebUI-User-Id': str(user.id),
        'X-OpenWebUI-User-Email': user.email or '',
        'X-OpenWebUI-User-Name': user.name or '',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }


def _safe_error(status: int, payload: object) -> JSONResponse:
    if isinstance(payload, dict) and payload.get('error') in _SAFE_ERRORS:
        return JSONResponse(
            {
                'error': payload['error'],
                'detail': payload.get('detail') or 'Telegram request failed.',
            },
            status_code=status,
            headers={'Cache-Control': 'no-store'},
        )
    return JSONResponse(
        {'error': 'provider_error', 'detail': 'Telegram request failed.'},
        status_code=status if 400 <= status < 600 else 502,
        headers={'Cache-Control': 'no-store'},
    )


async def _gateway_request(method: str, path: str, user, body: dict | None = None) -> JSONResponse:
    _require_enabled()
    try:
        async with aiohttp.ClientSession(timeout=_TIMEOUT, trust_env=False) as session:
            async with session.request(
                method,
                f'{WORKSPACE_MCP_GATEWAY_URL}{path}',
                headers=_headers(user),
                json=body,
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
            {'error': 'provider_timeout', 'detail': 'Telegram did not respond in time.'},
            status_code=504,
            headers={'Cache-Control': 'no-store'},
        )
    except aiohttp.ClientError:
        log.warning('Workspace MCP gateway is unavailable for Telegram')
        return JSONResponse(
            {'error': 'provider_error', 'detail': 'Telegram is temporarily unavailable.'},
            status_code=502,
            headers={'Cache-Control': 'no-store'},
        )


@router.get('/status')
async def telegram_status(user=Depends(get_verified_user)):
    return await _gateway_request('GET', '/api/telegram/status', user)


@router.put('/connection')
async def telegram_connect(body: TelegramConnectionBody, user=Depends(get_verified_user)):
    return await _gateway_request('PUT', '/api/telegram/connection', user, {'bot_token': body.bot_token})


@router.delete('/connection')
async def telegram_disconnect(user=Depends(get_verified_user)):
    return await _gateway_request('DELETE', '/api/telegram/connection', user)


@router.post('/destinations')
async def telegram_add_destination(body: TelegramDestinationBody, user=Depends(get_verified_user)):
    return await _gateway_request(
        'POST',
        '/api/telegram/destinations',
        user,
        {'alias': body.alias, 'target': body.target},
    )


@router.post('/destinations/{alias}/verify')
async def telegram_verify_destination(alias: str, user=Depends(get_verified_user)):
    return await _gateway_request('POST', f'/api/telegram/destinations/{alias}/verify', user)


@router.delete('/destinations/{alias}')
async def telegram_delete_destination(alias: str, user=Depends(get_verified_user)):
    return await _gateway_request('DELETE', f'/api/telegram/destinations/{alias}', user)

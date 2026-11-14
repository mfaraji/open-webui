"""MCP apps: a widget's tool calls skip the host dialog only for trusted servers' flagged tools."""

import importlib.util
import sys
import types
from pathlib import Path

# apps.py needs only a secret and a JSON codec from the wider app; stub them.
env = types.ModuleType('open_webui.env')
env.WEBUI_SECRET_KEY = 'test-secret'
codec = types.ModuleType('open_webui.utils.json_codec')
codec.JSONCodec = types.SimpleNamespace(dumps=lambda value, **_: __import__('json').dumps(value))
for name, module in {
    'open_webui': types.ModuleType('open_webui'),
    'open_webui.utils': types.ModuleType('open_webui.utils'),
    'open_webui.env': env,
    'open_webui.utils.json_codec': codec,
}.items():
    sys.modules.setdefault(name, module)

_path = Path(__file__).resolve().parents[1] / 'open_webui' / 'utils' / 'mcp' / 'apps.py'
_spec = importlib.util.spec_from_file_location('mcp_apps', _path)
apps = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(apps)

TOOLS = {
    'flagged': {'_meta': {'ui': {'autoApprove': True}}},
    'plain': {'_meta': {'ui': {'resourceUri': 'ui://x/y'}}},
    'no_meta': {},
    'model_only': {'_meta': {'ui': {'autoApprove': True, 'visibility': ['model']}}},
    'string_flag': {'_meta': {'ui': {'autoApprove': 'true'}}},
}


def test_untrusted_server_never_auto_approves():
    assert apps.auto_approve_tools('srv', TOOLS, set()) == []
    assert apps.auto_approve_tools('srv', TOOLS, {'other'}) == []


def test_trusted_server_auto_approves_only_flagged_app_callable_tools():
    assert apps.auto_approve_tools('srv', TOOLS, {'srv'}) == ['flagged']

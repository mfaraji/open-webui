from open_webui.utils.misc import convert_output_to_messages


def _call(cid, name, **extra):
    return {'type': 'function_call', 'id': cid, 'call_id': cid, 'name': name, 'arguments': '{}', 'status': 'completed', **extra}


def _out(cid, text):
    return {'type': 'function_call_output', 'id': 'o' + cid, 'call_id': cid, 'output': [{'type': 'input_text', 'text': text}], 'status': 'completed'}


def _calls(messages):
    return [c for m in messages for c in m.get('tool_calls', [])]


def test_synthetic_call_not_replayed_as_tool_call():
    msgs = convert_output_to_messages([_call('a', 'recall_memories', hidden=True, synthetic=True), _out('a', 'likes tea')])
    assert not _calls(msgs)
    assert not any(m['role'] == 'tool' for m in msgs)
    assert 'likes tea' in msgs[0]['content']


def test_legacy_saved_hidden_call_also_skipped():
    msgs = convert_output_to_messages([_call('a', 'recall_memories', hidden=True), _out('a', 'x')])
    assert not _calls(msgs)


def test_signed_model_call_preserved_next_to_synthetic():
    sig = {'provider_specific_fields': {'thought_signature': 'SIG'}}
    msgs = convert_output_to_messages([
        _call('a', 'recall_memories', hidden=True, synthetic=True), _out('a', 'mem'),
        _call('b', 'web_search', **sig), _out('b', 'result'),
    ])
    calls = _calls(msgs)
    assert [c['id'] for c in calls] == ['b']
    assert calls[0]['provider_specific_fields'] == sig['provider_specific_fields']
    assert [m['role'] for m in msgs].count('tool') == 1


def test_ordinary_calls_unchanged():
    msgs = convert_output_to_messages([_call('a', 'web_search'), _out('a', 'r')])
    assert len(_calls(msgs)) == 1

"""Normalization used only to *match* text in search; stored text is never modified.

Persian is routinely typed with Arabic keyboard variants and with or without
half-spaces (ZWNJ), so a search for ``کتاب`` must find ``كتاب`` and
``می‌خواهم`` must find ``میخواهم``. The Python and SQL sides use the same fold
table so a term and the column it is compared with are always folded alike.
"""

from sqlalchemy import func

# Arabic yeh / alef maksura -> Persian yeh, Arabic kaf -> Persian keheh.
CHARACTER_FOLDS: tuple[tuple[str, str], ...] = (
    ('ي', 'ی'),
    ('ى', 'ی'),
    ('ك', 'ک'),
)
# Half-space and joiners are dropped so spacing variants compare equal.
IGNORED_CHARACTERS = ('‌', '‍')


def normalize_search_text(text: str) -> str:
    """Lowercase and fold Persian/Arabic variants. Used for queries and Python-side matching."""
    return normalize_with_offsets(text)[0]


def normalize_with_offsets(text: str) -> tuple[str, list[int]]:
    """Normalize ``text`` and return, for every normalized character, its index in the original.

    Lets callers find a match in normalized text and still slice the original for display.
    """
    folds = dict(CHARACTER_FOLDS)
    out: list[str] = []
    offsets: list[int] = []
    for index, char in enumerate(text or ''):
        if char in IGNORED_CHARACTERS:
            continue
        lowered = char.lower()
        for piece in lowered:
            out.append(folds.get(piece, piece))
            offsets.append(index)
    return ''.join(out), offsets


def sql_normalized(expression: str) -> str:
    """The same normalization as a SQL text fragment (SQLite and PostgreSQL). ``expression`` is trusted."""
    result = f'LOWER({expression})'
    for source, target in CHARACTER_FOLDS:
        result = f"REPLACE({result}, '{source}', '{target}')"
    for char in IGNORED_CHARACTERS:
        result = f"REPLACE({result}, '{char}', '')"
    return result


def column_normalized(column):
    """The same normalization as a SQLAlchemy expression for a column."""
    result = func.lower(column)
    for source, target in CHARACTER_FOLDS:
        result = func.replace(result, source, target)
    for char in IGNORED_CHARACTERS:
        result = func.replace(result, char, '')
    return result

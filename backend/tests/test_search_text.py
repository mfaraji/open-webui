"""Search normalization: Persian/Arabic variants and half-spaces fold the same in Python and SQL.

Loads the module by path so the test only needs SQLAlchemy, not the whole application.
"""

import importlib.util
import re
from pathlib import Path

import pytest
from sqlalchemy import Column, Integer, String, create_engine, select, text
from sqlalchemy.orm import Session, declarative_base

_path = Path(__file__).resolve().parents[1] / 'open_webui' / 'utils' / 'search_text.py'
_spec = importlib.util.spec_from_file_location('search_text', _path)
search_text = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(search_text)

normalize = search_text.normalize_search_text

Base = declarative_base()


class Row(Base):
    __tablename__ = 'row'
    id = Column(Integer, primary_key=True)
    title = Column(String)


@pytest.fixture
def session():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all(
            [
                Row(id=1, title='كتاب خوب'),  # Arabic kaf
                Row(id=2, title='کتاب خوب'),  # Persian keheh
                Row(id=3, title='می‌خواهم برم'),  # with half-space, Persian yeh
                Row(id=4, title='ميخواهم برم'),  # Arabic yeh, no half-space
                Row(id=5, title='Report V2'),
            ]
        )
        db.commit()
        yield db


def test_arabic_and_persian_forms_normalize_equal():
    assert normalize('كتاب') == normalize('کتاب')
    assert normalize('علي') == normalize('علی') == normalize('على')


def test_half_space_is_ignored_for_matching_only():
    assert normalize('می‌خواهم') == normalize('میخواهم')
    original = 'می‌خواهم'
    normalize(original)
    assert '‌' in original  # input is never mutated


def test_lowercases_latin_and_keeps_digits():
    assert normalize('Report-V2') == 'report-v2'
    assert normalize('۱۲۳') == '۱۲۳'


def test_offsets_map_back_to_the_original():
    original = 'ab می‌خواهم'
    folded, offsets = search_text.normalize_with_offsets(original)
    assert len(folded) == len(offsets)
    position = folded.find('خواهم')
    assert original[offsets[position] :].startswith('خواهم')


def test_unicode_word_split_yields_persian_terms():
    assert re.findall(r'\w+', normalize('كتاب می‌خواهم')) == ['کتاب', 'میخواهم']


@pytest.mark.parametrize('query', ['کتاب', 'كتاب'])
def test_sqlalchemy_title_match_finds_both_kaf_forms(session, query):
    pattern = f'%{normalize(query)}%'
    ids = session.scalars(
        select(Row.id).where(search_text.column_normalized(Row.title).like(pattern)).order_by(Row.id)
    ).all()
    assert ids == [1, 2]


@pytest.mark.parametrize('query', ['می‌خواهم', 'میخواهم', 'ميخواهم'])
def test_sqlalchemy_title_match_ignores_half_space_and_yeh_variants(session, query):
    pattern = f'%{normalize(query)}%'
    ids = session.scalars(
        select(Row.id).where(search_text.column_normalized(Row.title).like(pattern)).order_by(Row.id)
    ).all()
    assert ids == [3, 4]


def test_raw_sql_fragment_matches_like_the_column_helper(session):
    sql = f'SELECT id FROM row WHERE {search_text.sql_normalized("title")} LIKE :q ORDER BY id'
    rows = session.execute(text(sql), {'q': f'%{normalize("كتاب")}%'}).scalars().all()
    assert rows == [1, 2]


def test_latin_search_stays_case_insensitive(session):
    ids = session.scalars(
        select(Row.id).where(search_text.column_normalized(Row.title).like(f'%{normalize("report")}%'))
    ).all()
    assert ids == [5]

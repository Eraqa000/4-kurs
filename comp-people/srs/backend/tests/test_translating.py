import pytest

from app.providers.base import ImageProvider, ImageResult, UnsafePrompt
from app.providers.translating import TranslatingImageProvider


class Recorder(ImageProvider):
    def __init__(self):
        self.prompts = []

    def generate(self, prompt):
        self.prompts.append(prompt)
        return ImageResult(b"x", "image/jpeg")


class FakeTranslator:
    def __init__(self, result="A cat on a roof", fail=False):
        self.result, self.fail, self.calls = result, fail, 0

    def to_english(self, text):
        self.calls += 1
        if self.fail:
            raise RuntimeError("boom")
        return self.result


def test_translates_non_ascii_prompt():
    inner, tr = Recorder(), FakeTranslator()
    TranslatingImageProvider(inner, tr).generate("кот на крыше")
    assert inner.prompts == ["A cat on a roof"]


def test_english_prompt_is_not_translated():
    inner, tr = Recorder(), FakeTranslator()
    TranslatingImageProvider(inner, tr).generate("a happy dog")
    assert tr.calls == 0
    assert inner.prompts == ["a happy dog"]


def test_translation_failure_falls_back_to_original():
    inner = Recorder()
    TranslatingImageProvider(inner, FakeTranslator(fail=True)).generate("кот на крыше")
    assert inner.prompts == ["кот на крыше"]


def test_unsafe_translation_is_blocked():
    inner = Recorder()
    provider = TranslatingImageProvider(inner, FakeTranslator("A gun on a table"))
    with pytest.raises(UnsafePrompt):
        provider.generate("что-то на столе")
    assert inner.prompts == []

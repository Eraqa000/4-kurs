import pytest

from app.core.moderation import check_output_text, check_prompt


@pytest.mark.parametrize(
    "prompt", ["кот на крыше", "Жасыл ағаш пен қызыл үй", "a happy dog", "қандай әдемі күн"]
)
def test_safe_prompts(prompt):
    assert check_prompt(prompt).ok


@pytest.mark.parametrize(
    ("prompt", "code"),
    [
        ("ab", "prompt_too_short"),
        ("а" * 201, "prompt_too_long"),
        ("нарисуй пистолет", "unsafe_prompt"),
        ("кровавая битва", "unsafe_prompt"),
        ("қан мен жарылыс", "unsafe_prompt"),
        ("мой телефон +7 701 123 45 67", "personal_data"),
        ("пиши на test@mail.ru", "personal_data"),
        ("зайди на https://example.com", "personal_data"),
    ],
)
def test_blocked_prompts(prompt, code):
    result = check_prompt(prompt)
    assert not result.ok
    assert result.code == code


def test_word_prefix_does_not_overblock():
    assert check_prompt("кровать в комнате").ok


def test_output_text_filter():
    assert check_output_text("Слева красный круг.")
    assert not check_output_text("Там лежит труп.")

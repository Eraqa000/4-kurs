"""Модерация детского контента: фильтр запросов и текстов, запрет персональных данных.

Это базовый фильтр по словам и шаблонам (kk/ru/en). Он не заменяет встроенную модерацию
провайдера изображений — реальный провайдер должен включать свою проверку безопасности.
"""

import re
from dataclasses import dataclass

# Начала слов (проверка по префиксу слова)
_UNSAFE_PREFIXES = (
    # насилие
    "убий",
    "убит",
    "убью",
    "кровав",
    "кровь",
    "насили",
    "оружи",
    "пистолет",
    "взрыв",
    "труп",
    "самоубий",
    "суицид",
    "пытк",
    "расчленен",
    "жесток",
    "өлтір",
    "қарулан",
    "зорлық",
    "жарылыс",
    # взрослый контент
    "порно",
    "секс",
    "голый",
    "голая",
    "голые",
    "обнажен",
    "эротик",
    "жалаңаш",
    # вещества
    "наркот",
    "героин",
    "кокаин",
    "марихуан",
    "алкогол",
    "водк",
    "сигарет",
    "нашақор",
    # ненависть
    "нацис",
    "террор",
    "фашис",
    # английский
    "kill",
    "blood",
    "gun",
    "weapon",
    "porn",
    "sex",
    "nude",
    "naked",
    "drug",
    "suicide",
    "terror",
)
# Короткие слова, которые нельзя искать по префиксу (иначе «қан» поймает «қандай»)
_UNSAFE_EXACT = {"қан", "қару", "nazi"}

_PII_PATTERNS = (
    re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),  # e-mail
    re.compile(r"(https?://|www\.)\S+", re.IGNORECASE),  # ссылки
    re.compile(r"\b\d{12}\b"),  # ИИН
    re.compile(r"\+?\d[\d\s\-()]{8,}\d"),  # телефон
)

MIN_PROMPT = 3
MAX_PROMPT = 200


@dataclass
class ModerationResult:
    ok: bool
    code: str = ""  # prompt_too_short | prompt_too_long | unsafe_prompt | personal_data


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().replace("ё", "е")).strip()


def contains_unsafe(text: str) -> bool:
    for word in re.findall(r"[\w]+", normalize(text)):
        if word in _UNSAFE_EXACT or word.startswith(_UNSAFE_PREFIXES):
            return True
    return False


def contains_personal_data(text: str) -> bool:
    return any(p.search(text) for p in _PII_PATTERNS)


def check_prompt(prompt: str) -> ModerationResult:
    text = normalize(prompt)
    if len(text) < MIN_PROMPT:
        return ModerationResult(False, "prompt_too_short")
    if len(text) > MAX_PROMPT:
        return ModerationResult(False, "prompt_too_long")
    if contains_personal_data(prompt):
        return ModerationResult(False, "personal_data")
    if contains_unsafe(prompt):
        return ModerationResult(False, "unsafe_prompt")
    return ModerationResult(True)


def check_output_text(text: str) -> bool:
    """Проверка текста, который вернула модель (описание), перед показом ребёнку."""
    return not contains_unsafe(text)

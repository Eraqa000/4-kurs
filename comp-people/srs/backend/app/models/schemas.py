from typing import Literal

from pydantic import BaseModel

Language = Literal["kk", "ru"]


class GenerateRequest(BaseModel):
    prompt: str
    language: Language = "kk"


class GenerateResponse(BaseModel):
    image_id: str
    image_url: str
    prompt: str
    cached: bool


class SaveMaterialRequest(BaseModel):
    image_id: str


class UpdateTextRequest(BaseModel):
    language: Language
    alt_text: str | None = None
    long_description: str | None = None


class MaterialText(BaseModel):
    alt_text: str
    long_description: str
    # True, пока текст создан ИИ; после правки человеком становится False
    ai_generated: bool


class MaterialOut(BaseModel):
    id: str
    prompt: str
    image_url: str
    created_at: str
    texts: dict[Language, MaterialText]


class DescribeRequest(BaseModel):
    image_id: str
    language: Language = "kk"


class DescribeResponse(BaseModel):
    image_id: str
    alt_text: str
    long_description: str
    language: Language
    ai_generated: bool = True
    cached: bool

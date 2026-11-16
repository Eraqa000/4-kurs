import io
import zipfile

import pytest

from app.core import state
from app.main import app
from app.providers.base import TTSProvider
from app.providers.registry import get_tts_provider

OWNER = "device-0123456789abcdef"
OTHER = "device-fedcba9876543210"


def h(owner=OWNER):
    return {"X-Owner-Id": owner}


def create(client, prompt="кот на крыше"):
    image_id = client.post("/api/generate", json={"prompt": prompt, "language": "ru"}).json()[
        "image_id"
    ]
    client.post("/api/describe", json={"image_id": image_id, "language": "ru"})
    return image_id


def save(client, image_id, owner=OWNER):
    return client.post("/api/materials", json={"image_id": image_id}, headers=h(owner))


def test_save_list_get(client):
    image_id = create(client)
    r = save(client, image_id)
    assert r.status_code == 201
    m = r.json()
    assert m["prompt"] == "кот на крыше"
    assert set(m["texts"]) == {"kk", "ru"}
    assert m["texts"]["ru"]["ai_generated"] is True

    lst = client.get("/api/materials", headers=h()).json()
    assert [x["id"] for x in lst] == [m["id"]]
    assert client.get(f"/api/materials/{m['id']}", headers=h()).json()["id"] == m["id"]
    img = client.get(m["image_url"])
    assert img.status_code == 200
    assert img.headers["content-type"].startswith("image/svg+xml")


def test_save_is_idempotent(client):
    image_id = create(client)
    first = save(client, image_id)
    second = save(client, image_id)
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert len(client.get("/api/materials", headers=h()).json()) == 1


def test_save_requires_owner_and_description(client):
    image_id = create(client)
    assert client.post("/api/materials", json={"image_id": image_id}).status_code == 401
    bad = client.post("/api/materials", json={"image_id": image_id}, headers={"X-Owner-Id": "x"})
    assert bad.status_code == 401
    # картинка без описания
    only_image = client.post("/api/generate", json={"prompt": "дом", "language": "ru"}).json()
    r = save(client, only_image["image_id"])
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "describe_first"
    assert save(client, "nope").status_code == 404


def test_owners_are_isolated(client):
    m = save(client, create(client)).json()
    assert client.get("/api/materials", headers=h(OTHER)).json() == []
    assert client.get(f"/api/materials/{m['id']}", headers=h(OTHER)).status_code == 404
    patch = client.patch(
        f"/api/materials/{m['id']}",
        json={"language": "ru", "alt_text": "Чужое"},
        headers=h(OTHER),
    )
    assert patch.status_code == 404
    assert client.delete(f"/api/materials/{m['id']}", headers=h(OTHER)).status_code == 404
    assert client.get("/api/materials", headers=h()).json()[0]["id"] == m["id"]


def test_edit_text_marks_it_as_human_edited(client):
    m = save(client, create(client)).json()
    r = client.patch(
        f"/api/materials/{m['id']}",
        json={"language": "ru", "alt_text": "Кот сидит на красной крыше."},
        headers=h(),
    )
    assert r.status_code == 200
    ru = r.json()["texts"]["ru"]
    assert ru["alt_text"] == "Кот сидит на красной крыше."
    assert ru["long_description"] == m["texts"]["ru"]["long_description"]
    assert ru["ai_generated"] is False
    assert r.json()["texts"]["kk"]["ai_generated"] is True


@pytest.mark.parametrize(
    ("payload", "code"),
    [
        ({"alt_text": "   "}, "invalid_text"),
        ({"alt_text": "а" * 1501}, "text_too_long"),
        ({"alt_text": "Там лежит труп"}, "invalid_text"),
        ({"long_description": "звони +7 701 123 45 67"}, "invalid_text"),
    ],
)
def test_edit_validation(client, payload, code):
    m = save(client, create(client)).json()
    r = client.patch(f"/api/materials/{m['id']}", json={"language": "ru", **payload}, headers=h())
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == code


def test_delete(client):
    m = save(client, create(client)).json()
    assert client.delete(f"/api/materials/{m['id']}", headers=h()).status_code == 204
    assert client.get("/api/materials", headers=h()).json() == []
    assert client.get(m["image_url"]).status_code == 404


def test_audio_download_and_cache(client):
    m = save(client, create(client)).json()
    r = client.get(f"/api/materials/{m['id']}/audio?language=ru")
    assert r.status_code == 200
    assert r.headers["content-type"] in ("audio/wav", "audio/mpeg")
    assert "attachment" in r.headers["content-disposition"]
    assert len(r.content) > 100
    # повторный запрос берётся из кэша и не тратит лимит
    state.tts_limiter.limit = 1
    assert client.get(f"/api/materials/{m['id']}/audio?language=ru").status_code == 200


def test_export_zip_has_image_text_and_audio(client):
    m = save(client, create(client)).json()
    r = client.get(f"/api/materials/{m['id']}/export?language=kk")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
        names = set(zf.namelist())
        assert "image.svg" in names
        assert "description.txt" in names
        assert names & {"description.mp3", "description.wav"}
        text = zf.read("description.txt").decode()
    assert "кот на крыше" in text
    assert m["texts"]["kk"]["long_description"] in text
    assert "жасанды интеллект" in text


def test_export_marks_human_edit(client):
    m = save(client, create(client)).json()
    client.patch(
        f"/api/materials/{m['id']}",
        json={"language": "ru", "alt_text": "Кот на крыше."},
        headers=h(),
    )
    r = client.get(f"/api/materials/{m['id']}/export?language=ru")
    with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
        text = zf.read("description.txt").decode()
    assert "отредактировано человеком" in text
    assert "Кот на крыше." in text


def test_tts_rate_limit_and_failure(client):
    m = save(client, create(client)).json()
    state.tts_limiter.limit = 1
    assert client.get(f"/api/materials/{m['id']}/audio?language=ru").status_code == 200
    r = client.get(f"/api/materials/{m['id']}/audio?language=kk")
    assert r.status_code == 429

    state.reset_state()

    class Broken(TTSProvider):
        def synthesize(self, text, language):
            raise RuntimeError("boom")

    app.dependency_overrides[get_tts_provider] = Broken
    try:
        # состояние сброшено, поэтому картинку и описание создаём заново и сохраняем
        m2 = save(client, create(client, "дом и дерево")).json()
        r = client.get(f"/api/materials/{m2['id']}/audio?language=ru")
        assert r.status_code == 502
        assert r.json()["detail"]["code"] == "tts_failed"
    finally:
        app.dependency_overrides.clear()


def test_unknown_material(client):
    assert client.get("/api/materials/nope/image").status_code == 404
    assert client.get("/api/materials/nope/audio?language=ru").status_code == 404
    assert client.get("/api/materials/nope/export?language=ru").status_code == 404

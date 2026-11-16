from app.core import state


def gen(client, prompt="кот на крыше", language="ru"):
    return client.post("/api/generate", json={"prompt": prompt, "language": language})


def test_generate_and_fetch_image(client):
    r = gen(client)
    assert r.status_code == 200
    body = r.json()
    assert body["cached"] is False
    img = client.get(body["image_url"])
    assert img.status_code == 200
    assert img.headers["content-type"].startswith("image/svg+xml")
    assert "default-src 'none'" in img.headers["content-security-policy"]


def test_generate_is_cached_and_does_not_spend_rate_limit(client):
    first = gen(client).json()
    state.generate_limiter.limit = 1
    second = gen(client).json()  # из кэша — лимит не тратится
    assert second["cached"] is True
    assert second["image_id"] == first["image_id"]


def test_generate_blocks_unsafe_prompt_in_both_languages(client):
    r = gen(client, "нарисуй пистолет", "ru")
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "unsafe_prompt"
    r = gen(client, "пистолет салу", "kk")
    assert "салуға болмайды" in r.json()["detail"]["message"]


def test_generate_rate_limit(client):
    state.generate_limiter.limit = 2
    assert gen(client, "первый рисунок").status_code == 200
    assert gen(client, "второй рисунок").status_code == 200
    r = gen(client, "третий рисунок")
    assert r.status_code == 429
    assert int(r.headers["retry-after"]) >= 1


def test_describe_two_levels_ru_and_kk(client):
    image_id = gen(client).json()["image_id"]
    r = client.post("/api/describe", json={"image_id": image_id, "language": "ru"})
    assert r.status_code == 200
    d = r.json()
    assert d["ai_generated"] is True
    assert "кот на крыше" in d["alt_text"]
    assert all(w in d["long_description"] for w in ("Слева", "В центре", "Справа"))

    kk = client.post("/api/describe", json={"image_id": image_id, "language": "kk"}).json()
    assert "Сол жақта" in kk["long_description"]
    assert kk["cached"] is True  # оба языка получены одним проходом по картинке
    again = client.post("/api/describe", json={"image_id": image_id, "language": "kk"}).json()
    assert again["cached"] is True


def test_describe_unknown_image(client):
    r = client.post("/api/describe", json={"image_id": "nope", "language": "ru"})
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "image_not_found"


def test_describe_rejects_unsafe_model_output(client):
    from app.main import app
    from app.providers.base import Description, DescriptionProvider
    from app.providers.registry import get_description_provider

    class Bad(DescriptionProvider):
        def describe(self, image):
            bad = Description("Картинка", "На картинке труп.")
            return {"ru": bad, "kk": bad}

    app.dependency_overrides[get_description_provider] = Bad
    try:
        image_id = gen(client).json()["image_id"]
        r = client.post("/api/describe", json={"image_id": image_id, "language": "ru"})
        assert r.status_code == 502
    finally:
        app.dependency_overrides.clear()


def test_unsafe_prompt_found_after_translation_returns_422(client):
    from app.main import app
    from app.providers.base import ImageProvider, UnsafePrompt
    from app.providers.registry import get_image_provider

    class Blocked(ImageProvider):
        def generate(self, prompt):
            raise UnsafePrompt

    app.dependency_overrides[get_image_provider] = Blocked
    try:
        r = gen(client)
        assert r.status_code == 422
        assert r.json()["detail"]["code"] == "unsafe_prompt"
    finally:
        app.dependency_overrides.clear()


def test_two_languages_cost_one_describe_request(client):
    state.describe_limiter.limit = 1
    image_id = gen(client).json()["image_id"]
    for lang in ("ru", "kk"):
        r = client.post("/api/describe", json={"image_id": image_id, "language": lang})
        assert r.status_code == 200


def test_provider_failure_is_logged_with_reason(client, caplog):
    import logging

    from app.main import app
    from app.providers.base import ImageProvider
    from app.providers.registry import get_image_provider

    class Failing(ImageProvider):
        def generate(self, prompt):
            raise RuntimeError("Cloudflare HTTP 429: neurons limit")

    app.dependency_overrides[get_image_provider] = Failing
    try:
        with caplog.at_level(logging.WARNING, logger="audiocanvas"):
            r = gen(client)
        assert r.status_code == 502
        assert "neurons limit" in caplog.text
    finally:
        app.dependency_overrides.clear()

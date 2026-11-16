OWNER = {"X-Owner-Id": "device-0123456789abcdef"}
OTHER = {"X-Owner-Id": "device-fedcba9876543210"}


def test_progress_roundtrip(client):
    assert client.get("/api/progress", headers=OWNER).json() == {}
    r = client.put("/api/progress/left-right", json={"status": "in_progress"}, headers=OWNER)
    assert r.json() == {"status": "in_progress"}
    client.put("/api/progress/what-is", json={"status": "done"}, headers=OWNER)
    assert client.get("/api/progress", headers=OWNER).json() == {
        "left-right": "in_progress",
        "what-is": "done",
    }


def test_done_is_never_downgraded(client):
    client.put("/api/progress/what-is", json={"status": "done"}, headers=OWNER)
    r = client.put("/api/progress/what-is", json={"status": "in_progress"}, headers=OWNER)
    assert r.json() == {"status": "done"}
    assert client.get("/api/progress", headers=OWNER).json()["what-is"] == "done"


def test_progress_is_per_owner(client):
    client.put("/api/progress/what-is", json={"status": "done"}, headers=OWNER)
    assert client.get("/api/progress", headers=OTHER).json() == {}


def test_progress_validation(client):
    assert client.get("/api/progress").status_code == 401
    assert client.put("/api/progress/what-is", json={"status": "done"}).status_code == 401
    bad = client.put("/api/progress/what-is", json={"status": "winner"}, headers=OWNER)
    assert bad.status_code == 422
    bad_id = client.put("/api/progress/Bad_ID!", json={"status": "done"}, headers=OWNER)
    assert bad_id.status_code in (404, 422)

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from tests.helpers import _create_book, _create_engagement


def _finish_engagement(client: TestClient, book_id: str) -> dict[str, Any]:
    engagement = _create_engagement(client, book_id)
    client.patch(f"/engagements/{engagement['id']}", json={"status": "finished"})
    return engagement


def _dnf_engagement(client: TestClient, book_id: str) -> dict[str, Any]:
    engagement = _create_engagement(client, book_id)
    client.patch(f"/engagements/{engagement['id']}", json={"status": "dnf"})
    return engagement


def test_upsert_review_creates_review_on_finished_engagement(
    client: TestClient,
) -> None:
    book = _create_book(client)
    engagement = _finish_engagement(client, book["id"])

    response = client.put(
        f"/engagements/{engagement['id']}/review",
        json={"rating": 4.0},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["review"]["rating"] == "4.00"
    assert data["review"]["body"] is None


def test_upsert_review_creates_review_on_dnf_engagement(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _dnf_engagement(client, book["id"])

    response = client.put(
        f"/engagements/{engagement['id']}/review",
        json={"rating": 2.5},
    )
    assert response.status_code == 200
    assert response.json()["review"]["rating"] == "2.50"


def test_upsert_review_with_body(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _finish_engagement(client, book["id"])

    response = client.put(
        f"/engagements/{engagement['id']}/review",
        json={"rating": 3.75, "body": "Loved it."},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["review"]["rating"] == "3.75"
    assert data["review"]["body"] == "Loved it."


def test_upsert_review_updates_existing_review(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _finish_engagement(client, book["id"])
    client.put(
        f"/engagements/{engagement['id']}/review",
        json={"rating": 3.0, "body": "OK."},
    )

    response = client.put(
        f"/engagements/{engagement['id']}/review",
        json={"rating": 4.25, "body": "Actually great."},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["review"]["rating"] == "4.25"
    assert data["review"]["body"] == "Actually great."


def test_upsert_review_rating_too_low_returns_422(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _finish_engagement(client, book["id"])

    response = client.put(
        f"/engagements/{engagement['id']}/review",
        json={"rating": 0.75},
    )
    assert response.status_code == 422


def test_upsert_review_rating_too_high_returns_422(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _finish_engagement(client, book["id"])

    response = client.put(
        f"/engagements/{engagement['id']}/review",
        json={"rating": 5.25},
    )
    assert response.status_code == 422


def test_upsert_review_non_quarter_step_returns_422(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _finish_engagement(client, book["id"])

    response = client.put(
        f"/engagements/{engagement['id']}/review",
        json={"rating": 3.3},
    )
    assert response.status_code == 422


def test_upsert_review_on_reading_engagement_returns_409(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _create_engagement(client, book["id"])

    response = client.put(
        f"/engagements/{engagement['id']}/review",
        json={"rating": 4.0},
    )
    assert response.status_code == 409


def test_upsert_review_boundary_ratings_accepted(client: TestClient) -> None:
    book_a = _create_book(client, title="Book A", author="Author A")
    book_b = _create_book(client, title="Book B", author="Author B")
    eng_a = _finish_engagement(client, book_a["id"])
    eng_b = _finish_engagement(client, book_b["id"])

    assert (
        client.put(
            f"/engagements/{eng_a['id']}/review", json={"rating": 1.0}
        ).status_code
        == 200
    )
    assert (
        client.put(
            f"/engagements/{eng_b['id']}/review", json={"rating": 5.0}
        ).status_code
        == 200
    )


def test_engagement_review_is_null_before_rating(client: TestClient) -> None:
    book = _create_book(client)
    engagement = _finish_engagement(client, book["id"])

    data = client.get("/engagements?status=finished").json()
    assert data[0]["id"] == engagement["id"]
    assert data[0]["review"] is None

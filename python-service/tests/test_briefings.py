from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Briefing, BriefingMetric, BriefingPoint, BriefingRisk  # noqa: F401


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def _sample_payload() -> dict:
    return {
        "companyName": "Acme Holdings",
        "ticker": "acme",
        "sector": "Industrial Technology",
        "analystName": "Jane Doe",
        "summary": "Summary text",
        "recommendation": "Recommendation text",
        "keyPoints": [
            "Point one",
            "Point two",
        ],
        "risks": [
            "Risk one",
        ],
        "metrics": [
            {"name": "Revenue Growth", "value": "18%"},
            {"name": "Operating Margin", "value": "22.4%"},
        ],
    }


def test_create_and_get_briefing(client: TestClient) -> None:
    create_response = client.post("/briefings", json=_sample_payload())
    assert create_response.status_code == 201

    created = create_response.json()
    assert created["ticker"] == "ACME"
    assert len(created["keyPoints"]) == 2
    assert len(created["risks"]) == 1
    assert len(created["metrics"]) == 2

    briefing_id = created["id"]

    get_response = client.get(f"/briefings/{briefing_id}")
    assert get_response.status_code == 200
    retrieved = get_response.json()
    assert retrieved["id"] == briefing_id
    assert retrieved["companyName"] == "Acme Holdings"


def test_generate_and_fetch_html(client: TestClient) -> None:
    create_response = client.post("/briefings", json=_sample_payload())
    assert create_response.status_code == 201
    briefing_id = create_response.json()["id"]

    generate_response = client.post(f"/briefings/{briefing_id}/generate")
    assert generate_response.status_code == 200
    generated = generate_response.json()
    assert generated["generatedAt"] is not None

    html_response = client.get(f"/briefings/{briefing_id}/html")
    assert html_response.status_code == 200
    assert html_response.headers["content-type"].startswith("text/html")
    body = html_response.text
    assert "Acme Holdings" in body
    assert "Revenue Growth" in body


def test_validation_rejects_duplicate_metric_names(client: TestClient) -> None:
    payload = _sample_payload()
    payload["metrics"] = [
        {"name": "Revenue Growth", "value": "18%"},
        {"name": "Revenue Growth", "value": "20%"},
    ]

    response = client.post("/briefings", json=payload)
    assert response.status_code == 422


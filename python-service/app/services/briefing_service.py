from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.briefing import Briefing, BriefingMetric, BriefingPoint, BriefingRisk
from app.schemas.briefing import BriefingCreate, BriefingRead, BriefingMetricRead
from app.services.report_formatter import ReportFormatter


def create_briefing(db: Session, payload: BriefingCreate) -> Briefing:
    briefing = Briefing(
        company_name=payload.companyName.strip(),
        ticker=payload.ticker,
        sector=payload.sector.strip() if payload.sector is not None else None,
        analyst_name=payload.analystName.strip() if payload.analystName is not None else None,
        summary=payload.summary.strip(),
        recommendation=payload.recommendation.strip(),
    )
    db.add(briefing)
    db.flush()

    for idx, point in enumerate(payload.keyPoints, start=1):
        db.add(BriefingPoint(briefing_id=briefing.id, content=point.strip(), position=idx))

    for idx, risk in enumerate(payload.risks, start=1):
        db.add(BriefingRisk(briefing_id=briefing.id, content=risk.strip(), position=idx))

    if payload.metrics:
        for idx, metric in enumerate(payload.metrics, start=1):
            db.add(
                BriefingMetric(
                    briefing_id=briefing.id,
                    name=metric.name.strip(),
                    value=metric.value.strip(),
                    position=idx,
                )
            )

    db.commit()
    db.refresh(briefing)
    return briefing


def get_briefing(db: Session, briefing_id: int) -> Briefing | None:
    query = (
        select(Briefing)
        .where(Briefing.id == briefing_id)
        .options(
            selectinload(Briefing.points),
            selectinload(Briefing.risks),
            selectinload(Briefing.metrics),
        )
    )
    result = db.scalars(query).first()
    return result


def to_read_model(briefing: Briefing) -> BriefingRead:
    key_points = [p.content for p in sorted(briefing.points, key=lambda p: p.position)]
    risks = [r.content for r in sorted(briefing.risks, key=lambda r: r.position)]
    metrics = [
        BriefingMetricRead(name=m.name, value=m.value)
        for m in sorted(briefing.metrics, key=lambda m: m.position)
    ]

    return BriefingRead(
        id=briefing.id,
        companyName=briefing.company_name,
        ticker=briefing.ticker,
        sector=briefing.sector,
        analystName=briefing.analyst_name,
        summary=briefing.summary,
        recommendation=briefing.recommendation,
        keyPoints=key_points,
        risks=risks,
        metrics=metrics,
        generatedAt=briefing.generated_at,
        createdAt=briefing.created_at,
    )


def _build_report_view_model(briefing: Briefing) -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc)
    title = f"Briefing Report — {briefing.company_name} ({briefing.ticker})"
    metrics = sorted(briefing.metrics, key=lambda m: m.position)

    return {
        "title": title,
        "company_name": briefing.company_name,
        "ticker": briefing.ticker,
        "sector": briefing.sector,
        "analyst_name": briefing.analyst_name,
        "summary": briefing.summary,
        "recommendation": briefing.recommendation,
        "key_points": sorted(briefing.points, key=lambda p: p.position),
        "risks": sorted(briefing.risks, key=lambda r: r.position),
        "metrics": metrics,
        "has_metrics": len(metrics) > 0,
        "generated_timestamp": generated_at.isoformat(),
    }


def generate_briefing_html(db: Session, briefing: Briefing) -> Briefing:
    formatter = ReportFormatter()
    view_model = _build_report_view_model(briefing)
    body_html = formatter._env.get_template("briefing_report.html").render(**view_model)
    full_html = formatter.render_base(view_model["title"], body_html)

    briefing.generated_html = full_html
    briefing.generated_at = datetime.fromisoformat(view_model["generated_timestamp"])

    db.add(briefing)
    db.commit()
    db.refresh(briefing)
    return briefing


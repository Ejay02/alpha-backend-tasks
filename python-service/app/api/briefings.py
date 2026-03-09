from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.briefing import BriefingCreate, BriefingRead
from app.services.briefing_service import create_briefing, generate_briefing_html, get_briefing, to_read_model


router = APIRouter(prefix="/briefings", tags=["briefings"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_briefing_endpoint(
    payload: BriefingCreate, db: Annotated[Session, Depends(get_db)]
) -> BriefingRead:
    briefing = create_briefing(db, payload)
    return to_read_model(briefing)


@router.get("/{briefing_id}")
def get_briefing_endpoint(
    briefing_id: int, db: Annotated[Session, Depends(get_db)]
) -> BriefingRead:
    briefing = get_briefing(db, briefing_id)
    if briefing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Briefing not found")
    return to_read_model(briefing)


@router.post("/{briefing_id}/generate")
def generate_report_endpoint(
    briefing_id: int, db: Annotated[Session, Depends(get_db)]
) -> BriefingRead:
    briefing = get_briefing(db, briefing_id)
    if briefing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Briefing not found")

    briefing = generate_briefing_html(db, briefing)
    return to_read_model(briefing)


@router.get("/{briefing_id}/html")
def get_briefing_html_endpoint(
    briefing_id: int, db: Annotated[Session, Depends(get_db)]
) -> Response:
    briefing = get_briefing(db, briefing_id)
    if briefing is None or briefing.generated_html is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Briefing HTML not found")

    return Response(content=briefing.generated_html, media_type="text/html")


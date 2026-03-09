from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


_ONDELETE_CASCADE_TARGET = "briefings.id"
_RELATIONSHIP_CASCADE = "all, delete-orphan"


class Briefing(Base):
    __tablename__ = "briefings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    analyst_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)

    generated_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    points: Mapped[list["BriefingPoint"]] = relationship(
        back_populates="briefing", cascade=_RELATIONSHIP_CASCADE, order_by="BriefingPoint.position"
    )
    risks: Mapped[list["BriefingRisk"]] = relationship(
        back_populates="briefing", cascade=_RELATIONSHIP_CASCADE, order_by="BriefingRisk.position"
    )
    metrics: Mapped[list["BriefingMetric"]] = relationship(
        back_populates="briefing", cascade=_RELATIONSHIP_CASCADE, order_by="BriefingMetric.position"
    )


class BriefingPoint(Base):
    __tablename__ = "briefing_points"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    briefing_id: Mapped[int] = mapped_column(ForeignKey(_ONDELETE_CASCADE_TARGET, ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    briefing: Mapped[Briefing] = relationship(back_populates="points")


class BriefingRisk(Base):
    __tablename__ = "briefing_risks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    briefing_id: Mapped[int] = mapped_column(ForeignKey(_ONDELETE_CASCADE_TARGET, ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    briefing: Mapped[Briefing] = relationship(back_populates="risks")


class BriefingMetric(Base):
    __tablename__ = "briefing_metrics"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    briefing_id: Mapped[int] = mapped_column(ForeignKey(_ONDELETE_CASCADE_TARGET, ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    value: Mapped[str] = mapped_column(String(120), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    briefing: Mapped[Briefing] = relationship(back_populates="metrics")


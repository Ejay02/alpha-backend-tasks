from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BriefingMetricInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=120)


class BriefingCreate(BaseModel):
    companyName: str = Field(min_length=1, max_length=255)
    ticker: str = Field(min_length=1, max_length=20)
    sector: str | None = Field(default=None, max_length=120)
    analystName: str | None = Field(default=None, max_length=120)
    summary: str = Field(min_length=1)
    recommendation: str = Field(min_length=1)
    keyPoints: list[str] = Field(min_length=2)
    risks: list[str] = Field(min_length=1)
    metrics: list[BriefingMetricInput] | None = None

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        return v.upper()

    @model_validator(mode="after")
    def ensure_metric_names_unique(self) -> "BriefingCreate":
        if self.metrics:
            names = [m.name for m in self.metrics]
            if len(set(names)) != len(names):
                raise ValueError("Metric names must be unique within a briefing")
        return self


class BriefingMetricRead(BaseModel):
    name: str
    value: str


class BriefingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    companyName: str
    ticker: str
    sector: str | None = None
    analystName: str | None = None
    summary: str
    recommendation: str
    keyPoints: list[str]
    risks: list[str]
    metrics: list[BriefingMetricRead]
    generatedAt: datetime | None = None
    createdAt: datetime


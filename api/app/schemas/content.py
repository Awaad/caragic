from datetime import datetime
from typing import Any
from pydantic import BaseModel


class ChoiceOption(BaseModel):
    id: str
    label: str
    revealText: str


class ChoiceRoundData(BaseModel):
    question: str
    options: list[ChoiceOption]


class CaptureRoundData(BaseModel):
    prompt: str
    acceptLabel: str
    declineLabel: str
    declineMessage: str


class RoundOut(BaseModel):
    id: str             # the slug, not the UUID — frontend keys on this
    type: str           # 'choice' | 'capture'
    data: dict[str, Any]  # shape varies; frontend already discriminates on type


class RevealOut(BaseModel):
    name: str
    tagline: str
    links: list[Any]


class ModeContentOut(BaseModel):
    mode: str
    rounds: list[RoundOut]
    reveal: RevealOut
    updated_at: datetime
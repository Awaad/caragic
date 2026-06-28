from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class VisitorSessionResponse(BaseModel):
    visitor_id: UUID
    issued_at: datetime
    expires_at: datetime
    rotated: bool = False
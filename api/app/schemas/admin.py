from pydantic import BaseModel, Field


# Existing schemas (login, me, etc.) stay as they are.
# Adding below:


class CreateTokenRequest(BaseModel):
    mode: str = Field(pattern="^(dating|mix|friendship|professional)$")
    label: str | None = Field(default=None, max_length=255)


class CreateTokenResponse(BaseModel):
    id: str           # token row id (UUID as string)
    token: str        # the raw token — only returned once, here, never again
    url: str          # full shareable URL
    mode: str
    label: str | None
    kind: str         # always 'link' from this endpoint


class SetActiveModeRequest(BaseModel):
    mode: str = Field(pattern="^(dating|mix|friendship|professional)$")


class ActiveModeResponse(BaseModel):
    mode: str
from pydantic import BaseModel, Field


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=1024)
    totp_code: str = Field(min_length=6, max_length=8)


class AdminLoginResponse(BaseModel):
    ok: bool
    expires_at: str  # ISO8601


class AdminMeResponse(BaseModel):
    username: str
    scope: str
    expires_at: str
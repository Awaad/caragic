from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    secret_key: str
    master_encryption_key: str  # base64-encoded 32 bytes
    admin_username: str
    admin_password_hash: str
    admin_totp_secret: str
    cors_origins: str  # comma-separated

    # Session tokens
    visitor_session_ttl_days: int = 90
    visitor_session_rotate_after_days: int = 7
    visitor_session_grace_hours: int = 24

    # Owner JWT
    owner_jwt_ttl_minutes: int = 60

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
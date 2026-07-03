from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    secret_key: str
    master_encryption_key: str  # base64-encoded 32 bytes
    phone_hash_key: str         # base64-encoded 32 bytes — HMAC-SHA256 key for phone fingerprinting
    admin_username: str
    admin_password_hash: str
    admin_totp_secret: str
    cors_origins: str

    # Session tokens
    visitor_session_ttl_days: int = 90
    visitor_session_rotate_after_days: int = 7
    visitor_session_grace_hours: int = 24

    # Owner JWT
    owner_jwt_ttl_minutes: int = 60
    owner_jwt_algorithm: str = "HS256"
    admin_cookie_name: str = "admin_session"
    # In dev: COOKIE_SECURE=false in .env so cookie works over http://localhost.
    # In prod (HTTPS via Cloudflare Tunnel): leave true.
    cookie_secure: bool = True
    
    # Used to construct shareable token URLs in the admin response.
    # Set per environment: http://localhost:8000 locally, https://card-dev.gedoawad.com in dev VPS.
    public_base_url: str = "http://localhost:8000"
    
    # for behavior differences that matter (use explicit flags for those)
    environment: str = "dev"
    
    # Dev default matches the compose port mapping.
    admin_public_base_url: str = "http://localhost:5175"
    
    # Default region for E.164 phone parsing. Visitors are mostly in North Cyprus
    # which uses Turkish numbering (+90). Frontend picker can override per submission.
    default_phone_region: str = "TR"
    
    redis_url: str = "redis://localhost:6379/0"
    
    # Trusted proxy IPs — comma-separated. Dev default: none (use direct client IP).
    # Prod: set to the tunnel's IP range or "*" for full trust.
    trusted_proxy_ips: str = ""

    # Rate limits — all "count per window_seconds". Env-tunable so we can loosen
    # for events or crank down under attack without a redeploy.
    ratelimit_tap_ip_max: int = 5
    ratelimit_tap_ip_window: int = 300  # 5 min

    ratelimit_link_ip_max: int = 5
    ratelimit_link_ip_window: int = 300

    ratelimit_submission_session_max: int = 10
    ratelimit_submission_session_window: int = 86400  # 24 h

    ratelimit_submission_ip_max: int = 30
    ratelimit_submission_ip_window: int = 3600  # 1 h

    ratelimit_erase_session_max: int = 3
    ratelimit_erase_session_window: int = 86400

    ratelimit_admin_login_ip_max: int = 10
    ratelimit_admin_login_ip_window: int = 900  # 15 min

    ratelimit_admin_general_ip_max: int = 300
    ratelimit_admin_general_ip_window: int = 60  # 1 min

    @property
    def trusted_proxy_ip_list(self) -> list[str]:
        return [ip.strip() for ip in self.trusted_proxy_ips.split(",") if ip.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
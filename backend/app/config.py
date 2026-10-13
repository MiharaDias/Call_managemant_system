from pathlib import Path
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    database_url: str = f"sqlite:///{(BASE_DIR / 'data' / 'app.db').as_posix()}"
    secret_key: str = "dev-only-change-me"
    session_days: int = 14
    cookie_secure: bool = False  # set COOKIE_SECURE=true when served over HTTPS
    timezone: str = "Asia/Colombo"
    frontend_dist: Path = BASE_DIR.parent / "frontend" / "dist"

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)


settings = Settings()

"""Print an otpauth:// URI and ASCII QR for the configured TOTP secret.

Run from inside the api container:
    docker compose exec api uv run python scripts/totp_register.py
"""
from __future__ import annotations

import sys

import pyotp
import qrcode

from app.config import get_settings


def main() -> int:
    settings = get_settings()
    secret = settings.admin_totp_secret
    issuer = "card-dev"
    account = settings.admin_username

    uri = pyotp.TOTP(secret).provisioning_uri(name=account, issuer_name=issuer)

    print()
    print("otpauth URI (paste into Authenticator manual entry if QR doesn't scan):")
    print(uri)
    print()

    qr = qrcode.QRCode(border=1)
    qr.add_data(uri)
    qr.make(fit=True)
    qr.print_ascii(invert=True)

    print(f"\nCurrent code (sanity check vs. your phone): {pyotp.TOTP(secret).now()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
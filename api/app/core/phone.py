"""Phone number parsing and canonicalization.

Wraps google's libphonenumber (the `phonenumbers` Python port) to give us a
single chokepoint: raw user input goes in, canonical E.164 comes out, or a
clean ValueError that the endpoint can map to a 422.

Why E.164 specifically: it's the only format that round-trips cleanly to
WhatsApp / dialer / SMS gateways. The owner pastes "+905334...", everything
works. Anything else (national format, pretty-printed) loses information.
"""

from __future__ import annotations

import phonenumbers
from phonenumbers import NumberParseException

from ..config import get_settings


_settings = get_settings()


class PhoneValidationError(ValueError):
    """Raised when input cannot be parsed or isn't a valid phone number."""


def parse_and_normalize(raw: str, region: str | None = None) -> str:
    """Parse a raw phone string into canonical E.164 (e.g. '+905331234567').

    `region` is the ISO 3166-1 alpha-2 default region used when the input
    lacks a country code. If omitted, falls back to `settings.default_phone_region`.

    Frontend ideally sends already-E.164 strings (the picker handles country
    selection), but the server validates and re-canonicalizes either way —
    never trust client formatting."""
    if not isinstance(raw, str):
        raise PhoneValidationError("phone must be a string")
    raw = raw.strip()
    if not raw:
        raise PhoneValidationError("phone is required")

    default_region = region or _settings.default_phone_region

    try:
        parsed = phonenumbers.parse(raw, default_region)
    except NumberParseException as e:
        raise PhoneValidationError(f"could not parse phone: {e}") from e

    if not phonenumbers.is_possible_number(parsed):
        raise PhoneValidationError("phone is not a possible number")
    if not phonenumbers.is_valid_number(parsed):
        raise PhoneValidationError("phone is not a valid number")

    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
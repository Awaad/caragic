"""Field-level encryption + deterministic hashing helpers.

Two distinct concerns lumped together here:

1. AES-GCM field encryption** for sensitive PII at rest (visitor name, phone).
   Random 12-byte nonce per call, layout is `nonce || ciphertext_with_tag`.
   Non-deterministic — same plaintext yields different ciphertext each call.
   This is what we want for encryption; it leaks no information about repeats.

2. HMAC-SHA256 fingerprinting** of canonical E.164 phone numbers, for
   "has this number submitted before?" lookups in the admin inbox. Deterministic
   by design. Uses a separate key from the AES-GCM master key so the two
   lifecycles don't entangle.

Both keys live in env vars (`master_encryption_key`, `phone_hash_key`), are
base64-encoded 32-byte blobs, and are decoded exactly once at module import.
"""

from __future__ import annotations

import base64
import hmac
import hashlib
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from ..config import get_settings


_NONCE_LEN = 12  # AES-GCM standard


def _decode_key(b64: str, field_name: str) -> bytes:
    try:
        raw = base64.b64decode(b64, validate=True)
    except Exception as e:
        raise RuntimeError(
            f"{field_name} must be valid base64 ({e.__class__.__name__})"
        ) from e
    if len(raw) != 32:
        raise RuntimeError(
            f"{field_name} must decode to exactly 32 bytes, got {len(raw)}"
        )
    return raw


# Decoded once at import. Reload requires restart, which is correct 
# key rotation should be an explicit operation, not a silent re-read.
_settings = get_settings()
_AES_KEY = _decode_key(_settings.master_encryption_key, "master_encryption_key")
_HMAC_KEY = _decode_key(_settings.phone_hash_key, "phone_hash_key")

_aesgcm = AESGCM(_AES_KEY)


def encrypt_field(plaintext: str) -> bytes:
    """Encrypt a string field with AES-GCM. Output layout: nonce || ciphertext+tag.

    Non-deterministic; safe to call repeatedly on the same plaintext."""
    if not isinstance(plaintext, str):
        raise TypeError(f"encrypt_field expected str, got {type(plaintext).__name__}")
    nonce = secrets.token_bytes(_NONCE_LEN)
    ct = _aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data=None)
    return nonce + ct


def decrypt_field(blob: bytes) -> str:
    """Decrypt a blob produced by encrypt_field. Raises on tamper / wrong key."""
    if not isinstance(blob, (bytes, bytearray, memoryview)):
        raise TypeError(f"decrypt_field expected bytes, got {type(blob).__name__}")
    blob = bytes(blob)
    if len(blob) < _NONCE_LEN + 16:  # 16-byte GCM tag minimum
        raise ValueError("ciphertext too short to be valid AES-GCM output")
    nonce, ct = blob[:_NONCE_LEN], blob[_NONCE_LEN:]
    return _aesgcm.decrypt(nonce, ct, associated_data=None).decode("utf-8")


def hash_phone(e164: str) -> str:
    """Deterministic HMAC-SHA256 of a canonical E.164 number, hex-encoded.

    Input MUST already be normalized to E.164. pass the output of
    `phone.parse_and_normalize`, never raw user input. Two calls with the
    same E.164 string yield the same hash; different keys yield different
    hashes (so rotating the HMAC key invalidates all stored fingerprints)."""
    if not isinstance(e164, str) or not e164.startswith("+"):
        raise ValueError("hash_phone requires canonical E.164 input starting with '+'")
    return hmac.new(_HMAC_KEY, e164.encode("utf-8"), hashlib.sha256).hexdigest()
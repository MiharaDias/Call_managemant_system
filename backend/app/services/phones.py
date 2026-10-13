import re


def normalize_phone(raw: str) -> str:
    """'071 344 4555' -> '+94713444555'. Returns '' when the number cannot be interpreted."""
    if not raw:
        return ""
    digits = re.sub(r"\D", "", raw)
    if raw.strip().startswith("+") and digits:
        return "+" + digits
    if digits.startswith("94") and len(digits) == 11:
        return "+" + digits
    if digits.startswith("0") and len(digits) == 10:
        return "+94" + digits[1:]
    if len(digits) == 9:
        return "+94" + digits
    return ""


def digits_only(raw: str) -> str:
    return re.sub(r"\D", "", raw or "")

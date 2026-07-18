import pytest
from app.core.pii_redactor import PIIRedactor

def test_detect_phone():
    redactor = PIIRedactor()
    text = "Call me at 123-456-7890 or +1 555-010-9999"
    matches = redactor.detect_pii(text, enabled_types=["phone"])
    assert len(matches) == 2
    assert matches[0]["type"] == "phone"
    assert matches[1]["type"] == "phone"

def test_detect_email():
    redactor = PIIRedactor()
    text = "Contact me at test@example.com or support.help@service.io"
    matches = redactor.detect_pii(text, enabled_types=["email"])
    assert len(matches) == 2
    assert "test@example.com" in [m["value"] for m in matches]
    assert "support.help@service.io" in [m["value"] for m in matches]

def test_detect_ssn():
    redactor = PIIRedactor()
    text = "My SSN is 123-45-6789"
    matches = redactor.detect_pii(text, enabled_types=["ssn"])
    assert len(matches) == 1
    assert matches[0]["value"] == "123-45-6789"

def test_detect_credit_card():
    redactor = PIIRedactor()
    text = "Payment card: 4111111111111111"
    matches = redactor.detect_pii(text, enabled_types=["credit_card"])
    assert len(matches) == 1
    assert matches[0]["value"] == "4111111111111111"

def test_redact_multiple_types():
    redactor = PIIRedactor()
    text = "John Doe (test@example.com) called from 123-456-7890 regarding card 4111111111111111"
    # Note: name pattern is basic and might match "John Doe"
    redacted_text, log = redactor.redact_text(text, enabled_types=["email", "phone", "credit_card"])
    assert "***REDACTED***" in redacted_text
    assert "test@example.com" not in redacted_text
    assert "123-456-7890" not in redacted_text
    assert "4111111111111111" not in redacted_text
    assert len(log) == 3

def test_disable_pii_type():
    config = {
        "enabled": True,
        "enabled_types": ["email"],
        "redaction_token": "[REDACTED]",
        "log_redactions": True
    }
    redactor = PIIRedactor(config)
    text = "Email test@example.com and phone 123-456-7890"
    redacted_text, log = redactor.redact_text(text)
    assert "[REDACTED]" in redacted_text
    assert "test@example.com" not in redacted_text
    assert "123-456-7890" in redacted_text  # Phone should NOT be redacted
    assert len(log) == 1

def test_custom_redaction_token():
    config = {"redaction_token": "HIDDEN"}
    redactor = PIIRedactor(config)
    text = "Email test@example.com"
    redacted_text, _ = redactor.redact_text(text, enabled_types=["email"])
    assert redacted_text == "Email HIDDEN"

def test_redaction_log_generation():
    redactor = PIIRedactor()
    text = "Contact test@example.com"
    _, log = redactor.redact_text(text, enabled_types=["email"])
    assert len(log) == 1
    assert log[0]["type"] == "email"
    assert "hash" in log[0]
    assert "start" in log[0]
    assert "end" in log[0]

def test_no_false_positives():
    redactor = PIIRedactor()
    text = "This is a normal sentence with no PII. 123 is just a number. user.name is a handle."
    matches = redactor.detect_pii(text)
    assert len(matches) == 0

def test_detect_address():
    redactor = PIIRedactor()
    text = "I live at 123 Main Street and 456 Oak Avenue"
    matches = redactor.detect_pii(text, enabled_types=["address"])
    assert len(matches) == 2
    assert "123 Main Street" in [m["value"] for m in matches]
    assert "456 Oak Avenue" in [m["value"] for m in matches]

def test_detect_dob():
    redactor = PIIRedactor()
    text = "Born on 05/12/1990 or 12-31-1985"
    matches = redactor.detect_pii(text, enabled_types=["dob"])
    assert len(matches) == 2
    assert "05/12/1990" in [m["value"] for m in matches]
    assert "12-31-1985" in [m["value"] for m in matches]

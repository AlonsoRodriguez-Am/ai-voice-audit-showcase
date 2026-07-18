import re
import hashlib
from typing import List, Dict, Tuple, Optional

PII_PATTERNS = {
    "phone": r'\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b',
    "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    "ssn": r'\b(?!000|666|9\d{2})\d{3}[-]?(?!00)\d{2}[-]?(?!0000)\d{4}\b',
    "credit_card": r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b',
    "name": r'\b(?:[A-Z][a-z]+ ){1,2}[A-Z][a-z]+\b',  # Basic name pattern, can be noisy
    "address": r'\b\d+\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct)\b',
    "dob": r'\b(?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12][0-9]|3[01])[/.-](?:19|20)\d{2}\b',
}

class PIIRedactor:
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {
            "enabled": True,
            "enabled_types": ["phone", "email", "ssn", "credit_card"],
            "redaction_token": "***REDACTED***",
            "log_redactions": True,
            "names_enabled": False,
        }
        self.enabled_types = self.config.get("enabled_types", [])
        if self.config.get("names_enabled") and "name" not in self.enabled_types:
            self.enabled_types.append("name")
        self.redaction_token = self.config.get("redaction_token", "***REDACTED***")

    def detect_pii(self, text: str, enabled_types: Optional[List[str]] = None) -> List[Dict]:
        """
        Detects PII in the given text and returns a list of matches with metadata.
        """
        if not text:
            return []
        
        types_to_check = enabled_types if enabled_types is not None else self.enabled_types
        matches = []

        for pii_type in types_to_check:
            if pii_type in PII_PATTERNS:
                pattern = PII_PATTERNS[pii_type]
                for match in re.finditer(pattern, text):
                    matches.append({
                        "type": pii_type,
                        "start": match.start(),
                        "end": match.end(),
                        "value": match.group(),
                        "hash": hashlib.sha256(match.group().encode()).hexdigest()
                    })
        
        # Sort matches by start position descending to facilitate redaction without offset issues
        matches.sort(key=lambda x: x["start"], reverse=True)
        return matches

    def redact_text(self, text: str, enabled_types: Optional[List[str]] = None) -> Tuple[str, List[Dict]]:
        """
        Redacts PII from the text and returns the redacted text along with the log of redactions.
        """
        if not text:
            return "", []
        
        if not self.config.get("enabled", True):
            return text, []

        matches = self.detect_pii(text, enabled_types)
        redacted_text = text
        redaction_log = []

        for match in matches:
            # Replace the text at the specified range
            start, end = match["start"], match["end"]
            redacted_text = redacted_text[:start] + self.redaction_token + redacted_text[end:]
            
            # Prepare log entry (removing the actual value for security)
            log_entry = {
                "type": match["type"],
                "start": start,
                "end": start + len(self.redaction_token),
                "hash": match["hash"]
            }
            redaction_log.append(log_entry)

        return redacted_text, redaction_log

    def get_redaction_stats(self, redaction_log: List[Dict]) -> Dict:
        """
        Returns statistics about the redacted items.
        """
        stats = {}
        for entry in redaction_log:
            pii_type = entry["type"]
            stats[pii_type] = stats.get(pii_type, 0) + 1
        return stats

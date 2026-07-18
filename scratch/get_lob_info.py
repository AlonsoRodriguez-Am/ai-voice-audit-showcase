
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.lob import LOB
import json

def get_all_lobs_info():
    db = SessionLocal()
    try:
        lobs = db.query(LOB).all()
        for lob in lobs:
            print(f"\n--- LOB: {lob.name} ---")
            print(f"System Prompt: {lob.system_prompt}")
            print(f"Built-in: {lob.is_builtin} | Active: {lob.is_active}")
            print("Criteria JSON:")
            print(json.dumps(lob.criteria_json, indent=2))
    finally:
        db.close()

if __name__ == "__main__":
    get_all_lobs_info()


import os
import sys
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.lob import LOB
from app.models.user import User

def check_db():
    db = SessionLocal()
    try:
        print("--- LOBs in Database ---")
        lobs = db.query(LOB).all()
        if not lobs:
            print("No LOBs found.")
        for lob in lobs:
            print(f"ID: {lob.id} | Name: {lob.name} | Built-in: {lob.is_builtin} | Active: {lob.is_active}")
        
        print("\n--- Users in Database ---")
        users = db.query(User).all()
        if not users:
            print("No users found.")
        for user in users:
            print(f"ID: {user.id} | Email: {user.email} | Role: {user.role}")
    finally:
        db.close()

if __name__ == "__main__":
    check_db()

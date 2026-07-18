
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.seed import seed_db

def run():
    db = SessionLocal()
    try:
        print("Running seed_db...")
        seeded_users = seed_db(db)
        print("Seed completed successfully.")
        for user in seeded_users:
            print(f"User: {user['email']} ({user['role']})")
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run()

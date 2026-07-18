from app.core.database import SessionLocal
from app.models.token_usage import TokenUsage
from sqlalchemy import func

def check_tokens():
    db = SessionLocal()
    try:
        count = db.query(TokenUsage).count()
        print(f"Total token_usage records: {count}")
        
        if count > 0:
            results = db.query(
                TokenUsage.model_name,
                TokenUsage.provider,
                func.sum(TokenUsage.prompt_tokens),
                func.sum(TokenUsage.completion_tokens),
                func.sum(TokenUsage.estimated_cost)
            ).group_by(TokenUsage.model_name, TokenUsage.provider).all()
            
            for r in results:
                print(f"Model: {r[0]}, Provider: {r[1]}, Prompt: {r[2]}, Completion: {r[3]}, Cost: {r[4]}")
        else:
            print("No records found in token_usage table.")
    finally:
        db.close()

if __name__ == "__main__":
    check_tokens()

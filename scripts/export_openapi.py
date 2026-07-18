import json
import sys
import os

# Add the project root to sys.path
sys.path.append(os.getcwd())

from app.main import app

def export_openapi():
    openapi_data = app.openapi()
    
    # Ensure docs directory exists
    os.makedirs("docs", exist_ok=True)
    
    output_path = "docs/openapi.json"
    with open(output_path, "w") as f:
        json.dump(openapi_data, f, indent=2)
    
    print(f"OpenAPI spec exported successfully to {output_path}")

if __name__ == "__main__":
    export_openapi()

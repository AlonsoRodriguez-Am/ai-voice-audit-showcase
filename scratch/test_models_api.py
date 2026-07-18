import requests
import time

url = "http://localhost:5001/api/auth/login"
payload = {
    "email": "admin@admin.com",
    "password": "admin123"
}

try:
    print("Logging in...")
    r = requests.post(url, json=payload)
    r.raise_for_status()
    token = r.json()["access_token"]
    print("Login successful! Token acquired.")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    test_payload = {
        "provider": "ollama",
        "model": "neuralmagic/Llama-3.2-3B-Instruct-FP8",
        "api_base": "http://localhost:8899/v1"
    }
    
    print("Calling LOB LLM connection test endpoint for LOB 1 with neuralmagic FP8 model name...")
    r_test = requests.post("http://localhost:5001/api/lobs/1/test-llm", json=test_payload, headers=headers)
    print("Response status:", r_test.status_code)
    print("Response JSON:", r_test.json())
except Exception as e:
    print("Error:", str(e))

import requests
import time
import sys
import uuid

BASE_URL = "http://127.0.0.1:8000"
session = requests.Session()

def print_step(step_name):
    print(f"\n[+] RUNNING TEST: {step_name}")
    print("-" * 50)

def test_phase_1():
    # 1. Register Photographer
    print_step("1. Registering new photographer")
    unique_email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "email": unique_email,
        "password": "Password123!",
        "full_name": "E2E Tester",
        "studio_name": "E2E Studio"
    }
    resp = session.post(f"{BASE_URL}/api/auth/register", json=payload)
    if resp.status_code not in (200, 201):
        print(f"FAILED: Registration returned {resp.status_code}")
        print(resp.json())
        sys.exit(1)
    print("SUCCESS: Registered photographer")

    # 2. Login
    print_step("2. Logging in and checking JWT session")
    login_payload = {
        "email": unique_email,
        "password": "Password123!"
    }
    resp = session.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    if resp.status_code != 200:
        print(f"FAILED: Login returned {resp.status_code}")
        sys.exit(1)
    
    token = resp.json().get("access_token")
    session.headers.update({"Authorization": f"Bearer {token}"})
    print("SUCCESS: Logged in, JWT token acquired")

    # 3. Create Album
    print_step("3. Creating a test album & checking PIN")
    album_payload = {
        "title": "E2E Wedding",
        "client_name": "John Doe",
        "allow_download": False,
        "expires_in_days": 15
    }
    resp = session.post(f"{BASE_URL}/api/albums/", json=album_payload)
    if resp.status_code != 201:
        print(f"FAILED: Album creation returned {resp.status_code}")
        sys.exit(1)
    
    album_data = resp.json()
    album_id = album_data.get("id")
    print(f"SUCCESS: Album created (ID: {album_id}, PIN: {album_data.get('pin')})")

    # 4. Storage Quota & Cloudinary Signature Test
    print_step("4. Requesting direct upload signature (Quota Test)")
    resp = session.get(f"{BASE_URL}/api/media/upload-signature")
    if resp.status_code != 200:
        print(f"FAILED: Upload signature returned {resp.status_code}")
        sys.exit(1)
    print("SUCCESS: Received Cloudinary signature. Quota check passed.")

    # 5. Logout & Token Invalidation
    print_step("5. Logging out & Verifying Token Invalidation (JWT-01)")
    resp = session.post(f"{BASE_URL}/api/auth/logout")
    if resp.status_code != 200:
        print("FAILED: Logout did not return 200")
        sys.exit(1)
    
    # Try fetching albums with the old token
    resp = session.get(f"{BASE_URL}/api/albums/")
    if resp.status_code != 401:
        print(f"FAILED: Expected 401 Unauthorized, got {resp.status_code}")
        sys.exit(1)
    print("SUCCESS: Token successfully invalidated on server side.")

    print("\n" + "=" * 50)
    print("🚀 PHASE 1 TESTING PASSED SUCCESSFULLY!")
    print("=" * 50)

if __name__ == "__main__":
    test_phase_1()

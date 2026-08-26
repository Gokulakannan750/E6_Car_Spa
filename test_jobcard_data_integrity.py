import requests
import json
import uuid
import time
import hmac
import hashlib
import base64

BASE_URL = "http://localhost:5298"
DEV_SECRET = "E6CarSpa_Dev_SuperSecure_SecretSigningKey_2026_Auth_Foundation_Key"
FALLBACK_SECRET = "E6CarSpa_SuperSecure_SecretSigningKey_2026_Auth_Foundation_Key"

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def generate_test_jwt(user_id: str, username: str, role: str = "Owner", is_owner: bool = True, secret_key: str = DEV_SECRET):
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": user_id,
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": user_id,
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/name": username,
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": role,
        "role": role,
        "isOwner": "true" if is_owner else "false",
        "nbf": now - 10,
        "exp": now + 86400,
        "iat": now - 10,
        "iss": "E6CarSpa",
        "aud": "E6CarSpaDesktop"
    }
    h_b64 = b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    p_b64 = b64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    message = f"{h_b64}.{p_b64}".encode('utf-8')
    sig = hmac.new(secret_key.encode('utf-8'), message, hashlib.sha256).digest()
    sig_b64 = b64url_encode(sig)
    return f"{h_b64}.{p_b64}.{sig_b64}"

def get_auth_token():
    temp_id = str(uuid.uuid4())
    for secret in [DEV_SECRET, FALLBACK_SECRET]:
        temp_token = generate_test_jwt(temp_id, "admin", role="Owner", is_owner=True, secret_key=secret)
        try:
            r = requests.get(f"{BASE_URL}/api/users", headers={"Authorization": f"Bearer {temp_token}"}, timeout=5)
            if r.status_code == 200:
                users = r.json()
                if users:
                    real_user = next((u for u in users if u.get("role") == "Owner"), users[0])
                    return generate_test_jwt(real_user["id"], real_user["username"], role="Owner", is_owner=True, secret_key=secret)
                return temp_token
        except Exception:
            continue
    return None

def run_tests():
    token = get_auth_token()
    assert token is not None, "Failed to generate auth token"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    print("=== TEST 1: Customer Creation (Real GUID) ===")
    unique_suffix = str(uuid.uuid4())[:6]
    cust_res = requests.post(f"{BASE_URL}/api/customers", json={
        "name": f"Test Real Customer {unique_suffix}",
        "phoneNumber": f"988{int(time.time()) % 10000000:07d}",
        "email": f"realcust_{unique_suffix}@e6carspa.com",
        "address": "123 Main Rd, Erode"
    }, headers=headers)
    assert cust_res.status_code == 201 or cust_res.status_code == 200, f"Customer creation failed: {cust_res.text}"
    customer = cust_res.json()
    customer_id = customer["id"]
    print(f"PASS: Created Customer ID: {customer_id}")

    print("\n=== TEST 2: Vehicle Creation (Real GUID) ===")
    veh_res = requests.post(f"{BASE_URL}/api/vehicles", json={
        "registrationNumber": f"TN33{unique_suffix.upper()}",
        "make": "Hyundai",
        "model": "Creta",
        "variant": "SX(O)",
        "customerId": customer_id
    }, headers=headers)
    assert veh_res.status_code == 201 or veh_res.status_code == 200, f"Vehicle creation failed: {veh_res.text}"
    vehicle = veh_res.json()
    vehicle_id = vehicle["id"]
    print(f"PASS: Created Vehicle ID: {vehicle_id}")

    print("\n=== TEST 3: Get Active Services (Real GUIDs) ===")
    svc_res = requests.get(f"{BASE_URL}/api/services?page=1&pageSize=50", headers=headers)
    assert svc_res.status_code == 200, f"Get services failed: {svc_res.text}"
    services = [s for s in svc_res.json().get("items", []) if s.get("isActive")]
    assert len(services) > 0, "No active services found in database"
    active_service = services[0]
    service_id = active_service["id"]
    print(f"PASS: Active Service: {active_service['name']} ({service_id}) Price: {active_service['price']}")

    print("\n=== TEST 4: Create Job Card (POST /api/job-cards) ===")
    jc_res = requests.post(f"{BASE_URL}/api/job-cards", json={
        "customerId": customer_id,
        "vehicleId": vehicle_id,
        "services": [
            {
                "serviceId": service_id,
                "quantity": 1,
                "discountAmount": 0
            }
        ],
        "notes": "Data integrity test job card",
        "isGstEnabled": True
    }, headers=headers)
    assert jc_res.status_code == 201 or jc_res.status_code == 200, f"Job card create failed: {jc_res.text}"
    job_card = jc_res.json()
    jc_id = job_card["id"]
    jc_number = job_card["jobCardNumber"]
    print(f"PASS: Job Card created with Real DB ID: {jc_id}, Number: {jc_number}, Total: {job_card['totalAmount']}")

    print("\n=== TEST 5: Verify Job Card List (GET /api/job-cards) ===")
    list_res = requests.get(f"{BASE_URL}/api/job-cards?page=1&pageSize=10", headers=headers)
    assert list_res.status_code == 200, f"List failed: {list_res.text}"
    list_data = list_res.json()
    items = list_data.get("items", [])
    assert len(items) > 0, "No items returned in list"
    first_item = items[0]
    print(f"First item in list: {first_item['jobCardNumber']} (ID: {first_item['id']})")
    assert first_item["id"] == jc_id, f"Expected top item to be {jc_id}, got {first_item['id']}"
    assert first_item["jobCardNumber"] == jc_number, f"Expected top job card number {jc_number}, got {first_item['jobCardNumber']}"
    print("PASS: Newly created Job Card appears at the TOP of GET /api/job-cards!")

    print("\n=== TEST 6: Simulated Failure (Invalid Mock Customer ID 'c1') ===")
    fake_res = requests.post(f"{BASE_URL}/api/job-cards", json={
        "customerId": "00000000-0000-0000-0000-000000000000",
        "vehicleId": vehicle_id,
        "services": [{"serviceId": service_id, "quantity": 1, "discountAmount": 0}]
    }, headers=headers)
    print(f"Fake Customer ID returned Status: {fake_res.status_code}")
    assert fake_res.status_code != 200 and fake_res.status_code in [400, 404, 500], f"Expected failure for invalid customer, got {fake_res.status_code}"
    print("PASS: Backend correctly rejects invalid customer IDs!")

    print("\n=== TEST 7: Unauthenticated List Call ===")
    unauth_res = requests.get(f"{BASE_URL}/api/job-cards")
    print(f"Unauthenticated status: {unauth_res.status_code}")
    assert unauth_res.status_code == 401, f"Expected 401 Unauthorized, got {unauth_res.status_code}"
    print("PASS: GET /api/job-cards correctly requires authentication (401)!")

    print("\n=== TEST 8: Verify Customer Job Cards (GET /api/job-cards/by-customer/{customerId}) ===")
    cust_jc_res = requests.get(f"{BASE_URL}/api/job-cards/by-customer/{customer_id}?page=1&pageSize=10", headers=headers)
    assert cust_jc_res.status_code == 200, f"Customer job cards failed: {cust_jc_res.text}"
    cust_jc_data = cust_jc_res.json()
    cust_items = cust_jc_data.get("items", [])
    assert len(cust_items) == 1, f"Expected 1 job card for customer, got {len(cust_items)}"
    assert cust_items[0]["id"] == jc_id, f"Expected job card ID {jc_id}, got {cust_items[0]['id']}"
    assert cust_items[0]["jobCardNumber"] == jc_number, f"Expected job card number {jc_number}, got {cust_items[0]['jobCardNumber']}"
    print(f"PASS: Customer drawer endpoint returns real Job Card: {cust_items[0]['jobCardNumber']} for Customer: {customer_id}")

    print("\n=== ALL JOB CARD DATA INTEGRITY TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()

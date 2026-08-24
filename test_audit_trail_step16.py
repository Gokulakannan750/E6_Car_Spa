import json
import sys
import requests
import uuid
import datetime
import time
import hmac
import hashlib
import base64

BASE_URL = "http://localhost:5298"
DEV_SECRET = "E6CarSpa_Dev_SuperSecure_SecretSigningKey_2026_Auth_Foundation_Key"
FALLBACK_SECRET = "E6CarSpa_SuperSecure_SecretSigningKey_2026_Auth_Foundation_Key"

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def generate_test_jwt(user_id: str, username: str, role: str = "Owner", is_owner: bool = True, permissions: list = None, secret_key: str = DEV_SECRET):
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": user_id,
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": user_id,
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": username,
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": role,
        "role": role,
        "isOwner": "true" if is_owner else "false",
        "nbf": now - 10,
        "exp": now + 86400,
        "iat": now - 10,
        "iss": "E6CarSpa",
        "aud": "E6CarSpaDesktop"
    }
    if permissions:
        payload["permission"] = permissions

    h_b64 = b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    p_b64 = b64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    message = f"{h_b64}.{p_b64}".encode('utf-8')
    sig = hmac.new(secret_key.encode('utf-8'), message, hashlib.sha256).digest()
    sig_b64 = b64url_encode(sig)
    return f"{h_b64}.{p_b64}.{sig_b64}"

def get_owner_token():
    temp_id = str(uuid.uuid4())
    for secret in [DEV_SECRET, FALLBACK_SECRET]:
        temp_token = generate_test_jwt(temp_id, "admin", role="Owner", is_owner=True, secret_key=secret)
        try:
            r = requests.get(f"{BASE_URL}/api/users", headers={"Authorization": f"Bearer {temp_token}"}, timeout=5)
            if r.status_code == 200:
                users = r.json()
                if users:
                    real_user = next((u for u in users if u.get("role") == "Owner"), users[0])
                    return generate_test_jwt(real_user["id"], real_user["username"], role="Owner", is_owner=True, secret_key=secret), real_user["id"], secret
                return temp_token, temp_id, secret
        except Exception:
            continue
    raise RuntimeError("Could not connect to API server on http://localhost:5298")

def log_test(name, success, msg=""):
    status = "[PASS]" if success else "[FAIL]"
    print(f"{status} {name} {f'- {msg}' if msg else ''}")
    if not success:
        sys.exit(1)

def run_tests():
    print("\n==================================================")
    print("  E6 CAR SPA — STEP 16 AUDIT TRAIL AUTOMATED TESTS")
    print("==================================================\n")

    session = requests.Session()
    owner_token, owner_id, secret_used = get_owner_token()
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    # 1. Test Login Failed & Audit
    print("--- Testing Authentication Auditing ---")
    fail_res = session.post(f"{BASE_URL}/api/auth/login", json={
        "username": "non_existent_user_xyz",
        "password": "WrongPassword123!"
    })
    log_test("Test B.1: Login with invalid credentials returns 401", fail_res.status_code == 401)

    # Create a dedicated test user for password login tests
    test_login_user = f"login_user_{uuid.uuid4().hex[:6]}"
    create_login_res = session.post(f"{BASE_URL}/api/users", json={
        "username": test_login_user,
        "fullName": "Login Audit Tester",
        "email": f"{test_login_user}@test.com",
        "password": "Password123!",
        "confirmPassword": "Password123!",
        "role": "Manager",
        "permissionCodes": ["invoices.view", "jobcards.view", "audit.view"]
    }, headers=owner_headers)
    log_test("Create user for login test", create_login_res.status_code == 201)

    # Test login failure with wrong password on existing user
    fail_pw_res = session.post(f"{BASE_URL}/api/auth/login", json={
        "username": test_login_user,
        "password": "WrongPassword123!"
    })
    log_test("Test B.2: Wrong password returns 401", fail_pw_res.status_code == 401)

    # Test successful login
    succ_login_res = session.post(f"{BASE_URL}/api/auth/login", json={
        "username": test_login_user,
        "password": "Password123!"
    })
    log_test("Test A.1: Valid login returns 200 OK", succ_login_res.status_code == 200)

    # 2. Verify GET /api/audit-logs
    print("\n--- Testing Audit Logs Query & Immutability ---")
    logs_res = session.get(f"{BASE_URL}/api/audit-logs", headers=owner_headers)
    log_test("Test M.1: Owner can query /api/audit-logs (200 OK)", logs_res.status_code == 200)
    logs_data = logs_res.json()
    log_test("Test M.2: Audit logs returned as paged result", "items" in logs_data and "totalCount" in logs_data)

    # Verify LOGIN_FAILED record
    fail_logs = [l for l in logs_data["items"] if l["action"] == "LOGIN_FAILED"]
    log_test("Test B.3: LOGIN_FAILED audit record exists", len(fail_logs) > 0)
    if fail_logs:
        fl = fail_logs[0]
        log_test("Test B.4: LOGIN_FAILED has Outcome='Failure'", fl["outcome"] == "Failure")
        log_test("Test B.5: LOGIN_FAILED has null UserId", fl["userId"] is None)
        log_test("Test B.6: LOGIN_FAILED description is generic and does not leak credentials", "Password123!" not in fl["description"])
        log_test("Test C.1: Sensitive keywords sanitized if present", "wrongpassword" not in json.dumps(fl).lower() and "password123!" not in json.dumps(fl).lower())

    # Verify LOGIN_SUCCESS record
    success_logs = [l for l in logs_data["items"] if l["action"] == "LOGIN_SUCCESS" and l.get("entityReference") == test_login_user]
    log_test("Test A.2: LOGIN_SUCCESS audit record exists for login user", len(success_logs) > 0)
    if success_logs:
        sl = success_logs[0]
        log_test("Test A.3: LOGIN_SUCCESS has Outcome='Success'", sl["outcome"] == "Success")
        log_test("Test A.4: LOGIN_SUCCESS records Actor UserName and UserRole", sl["userName"] == "Login Audit Tester" and sl["userRole"] == "Manager")

    # 3. Test Audit Log API Immutability: NO POST, PUT, PATCH, DELETE
    print("\n--- Testing Audit Logs Endpoint Immutability ---")
    post_res = session.post(f"{BASE_URL}/api/audit-logs", json={"action": "HACK"}, headers=owner_headers)
    log_test("Test L.1: POST /api/audit-logs is rejected (405/404)", post_res.status_code in [404, 405])

    put_res = session.put(f"{BASE_URL}/api/audit-logs/{uuid.uuid4()}", json={"action": "HACK"}, headers=owner_headers)
    log_test("Test L.2: PUT /api/audit-logs/{id} is rejected (405/404)", put_res.status_code in [404, 405])

    patch_res = session.patch(f"{BASE_URL}/api/audit-logs/{uuid.uuid4()}", json={"action": "HACK"}, headers=owner_headers)
    log_test("Test L.3: PATCH /api/audit-logs/{id} is rejected (405/404)", patch_res.status_code in [404, 405])

    del_res = session.delete(f"{BASE_URL}/api/audit-logs/{uuid.uuid4()}", headers=owner_headers)
    log_test("Test L.4: DELETE /api/audit-logs/{id} is rejected (405/404)", del_res.status_code in [404, 405])

    # 4. Test User Management Audit
    print("\n--- Testing User Management Auditing ---")
    unique_user = f"audit_mgr_{uuid.uuid4().hex[:6]}"
    create_user_res = session.post(f"{BASE_URL}/api/users", json={
        "username": unique_user,
        "fullName": "Audit Manager Test",
        "email": f"{unique_user}@test.com",
        "password": "Password123!",
        "confirmPassword": "Password123!",
        "role": "Manager",
        "permissionCodes": ["invoices.view", "jobcards.view"]
    }, headers=owner_headers)
    log_test("Create test manager user", create_user_res.status_code == 201)
    new_user_id = create_user_res.json()["id"]

    # Verify USER_CREATED log
    user_created_logs = session.get(f"{BASE_URL}/api/audit-logs?module=Users&action=USER_CREATED", headers=owner_headers).json()
    user_created_item = next((l for l in user_created_logs["items"] if l["entityId"] == new_user_id), None)
    log_test("Test D.1: USER_CREATED audit record logged with actor snapshot", user_created_item is not None)
    if user_created_item:
        log_test("Test D.2: USER_CREATED has Outcome='Success'", user_created_item["outcome"] == "Success")
        log_test("Test D.3: Password is never logged in newValues or anywhere", "Password123!" not in json.dumps(user_created_item))

    # Toggle status -> USER_DEACTIVATED
    toggle_res = session.patch(f"{BASE_URL}/api/users/{new_user_id}/toggle-status", headers=owner_headers)
    log_test("Toggle user status to inactive", toggle_res.status_code == 200)

    user_deact_logs = session.get(f"{BASE_URL}/api/audit-logs?action=USER_DEACTIVATED", headers=owner_headers).json()
    user_deact_item = next((l for l in user_deact_logs["items"] if l["entityId"] == new_user_id), None)
    log_test("Test E.1: USER_DEACTIVATED audit log recorded", user_deact_item is not None)

    # 5. Test Staff Advance Auditing
    print("\n--- Testing Staff Advance Auditing ---")
    staff_list_res = session.get(f"{BASE_URL}/api/staff-advances/staff", headers=owner_headers).json()
    if staff_list_res:
        staff_id = staff_list_res[0]["id"]
        create_adv_res = session.post(f"{BASE_URL}/api/staff-advances", json={
            "staffId": staff_id,
            "amount": 2500.0,
            "advanceDate": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
            "reason": "Emergency medical allowance",
            "notes": "Audited advance test"
        }, headers=owner_headers)
        log_test("Create staff advance", create_adv_res.status_code == 201)
        adv_id = create_adv_res.json()["id"]

        # Verify ADVANCE_CREATED log
        adv_create_logs = session.get(f"{BASE_URL}/api/audit-logs?module=StaffAdvances&action=ADVANCE_CREATED", headers=owner_headers).json()
        adv_created_item = next((l for l in adv_create_logs["items"] if l["entityId"] == adv_id), None)
        log_test("Test J.1: ADVANCE_CREATED audit log recorded", adv_created_item is not None)

        # Obsolete staff advance with reason
        obsolete_res = session.post(f"{BASE_URL}/api/staff-advances/{adv_id}/obsolete", json={
            "reason": "Administrative correction for duplicate request"
        }, headers=owner_headers)
        log_test("Obsolete staff advance", obsolete_res.status_code == 200)

        # Verify ADVANCE_OBSOLETED log
        adv_obs_logs = session.get(f"{BASE_URL}/api/audit-logs?module=StaffAdvances&action=ADVANCE_OBSOLETED", headers=owner_headers).json()
        adv_obs_item = next((l for l in adv_obs_logs["items"] if l["entityId"] == adv_id), None)
        log_test("Test J.2: ADVANCE_OBSOLETED audit log recorded with reason", adv_obs_item is not None and "Administrative correction" in adv_obs_item["description"])

    # 6. Test Showroom Attendance Auditing
    print("\n--- Testing Showroom Attendance Auditing ---")
    showrooms_res = session.get(f"{BASE_URL}/api/showrooms", headers=owner_headers).json()
    if showrooms_res:
        sr_id = showrooms_res[0]["id"]
        today_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

        confirm_res = session.post(f"{BASE_URL}/api/showrooms/{sr_id}/daily-staff/confirm?date={today_str}", headers=owner_headers)
        log_test("Confirm showroom attendance", confirm_res.status_code == 200)

        sr_confirm_logs = session.get(f"{BASE_URL}/api/audit-logs?module=Showrooms", headers=owner_headers).json()
        sr_item = next((l for l in sr_confirm_logs["items"] if l["entityId"] == sr_id), None)
        log_test("Test I.1: Showroom attendance confirmation logged", sr_item is not None)

        # Unlock showroom attendance
        unlock_res = session.post(f"{BASE_URL}/api/showrooms/{sr_id}/daily-staff/unlock?date={today_str}", headers=owner_headers)
        log_test("Unlock showroom attendance", unlock_res.status_code == 200)

        sr_unlock_logs = session.get(f"{BASE_URL}/api/audit-logs?module=Showrooms&action=ATTENDANCE_UNLOCKED", headers=owner_headers).json()
        sr_unlock_item = next((l for l in sr_unlock_logs["items"] if l["entityId"] == sr_id), None)
        log_test("Test I.2: ATTENDANCE_UNLOCKED audit log recorded", sr_unlock_item is not None)

    # 7. Test Settings / Business Profile Auditing
    print("\n--- Testing Business Profile Auditing ---")
    get_profile = session.get(f"{BASE_URL}/api/settings/business", headers=owner_headers).json()
    update_prof_res = session.put(f"{BASE_URL}/api/settings/business", json={
        "businessName": get_profile.get("businessName") or "E6 Car Spa",
        "addressLine1": get_profile.get("addressLine1") or "36, Geetha Nagar Main Road",
        "addressLine2": get_profile.get("addressLine2") or "",
        "city": get_profile.get("city") or "Erode",
        "state": get_profile.get("state") or "Tamil Nadu",
        "postalCode": get_profile.get("postalCode") or "638011",
        "phone": "+91 9578749449",
        "email": "e6carspaerd@gmail.com",
        "gstin": "33AAAAA0000A1Z5"
    }, headers=owner_headers)
    log_test("Update business profile", update_prof_res.status_code == 200)

    bp_logs = session.get(f"{BASE_URL}/api/audit-logs?module=Settings&action=BUSINESS_PROFILE_UPDATED", headers=owner_headers).json()
    log_test("Test K.1: BUSINESS_PROFILE_UPDATED audit log recorded", len(bp_logs["items"]) > 0)

    # 8. Test Permissions: User without audit.view cannot access audit logs
    print("\n--- Testing Audit Permission Guarding ---")
    staff_user = f"audit_staff_{uuid.uuid4().hex[:6]}"
    create_staff_res = session.post(f"{BASE_URL}/api/users", json={
        "username": staff_user,
        "fullName": "Audit Staff Test",
        "email": f"{staff_user}@test.com",
        "password": "Password123!",
        "confirmPassword": "Password123!",
        "role": "Staff",
        "permissionCodes": ["invoices.view"] # No audit.view permission
    }, headers=owner_headers)
    log_test("Create staff without audit.view", create_staff_res.status_code == 201)

    staff_login = session.post(f"{BASE_URL}/api/auth/login", json={
        "username": staff_user,
        "password": "Password123!"
    })
    staff_token = staff_login.json()["token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    staff_audit_res = session.get(f"{BASE_URL}/api/audit-logs", headers=staff_headers)
    log_test("Test M.3: User without audit.view permission receives 403 Forbidden", staff_audit_res.status_code == 403)

    unauth_res = session.get(f"{BASE_URL}/api/audit-logs")
    log_test("Test M.4: Unauthenticated request receives 401 Unauthorized", unauth_res.status_code == 401)

    print("\n==================================================")
    print("  ALL STEP 16 AUDIT TRAIL TESTS PASSED (100%)!")
    print("==================================================\n")

if __name__ == "__main__":
    run_tests()

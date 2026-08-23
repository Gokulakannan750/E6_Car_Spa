import requests
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:5298/api"

def main():
    print("=== STARTING SHOWROOM DAILY PAYMENT MODULE E2E TEST ===")

    # 1. Health check
    res = requests.get(f"{BASE_URL}/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("1. Health Check: OK")

    # 2. Fetch staff for assignment
    staff_res = requests.get(f"{BASE_URL}/staff-advances/staff")
    assert staff_res.status_code == 200, f"Staff list failed: {staff_res.text}"
    staff_list = staff_res.json()
    assert len(staff_list) >= 2, "Need at least 2 staff members"
    staff1 = staff_list[0]
    staff2 = staff_list[1]
    print(f"2. Using Staff: {staff1['name']} and {staff2['name']}")

    # 3. Create Erode and Salem Showrooms
    sr1_res = requests.post(f"{BASE_URL}/showrooms", json={
        "name": "Erode Showroom (Payment Test)",
        "address": "123 Test Street, Erode",
        "phone": "+91 98765 00001",
        "isActive": True
    })
    assert sr1_res.status_code == 201, f"Create Erode failed: {sr1_res.text}"
    erode = sr1_res.json()
    erode_id = erode["id"]
    print(f"3. Created Erode Showroom: id={erode_id}")

    sr2_res = requests.post(f"{BASE_URL}/showrooms", json={
        "name": "Salem Showroom (Payment Test)",
        "address": "456 Test Avenue, Salem",
        "phone": "+91 98765 00002",
        "isActive": True
    })
    assert sr2_res.status_code == 201, f"Create Salem failed: {sr2_res.text}"
    salem = sr2_res.json()
    salem_id = salem["id"]
    print(f"4. Created Salem Showroom: id={salem_id}")

    # TEST H part 1: Assign staff to Erode on 2026-08-23
    assign1 = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-staff", json={
        "staffId": staff1["id"],
        "date": "2026-08-23T00:00:00Z",
        "vehiclesAttended": 8
    })
    assert assign1.status_code == 200, f"Assign staff 1 failed: {assign1.text}"

    assign2 = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-staff", json={
        "staffId": staff2["id"],
        "date": "2026-08-23T00:00:00Z",
        "vehiclesAttended": 6
    })
    assert assign2.status_code == 200, f"Assign staff 2 failed: {assign2.text}"

    daily_staff = requests.get(f"{BASE_URL}/showrooms/{erode_id}/daily-staff?date=2026-08-23").json()
    assert daily_staff["totalVehiclesAttended"] == 14
    assert len(daily_staff["staffAssignments"]) == 2
    print(f"5. TEST H Pre-check: Assigned 2 staff, totalVehicles=14")

    # TEST A: Create daily showroom bill for Erode on 23-Aug-2026 (INR 8,500)
    bill_res = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill?date=2026-08-23", json={
        "amount": 8500.0,
        "notes": "Full day package"
    })
    assert bill_res.status_code == 200, f"Set bill failed: {bill_res.text}"
    bill_data = bill_res.json()
    assert bill_data["amount"] == 8500.0
    assert bill_data["amountReceived"] == 0.0
    assert bill_data["balanceAmount"] == 8500.0
    assert bill_data["status"] == "Unpaid"
    print(f"6. TEST A Passed: Created Daily Showroom Bill for INR 8,500. Status={bill_data['status']}")

    # TEST D & E: Overpayment and Zero payment attempts
    # Overpayment attempt (INR 9,000 > INR 8,500)
    overpay_res = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill/payments?date=2026-08-23", json={
        "amount": 9000.0,
        "paymentMethod": "UPI",
        "reference": "UPI_FAIL"
    })
    assert overpay_res.status_code == 400, f"Expected 400 for overpayment, got {overpay_res.status_code}"
    print(f"7. TEST D Passed: Overpayment rejected with 400 ({overpay_res.json().get('message')})")

    # Zero payment attempt
    zero_res = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill/payments?date=2026-08-23", json={
        "amount": 0.0,
        "paymentMethod": "Cash"
    })
    assert zero_res.status_code == 400, f"Expected 400 for zero payment, got {zero_res.status_code}"
    print(f"8. TEST E Passed: Zero payment rejected with 400 ({zero_res.json().get('message')})")

    # TEST B: Record partial payment (INR 5,000 via UPI)
    pay1_res = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill/payments?date=2026-08-23", json={
        "amount": 5000.0,
        "paymentMethod": "UPI",
        "reference": "UPI123456",
        "notes": "First installment"
    })
    assert pay1_res.status_code == 200, f"Record payment 1 failed: {pay1_res.text}"
    pay1_data = pay1_res.json()
    assert pay1_data["amountReceived"] == 5000.0
    assert pay1_data["balanceAmount"] == 3500.0
    assert pay1_data["status"] == "PartiallyPaid"
    assert len(pay1_data["payments"]) == 1
    payment1_id = pay1_data["payments"][0]["id"]
    print(f"9. TEST B Passed: Partial payment of INR 5,000 recorded. Received={pay1_data['amountReceived']}, Balance={pay1_data['balanceAmount']}, Status={pay1_data['status']}")

    # TEST C: Record second payment (INR 3,500 via Cash) -> Full Settlement
    pay2_res = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill/payments?date=2026-08-23", json={
        "amount": 3500.0,
        "paymentMethod": "Cash",
        "notes": "Final settlement"
    })
    assert pay2_res.status_code == 200, f"Record payment 2 failed: {pay2_res.text}"
    pay2_data = pay2_res.json()
    assert pay2_data["amountReceived"] == 8500.0
    assert pay2_data["balanceAmount"] == 0.0
    assert pay2_data["status"] == "Paid"
    assert len(pay2_data["payments"]) == 2
    payment2_id = pay2_data["payments"][0]["id"] if pay2_data["payments"][0]["id"] != payment1_id else pay2_data["payments"][1]["id"]
    print(f"10. TEST C Passed: Second payment of INR 3,500 recorded. Received={pay2_data['amountReceived']}, Balance={pay2_data['balanceAmount']}, Status={pay2_data['status']}")

    # Verify overpayment now that balance is 0
    overpay_zero_res = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill/payments?date=2026-08-23", json={
        "amount": 500.0,
        "paymentMethod": "Cash"
    })
    assert overpay_zero_res.status_code == 400, "Should reject payment when balance is 0"
    print(f"11. Overpayment on zero balance rejected: OK")

    # TEST F: Different Date (Erode on 2026-08-24 with INR 10,000)
    bill_f_res = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill?date=2026-08-24", json={
        "amount": 10000.0,
        "notes": "Next day bill"
    })
    assert bill_f_res.status_code == 200
    bill_f_data = bill_f_res.json()
    assert bill_f_data["amount"] == 10000.0
    assert bill_f_data["balanceAmount"] == 10000.0
    assert bill_f_data["status"] == "Unpaid"

    # Re-check 2026-08-23 bill
    erode_23 = requests.get(f"{BASE_URL}/showrooms/{erode_id}/daily-bill?date=2026-08-23").json()
    assert erode_23["amountReceived"] == 8500.0
    assert erode_23["balanceAmount"] == 0.0
    assert erode_23["status"] == "Paid"
    print(f"12. TEST F Passed: Date isolation confirmed. 23-Aug remains Paid with Balance=0, 24-Aug is Unpaid with Balance=10000.")

    # TEST G: Different Showroom (Salem on 2026-08-23 with INR 6,000)
    salem_bill_res = requests.post(f"{BASE_URL}/showrooms/{salem_id}/daily-bill?date=2026-08-23", json={
        "amount": 6000.0,
        "notes": "Salem Day 1"
    })
    assert salem_bill_res.status_code == 200
    salem_bill_data = salem_bill_res.json()
    assert salem_bill_data["amount"] == 6000.0
    assert salem_bill_data["balanceAmount"] == 6000.0
    assert salem_bill_data["status"] == "Unpaid"

    # Verify Erode bill is untouched
    erode_check = requests.get(f"{BASE_URL}/showrooms/{erode_id}/daily-bill?date=2026-08-23").json()
    assert erode_check["amount"] == 8500.0
    assert erode_check["amountReceived"] == 8500.0
    print(f"13. TEST G Passed: Showroom isolation confirmed. Salem bill has no impact on Erode bill.")

    # TEST H: Verify Staff Data Remains Untouched
    staff_check = requests.get(f"{BASE_URL}/showrooms/{erode_id}/daily-staff?date=2026-08-23").json()
    assert staff_check["totalVehiclesAttended"] == 14
    assert len(staff_check["staffAssignments"]) == 2
    assert staff_check["staffAssignments"][0]["vehiclesAttended"] in [8, 6]
    assert staff_check["staffAssignments"][1]["vehiclesAttended"] in [8, 6]
    print(f"14. TEST H Passed: Staff assignments (2 staff, 14 vehicles) completely unchanged by payment operations.")

    # TEST I: Void a payment and verify balance rollback
    void_res = requests.delete(f"{BASE_URL}/showroom-payments/{payment1_id}")
    assert void_res.status_code == 204, f"Void payment failed: {void_res.status_code}"
    
    recalc_bill = requests.get(f"{BASE_URL}/showrooms/{erode_id}/daily-bill?date=2026-08-23").json()
    assert recalc_bill["amountReceived"] == 3500.0
    assert recalc_bill["balanceAmount"] == 5000.0
    assert recalc_bill["status"] == "PartiallyPaid"
    assert len(recalc_bill["payments"]) == 1
    print(f"15. TEST I Passed: Payment voided. Received={recalc_bill['amountReceived']}, Balance={recalc_bill['balanceAmount']}, Status={recalc_bill['status']}")

    # Cleanup test showrooms
    requests.delete(f"{BASE_URL}/showrooms/{erode_id}")
    requests.delete(f"{BASE_URL}/showrooms/{salem_id}")
    print(f"16. Cleaned up test showrooms.")

    print("=== ALL 16 TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    main()

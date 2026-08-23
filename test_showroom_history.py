import requests
import json
import time

BASE_URL = "http://localhost:5298/api"

def test_showroom_step3():
    ts = int(time.time())
    print(f"=== STARTING SHOWROOM STEP 3 TESTS (Run {ts}) ===")

    # 1. Create fresh Showroom 1 (Erode Test)
    r = requests.post(f"{BASE_URL}/showrooms", json={
        "name": f"Erode Showroom (Run {ts})",
        "address": "142 Brough Road, Erode",
        "phone": "+91 98765 43210",
        "isActive": True
    })
    assert r.status_code in (200, 201), f"Failed to create showroom: {r.text}"
    erode = r.json()
    erode_id = erode["id"]
    print(f"[*] Created test showroom 1: {erode['name']} ({erode_id})")

    # 2. Create fresh Showroom 2 (Salem Test)
    r = requests.post(f"{BASE_URL}/showrooms", json={
        "name": f"Salem Showroom (Run {ts})",
        "address": "45 Junction Main Road, Salem",
        "phone": "+91 94433 22110",
        "isActive": True
    })
    assert r.status_code in (200, 201), f"Failed to create showroom: {r.text}"
    salem = r.json()
    salem_id = salem["id"]
    print(f"[*] Created test showroom 2: {salem['name']} ({salem_id})")

    # Fetch staff
    r = requests.get(f"{BASE_URL}/staff-advances/staff")
    assert r.status_code == 200
    staff_list = r.json()
    assert len(staff_list) >= 2, "Need at least 2 staff members"
    staff1 = staff_list[0]
    staff2 = staff_list[1]

    # Setup unique future historical dates to prevent collisions
    date1 = f"2029-{ts % 12 + 1:02d}-10"
    date2 = f"2029-{ts % 12 + 1:02d}-11"
    date3 = f"2029-{ts % 12 + 1:02d}-12"
    date_salem = f"2029-{ts % 12 + 1:02d}-15"
    from_date = f"2029-{ts % 12 + 1:02d}-01"
    to_date = f"2029-{ts % 12 + 1:02d}-28"

    # Day 1: Erode -> 2 Staff (8 vehicles + 6 vehicles = 14), Bill = 8500, Paid = 8500 (Fully Paid)
    r = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-staff", json={
        "staffId": staff1["id"],
        "date": date1,
        "vehiclesAttended": 8
    })
    assert r.status_code in (200, 201), f"Day 1 Staff 1 failed: {r.text}"
    r = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-staff", json={
        "staffId": staff2["id"],
        "date": date1,
        "vehiclesAttended": 6
    })
    assert r.status_code in (200, 201), f"Day 1 Staff 2 failed: {r.text}"
    r = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill?date={date1}", json={
        "amount": 8500.0,
        "notes": "Day 1 full bill"
    })
    assert r.status_code == 200, f"Day 1 Bill failed: {r.text}"
    r = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill/payments?date={date1}", json={
        "amount": 8500.0,
        "paymentMethod": "UPI",
        "reference": "UPI-DAY1"
    })
    assert r.status_code == 200, f"Day 1 Payment failed: {r.text}"

    # Day 2: Erode -> 1 Staff (10 vehicles), Bill = 10000, Paid = 5000 (Partially Paid) + 2000 (Voided)
    r = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-staff", json={
        "staffId": staff1["id"],
        "date": date2,
        "vehiclesAttended": 10
    })
    assert r.status_code in (200, 201), f"Day 2 Staff 1 failed: {r.text}"
    r = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill?date={date2}", json={
        "amount": 10000.0,
        "notes": "Day 2 partial bill"
    })
    assert r.status_code == 200, f"Day 2 Bill failed: {r.text}"
    r = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill/payments?date={date2}", json={
        "amount": 5000.0,
        "paymentMethod": "Cash"
    })
    assert r.status_code == 200, f"Day 2 Payment failed: {r.text}"

    # Record and void 2000 INR on Day 2
    r_void = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill/payments?date={date2}", json={
        "amount": 2000.0,
        "paymentMethod": "BankTransfer",
        "reference": "TXN-VOID"
    })
    assert r_void.status_code == 200
    bill_data = r_void.json()
    void_txn = next((p for p in bill_data["payments"] if p.get("reference") == "TXN-VOID"), None)
    assert void_txn is not None
    r_del = requests.delete(f"{BASE_URL}/showroom-payments/{void_txn['id']}")
    assert r_del.status_code in (200, 204), f"Delete payment failed: {r_del.status_code}"
    print("[*] Recorded 5000 valid + 2000 voided payment on Day 2")

    # Day 3: Erode -> 2 Staff (5 + 7 = 12 vehicles), Bill = 12000, Paid = 0 (Unpaid)
    r = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-staff", json={
        "staffId": staff1["id"],
        "date": date3,
        "vehiclesAttended": 5
    })
    assert r.status_code in (200, 201), f"Day 3 Staff 1 failed: {r.text}"
    r = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-staff", json={
        "staffId": staff2["id"],
        "date": date3,
        "vehiclesAttended": 7
    })
    assert r.status_code in (200, 201), f"Day 3 Staff 2 failed: {r.text}"
    r = requests.post(f"{BASE_URL}/showrooms/{erode_id}/daily-bill?date={date3}", json={
        "amount": 12000.0,
        "notes": "Day 3 unpaid bill"
    })
    assert r.status_code == 200, f"Day 3 Bill failed: {r.text}"

    # Salem Showroom -> date_salem
    r = requests.post(f"{BASE_URL}/showrooms/{salem_id}/daily-staff", json={
        "staffId": staff2["id"],
        "date": date_salem,
        "vehiclesAttended": 18
    })
    assert r.status_code in (200, 201), f"Salem staff failed: {r.text}"
    r = requests.post(f"{BASE_URL}/showrooms/{salem_id}/daily-bill?date={date_salem}", json={
        "amount": 15000.0,
        "notes": "Salem bill"
    })
    assert r.status_code == 200
    r = requests.post(f"{BASE_URL}/showrooms/{salem_id}/daily-bill/payments?date={date_salem}", json={
        "amount": 15000.0,
        "paymentMethod": "Card"
    })
    assert r.status_code == 200

    print("[*] Running assertions on Erode Showroom Summary...")

    # TEST A: Get Showroom Summary Range
    r = requests.get(f"{BASE_URL}/showrooms/{erode_id}/summary?fromDate={from_date}&toDate={to_date}")
    assert r.status_code == 200, f"Summary endpoint failed: {r.text}"
    summary = r.json()
    assert summary["showroomId"] == erode_id
    assert summary["totalDaysWithActivity"] == 3
    assert len(summary["dailyHistory"]) == 3
    print("[+] TEST A PASSED: Summary returned exactly 3 active days")

    row1 = next((r for r in summary["dailyHistory"] if r["date"].startswith(date1)), None)
    row2 = next((r for r in summary["dailyHistory"] if r["date"].startswith(date2)), None)
    row3 = next((r for r in summary["dailyHistory"] if r["date"].startswith(date3)), None)

    # TEST B: Total vehicles per row and summary
    assert row1["totalVehicles"] == 14
    assert row2["totalVehicles"] == 10
    assert row3["totalVehicles"] == 12
    assert summary["totalVehiclesAttended"] == 36 # 14 + 10 + 12
    assert summary["averageVehiclesPerDay"] == 12.0 # 36 / 3
    print("[+] TEST B PASSED: Total vehicles equals sum of staff assignments (36 vehicles, 12.0/day)")

    # TEST C: Total billed equals sum of ShowroomDailyBill.Amount
    assert row1["billedAmount"] == 8500.0
    assert row2["billedAmount"] == 10000.0
    assert row3["billedAmount"] == 12000.0
    assert summary["totalBilled"] == 30500.0
    print("[+] TEST C PASSED: Total billed equals 30,500.00 INR")

    # TEST D: Total received excludes voided payments
    assert row1["receivedAmount"] == 8500.0
    assert row2["receivedAmount"] == 5000.0 # 2000 voided payment excluded!
    assert row3["receivedAmount"] == 0.0
    assert summary["totalReceived"] == 13500.0 # 8500 + 5000
    print("[+] TEST D PASSED: Total received is 13,500.00 INR (voided payment excluded)")

    # TEST E: Outstanding equals Total Billed - Total Received
    assert row1["balanceAmount"] == 0.0
    assert row2["balanceAmount"] == 5000.0
    assert row3["balanceAmount"] == 12000.0
    assert summary["outstandingAmount"] == 17000.0 # 30500 - 13500
    print("[+] TEST E PASSED: Outstanding equals 17,000.00 INR")

    # TEST F, G, H: Payment Status breakdown
    assert row1["status"] == "Paid"
    assert row2["status"] == "PartiallyPaid"
    assert row3["status"] == "Unpaid"
    assert summary["paidDaysCount"] == 1
    assert summary["partiallyPaidDaysCount"] == 1
    assert summary["unpaidDaysCount"] == 1
    print("[+] TEST F, G, H PASSED: Payment status breakdown (1 Paid, 1 Partially Paid, 1 Unpaid)")

    # TEST J: Staff Productivity
    prod = summary["staffProductivity"]
    assert len(prod) == 2
    s1_prod = next((p for p in prod if p["staffId"] == staff1["id"]), None)
    s2_prod = next((p for p in prod if p["staffId"] == staff2["id"]), None)
    assert s1_prod is not None
    assert s2_prod is not None
    # Staff 1: 8 (Day 1) + 10 (Day 2) + 5 (Day 3) = 23 vehicles across 3 days
    assert s1_prod["totalVehiclesAttended"] == 23
    assert s1_prod["daysAssigned"] == 3
    assert s1_prod["averageVehiclesPerDay"] == 7.7
    # Staff 2: 6 (Day 1) + 7 (Day 3) = 13 vehicles across 2 days
    assert s2_prod["totalVehiclesAttended"] == 13
    assert s2_prod["daysAssigned"] == 2
    assert s2_prod["averageVehiclesPerDay"] == 6.5
    print("[+] TEST J PASSED: Staff productivity metrics verified")

    # TEST K: Showroom Isolation
    r_salem = requests.get(f"{BASE_URL}/showrooms/{salem_id}/summary?fromDate={from_date}&toDate={to_date}")
    assert r_salem.status_code == 200
    salem_summary = r_salem.json()
    assert salem_summary["totalBilled"] == 15000.0
    assert salem_summary["totalReceived"] == 15000.0
    assert salem_summary["outstandingAmount"] == 0.0
    assert salem_summary["totalVehiclesAttended"] == 18
    print("[+] TEST K PASSED: Erode data and Salem data remain strictly isolated")

    # TEST L: Overall Showrooms Outstanding
    r_out = requests.get(f"{BASE_URL}/showrooms/outstanding?fromDate={from_date}&toDate={to_date}")
    assert r_out.status_code == 200
    out_list = r_out.json()
    erode_out = next((o for o in out_list if o["showroomId"] == erode_id), None)
    salem_out = next((o for o in out_list if o["showroomId"] == salem_id), None)
    assert erode_out is not None
    assert erode_out["outstandingAmount"] == 17000.0
    assert erode_out["unpaidDaysCount"] == 2 # Day 2 (Partial) + Day 3 (Unpaid)
    assert salem_out is not None
    assert salem_out["outstandingAmount"] == 0.0
    assert salem_out["unpaidDaysCount"] == 0
    print("[+] TEST L PASSED: Overall Showrooms Outstanding Overview verified")

    print("\n=======================================================")
    print("  ALL STEP 3 TESTS PASSED PERFECTLY (12/12 SUCCESS)    ")
    print("=======================================================")

if __name__ == "__main__":
    test_showroom_step3()

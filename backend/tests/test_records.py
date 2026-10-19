def test_list_claims(client):
    claims = client.get("/api/claims").json()
    assert len(claims) == 25
    assert {claim["status"] for claim in claims} == {"waiting"}
    first = claims[0]
    assert first["claim_id"] == "CLM-1001"
    assert first["customer_name"] == "Maya Patel"
    assert first["decision"] is None
    assert first["paid_amount"] is None


def test_get_claim(client):
    claim = client.get("/api/claims/CLM-1001").json()
    assert claim["policy_id"] == "POL-2001"
    assert len(claim["items"]) == 3
    assert len(claim["documents"]) == 4
    assert claim["story"].startswith("My flight home from Rome")
    assert claim["reason"] is None
    assert claim["signed_off_by"] is None


def test_get_claim_unknown(client):
    response = client.get("/api/claims/CLM-9999")
    assert response.status_code == 404
    assert response.json() == {"detail": "claim CLM-9999 not found"}


def test_get_policy(client):
    policy = client.get("/api/policies/POL-2001").json()
    assert policy["plan"]["plan"] == "premium"
    assert policy["plan"]["per_item_limit"] == 300
    assert policy["plan"]["deductible"] == 50
    assert policy["add_ons"] == []
    assert policy["trip"]["destination"] == "Rome, Italy"
    assert policy["travelers"] == ["Maya Patel"]


def test_get_policy_unknown(client):
    assert client.get("/api/policies/POL-9999").status_code == 404


def test_claim_history_has_no_contact_details(client):
    history = client.get("/api/customers/CUS-3001/claim-history").json()
    assert [claim["claim_id"] for claim in history["previous_claims"]] == ["CLM-0412"]
    assert set(history) == {"customer_id", "previous_claims"}


def test_claim_history_unknown(client):
    assert client.get("/api/customers/CUS-9999/claim-history").status_code == 404


def test_policy_wording(client):
    text = client.get("/api/policy-wording").json()["text"]
    assert text.startswith("# UnderCover Travel Insurance: Policy Wording")


def test_list_handlers(client):
    handlers = client.get("/api/handlers").json()
    assert [handler["handler_id"] for handler in handlers] == [
        "HND-01",
        "HND-02",
        "HND-03",
    ]
    assert all(handler["can_approve_over_limit"] is True for handler in handlers)

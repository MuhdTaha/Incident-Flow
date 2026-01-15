# backend/tests/test_incidents.py

def test_read_main(client):
  response = client.get("/")
  assert response.status_code == 404 # Since we don't have a root route

def test_create_incident_requires_auth(client):
  # Try to create without a token -> Should fail
  response = client.post(
    "/incidents",
    json={"title": "Test", "description": "Test", "severity": "SEV4"},
  )
  assert response.status_code == 401 # Unauthorized access
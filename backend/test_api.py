"""Quick integration test for the AVL Portal backend API."""
import urllib.request
import json
import sys

BASE = "http://localhost:8000"

def api(method, path, data=None, token=None):
    body = json.dumps(data).encode() if data else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        content = resp.read().decode()
        return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode()
        return e.code, json.loads(content) if content else {}

# 1. Health check
status, body = api("GET", "/")
assert status == 200 and body["status"] == "ok", f"Health check failed: {body}"
print("[PASS] Health check")

# 2. Login as admin
status, body = api("POST", "/api/users/login", {"email": "admin@avl.com", "password": "admin123"})
assert status == 200 and "access_token" in body, f"Admin login failed: {body}"
admin_token = body["access_token"]
print("[PASS] Admin login")

# 3. Get admin profile
status, body = api("GET", "/api/users/me", token=admin_token)
assert status == 200 and body["is_admin"] == True, f"Profile failed: {body}"
print(f"[PASS] Admin profile: {body['email']} (admin={body['is_admin']})")

# 4. Login as employee
status, body = api("POST", "/api/users/login", {"email": "john.doe@avl.com", "password": "password"})
assert status == 200, f"Employee login failed: {body}"
john_token = body["access_token"]
print("[PASS] Employee login (John Doe)")

# 5. Admin: list all users
status, body = api("GET", "/api/admin/users", token=admin_token)
assert status == 200 and len(body) == 3, f"User list failed: {body}"
print(f"[PASS] Admin user list: {len(body)} users")
for u in body:
    print(f"       - {u['email']} | {u['display_name']} | admin={u['is_admin']} | active={u['is_active']}")

# 6. Create a file (as John)
status, body = api("POST", "/api/files", {
    "tool_type": "lmm",
    "name": "Test LMM Project",
    "json_payload": json.dumps({"tasks": [], "project": "test"})
}, token=john_token)
assert status == 201 and body["name"] == "Test LMM Project", f"Create file failed: {body}"
file_id = body["id"]
print(f"[PASS] Created file id={file_id}")

# 7. List John's files
status, body = api("GET", "/api/files", token=john_token)
assert status == 200 and len(body) >= 1, f"List files failed: {body}"
print(f"[PASS] John's files: {len(body)} file(s)")

# 8. Share file with Jane
status, body = api("POST", f"/api/files/{file_id}/share", {
    "target_email": "jane.smith@avl.com"
}, token=john_token)
assert status == 201, f"Share failed: {body}"
assert body.get("message") == "File shared successfully", f"Share response wrong: {body}"
print(f"[PASS] Shared to Jane: {body}")

# 9. Login as Jane and verify she has the shared file
status, body = api("POST", "/api/users/login", {"email": "jane.smith@avl.com", "password": "password"})
jane_token = body["access_token"]
status, body = api("GET", "/api/files", token=jane_token)
assert status == 200 and len(body) >= 1, f"Jane's files failed: {body}"
assert any("(Shared)" in f["name"] for f in body), f"Shared file not in Jane's list: {body}"
print(f"[PASS] Jane has {len(body)} file(s), including shared one")

# 10. Update the file (as John)
status, body = api("PUT", f"/api/files/{file_id}", {
    "name": "Updated Project Name",
    "json_payload": json.dumps({"tasks": [{"id": 1, "name": "Task 1"}]})
}, token=john_token)
assert status == 200 and body["name"] == "Updated Project Name", f"Update failed: {body}"
print(f"[PASS] Updated file name to '{body['name']}'")

# 11. Delete file
status, _ = api("DELETE", f"/api/files/{file_id}", token=john_token)
assert status == 204, f"Delete failed: status={status}"
print(f"[PASS] Deleted file id={file_id}")

print("\n=== ALL 11 TESTS PASSED ===")

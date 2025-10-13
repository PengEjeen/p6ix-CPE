import requests

BASE_URL = "http://127.0.0.1:8000/api/users/"

# 1️⃣ 회원가입
register_data = {
    "username": "testuser",
    "email": "test@test.com",
    "password": "test1234!",
    "company": "롯데건설",
    "department": "기술연구소"
}

print("회원가입 시도 중...")
res = requests.post(BASE_URL + "register/", json=register_data)
print("Status:", res.status_code)
print("Response:", res.json())

import requests

BASE_URL = "http://127.0.0.1:8000/api/users/"

# 로그인
login_data = {
    "username": "testuser",
    "password": "test1234!"
}

print("로그인 시도 중...")
res = requests.post(BASE_URL + "login/", json=login_data)
print("Status:", res.status_code)
print("Response:", res.json())

tokens = res.json()
access_token = tokens.get("access")

# 🔹 Authorization 헤더에 Bearer 토큰 포함
headers = {
    "Authorization": f"Bearer {access_token}"
}

print("\n프로필 조회 시도 중...")
res = requests.get(BASE_URL + "profile/", headers=headers)
print("Status:", res.status_code)
print("Response:", res.json())


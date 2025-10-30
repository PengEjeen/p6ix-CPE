import os
import ast
import importlib.util
import stdlib_list

# === 설정 ===
PROJECT_ROOT = "."  # manage.py 기준
LOCAL_PACKAGES = {"backend", "config", "apps", "cpe_module"}  # 내부 app 이름들 수정 가능
OUTPUT_FILE = "used_requirements.txt"  # 저장 파일 이름

# === 표준 라이브러리 목록 ===
stdlib_modules = set(stdlib_list.stdlib_list("3.10"))

imports = set()

# === 모든 .py 파일 탐색 ===
for root, _, files in os.walk(PROJECT_ROOT):
    if any(skip in root for skip in ("venv", "env", "migrations", "__pycache__")):
        continue
    for file in files:
        if not file.endswith(".py"):
            continue
        path = os.path.join(root, file)
        try:
            with open(path, "r", encoding="utf-8") as f:
                source = f.read()
            node = ast.parse(source)
        except Exception:
            continue

        for n in ast.walk(node):
            if isinstance(n, ast.Import):
                for alias in n.names:
                    imports.add(alias.name.split(".")[0])
            elif isinstance(n, ast.ImportFrom):
                if n.module:
                    imports.add(n.module.split(".")[0])

# === Django / 표준 / 내부 app 제외 ===
SKIP = stdlib_modules | LOCAL_PACKAGES | {
    "django",
    "tests",
    "unittest",
    "typing",
    "pathlib",
    "os",
    "sys",
    "json",
    "re",
    "logging",
    "functools",
    "itertools",
}

external_imports = sorted(i for i in imports if i not in SKIP)

print("📦 외부 라이브러리 사용 목록:")
if not external_imports:
    print("(없음)")
else:
    for lib in external_imports:
        print(f" - {lib}")

# === 버전 확인 + 파일로 저장 ===
lines = []
for lib in external_imports:
    try:
        spec = importlib.util.find_spec(lib)
        if spec is None:
            continue
        module = __import__(lib)
        version = getattr(module, "__version__", None)
        lines.append(f"{lib}=={version or 'latest'}")
    except Exception:
        lines.append(f"{lib}")

# === 파일 저장 ===
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"\n💾 '{OUTPUT_FILE}' 파일로 저장 완료!")

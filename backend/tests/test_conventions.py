from pathlib import Path

from backend.main import app

ROOT = Path(__file__).parent.parent.parent
METHODS = {"get", "post", "put", "patch", "delete"}


def operations():
    for path, item in app.openapi()["paths"].items():
        for method, operation in item.items():
            if method in METHODS:
                yield f"{method.upper()} {path}", operation


def test_every_operation_has_an_id_and_a_one_line_docstring():
    for name, operation in operations():
        assert operation.get("operationId"), name
        assert operation.get("description"), name
        assert "\n" not in operation["description"], name


def test_no_operation_has_an_optional_input():
    schemas = app.openapi()["components"]["schemas"]
    for name, operation in operations():
        for parameter in operation.get("parameters", []):
            assert parameter["required"], f"{name}: {parameter['name']}"
        content = operation.get("requestBody", {}).get("content", {})
        for media in content.values():
            schema = schemas[media["schema"]["$ref"].rsplit("/", 1)[1]]
            assert set(schema["properties"]) == set(schema["required"]), name


def test_the_agent_and_the_backend_never_mention_the_answer_key():
    sources = [
        path
        for folder in ("backend", "agent")
        for path in (ROOT / folder).rglob("*")
        if path.suffix in {".py", ".md"} and "tests" not in path.parts
    ]
    assert sources
    for path in sources:
        assert "evals" not in path.read_text(encoding="utf-8").lower(), path

import asyncio

import httpx

from backend.main import app


def test_many_requests_at_once(client):
    async def fetch_all():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as http:
            paths = ["/api/claims/CLM-1001", "/api/claims", "/api/handlers"] * 30
            return await asyncio.gather(*(http.get(path) for path in paths))

    statuses = {response.status_code for response in asyncio.run(fetch_all())}
    assert statuses == {200}

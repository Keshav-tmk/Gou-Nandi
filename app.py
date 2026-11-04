"""Root FastAPI Application Entrypoint.

Exposes the production FastAPI application instance (`app`) from `src/10_api.py`.
Allows running the server directly with:
    python app.py
or:
    uvicorn app:app --reload
"""

from __future__ import annotations
import importlib
import os
import uvicorn

# Import the production FastAPI instance from src.10_api
_api_module = importlib.import_module("src.10_api")
app = _api_module.app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("app:app", host=host, port=port, reload=True)


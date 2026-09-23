from typing import Annotated

import structlog
import uvicorn
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.chat import router as chat_router
from app.auth import AuthenticatedUser, get_current_user
from app.config import settings

logger = structlog.get_logger()

app = FastAPI(
    title="Document Copilot API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(
        "request_validation_failed",
        url=str(request.url),
        method=request.method,
        errors=exc.errors(),
        body=str(exc.body),
    )
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


app.include_router(chat_router)



@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/auth/me")
async def get_me(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> dict[str, str]:
    """Protected route returning the authenticated user's profile."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
    }


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

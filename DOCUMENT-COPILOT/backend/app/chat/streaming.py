from __future__ import annotations

import json
from typing import Any

DATA_STREAM_HEADERS: dict[str, str] = {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Vercel-AI-Data-Stream": "v1",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
}


def format_data_stream_text(delta: str) -> str:
    """Format a text delta according to the Vercel AI SDK Data Stream Protocol.

    Part type '0' designates text parts.
    """
    return f"0:{json.dumps(delta)}\n"


def format_data_stream_data(data: Any) -> str:
    """Format custom data parts according to the Vercel AI SDK Data Stream Protocol.

    Part type '2' designates arbitrary JSON data arrays/objects.
    """
    return f"2:{json.dumps(data)}\n"


def format_data_stream_error(error_message: str) -> str:
    """Format an error message according to the Vercel AI SDK Data Stream Protocol.

    Part type '3' designates error parts.
    """
    return f"3:{json.dumps(error_message)}\n"


def format_data_stream_finish(reason: str = "stop") -> str:
    """Format finish message event.

    Part type 'd' designates finish message metadata.
    """
    finish_obj = {
        "finishReason": reason,
        "usage": {"promptTokens": 0, "completionTokens": 0},
    }
    return f"d:{json.dumps(finish_obj)}\n"

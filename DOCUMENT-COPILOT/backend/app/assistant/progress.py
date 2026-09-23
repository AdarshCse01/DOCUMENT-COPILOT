"""Progress logging utilities for Document Copilot assistant runs."""

from __future__ import annotations

import logging
import sys


def setup_progress_logging(level: int = logging.INFO) -> logging.Logger:
    """Configure real-time timestamped stdout logging for CLI and Jupyter environments."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )
    logger = logging.getLogger("document_copilot")
    logger.setLevel(level)
    return logger

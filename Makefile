.PHONY: dev test lint seed

dev:
	python -m uvicorn backend.main:app --reload --port 8010

test:
	pytest tests/ -v

lint:
	ruff check backend/ tests/

seed:
	python seed_demo.py

# Makefile for IncidentFlow

# Variables
DC = docker-compose
BACKEND_CONTAINER = incidentflow-backend
FRONTEND_CONTAINER = incidentflow-frontend
DB_CONTAINER = incidentflow-db

.PHONY: help up down restart logs test test-backend test-frontend test-e2e migrate migration db-shell shell-backend

# --- 🚀 Main Commands ---

help: ## Show this help message
	@echo "Usage: make [command]"
	@echo ""
	@echo "Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

up: ## Start the entire stack
	$(DC) up

up-b: ## Start stack in build mode (rebuilds images)
	$(DC) up --build

down: ## Stop and remove all containers
	$(DC) down

restart: ## Restart all containers
	$(DC) restart

logs: ## Follow logs for all containers
	$(DC) logs -f

# --- 🧪 Testing ---

test: test-backend test-frontend ## Run all unit tests (Backend + Frontend)

test-backend: ## Run Python backend tests (Pytest)
	$(DC) exec backend pytest

test-frontend: ## Run Frontend unit tests (Jest)
	$(DC) exec frontend npm run test:unit

test-e2e: ## Run Playwright E2E tests (Runs locally against Docker)
	cd frontend && npx playwright test

# --- 🗄️ Database & Migrations ---

migrate: ## Apply pending Alembic migrations to the DB
	$(DC) exec backend alembic upgrade head

migration: ## Create a new migration file. Usage: make migration msg="my_change"
	@if [ -z "$(msg)" ]; then echo "Error: msg is required. Usage: make migration msg='description'"; exit 1; fi
	$(DC) exec backend alembic revision --autogenerate -m "$(msg)"

db-shell: ## Open a PSQL shell inside the database container
	$(DC) exec db psql -U postgres -d incidentflow

# --- 🛠️ Utilities ---

shell-backend: ## Open a Bash shell inside the Backend container
	$(DC) exec backend bash

shell-frontend: ## Open a Sh shell inside the Frontend container
	$(DC) exec frontend sh

clean: ## Remove all stopped containers, networks, and volumes (Caution!)
	$(DC) down -v
	docker system prune -f
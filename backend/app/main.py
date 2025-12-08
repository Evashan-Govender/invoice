from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth_router, invoices_router
from .routers.integrations import router as integrations_router
from .routers.settings import router as settings_router
from .services.background_tasks import start_background_tasks, stop_background_tasks
from .migrations import run_migrations
import os

# Create database tables
Base.metadata.create_all(bind=engine)

# Run migrations for new columns on existing tables
run_migrations(engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown"""
    # Startup
    start_background_tasks()
    yield
    # Shutdown
    stop_background_tasks()

# Create FastAPI app
app = FastAPI(
    title="Invoice AI API",
    description="AI-powered invoice data extraction system",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
# Get allowed origins from environment variable or use defaults
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    # Split comma-separated origins from environment variable
    allowed_origins = [origin.strip() for origin in cors_origins_env.split(",")]
else:
    # Default origins: localhost and the specified IP
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost",
        "http://20.157.84.59",
        "http://20.157.84.59:80",
        "http://20.157.84.59:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(invoices_router)
app.include_router(integrations_router)
app.include_router(settings_router)

@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "Invoice AI API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


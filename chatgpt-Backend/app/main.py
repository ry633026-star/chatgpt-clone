from fastapi import FastAPI

from app.routers.auth import router as auth_router
from fastapi.middleware.cors import CORSMiddleware
from app.routers.chat import router as chat_router


app = FastAPI(
    title="ChatGPT Clone API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


app.include_router(auth_router)
app.include_router(chat_router)


@app.get("/")
def root():
    return {"message": "ChatGPT Clone API is running"}

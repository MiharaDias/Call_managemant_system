from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import User
from ..schemas import LoginIn, PasswordIn, UserOut
from ..security import COOKIE, current_user, hash_password, make_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Hash used to keep login timing similar when the username does not exist.
_DUMMY_HASH = hash_password("not-a-real-password")


@router.post("/login", response_model=UserOut)
def login(data: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == data.username.strip().lower()))
    ok = verify_password(data.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(401, "Wrong username or password")
    response.set_cookie(
        COOKIE, make_token(user.id), httponly=True, samesite="lax",
        secure=settings.cookie_secure, max_age=settings.session_days * 86400,
    )
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.get("/users", response_model=list[UserOut])
def users(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return db.scalars(select(User).order_by(User.id)).all()


@router.post("/password")
def change_password(data: PasswordIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Current password is wrong")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"ok": True}

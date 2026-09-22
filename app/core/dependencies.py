from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import SECRET_KEY, ALGORITHM
from app.models.user import User, UserRole

# Standard OAuth2 Bearer token extractor
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency that decodes the bearer JWT, validates integrity and expiration,
    and queries PostgreSQL for the real user entity.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise credentials_exception
        user_id = int(user_id_raw)
    except (JWTError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        raise credentials_exception

    # Hierarchical Security Check:
    # If the user is an assistant/staff, verify that their parent studio/photographer account is also active
    # AND that the parent studio is on the 'studio' plan tier.
    if user.parent_id is not None:
        parent_user = db.query(User).filter(User.id == user.parent_id).first()
        if parent_user is None or not parent_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Studio account has been suspended by an administrator. Please contact your studio owner.",
            )
        parent_plan = (getattr(parent_user, "subscription_plan", "basic") or "basic").lower()
        if parent_plan != "studio":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Studio assistant access is disabled because the parent account is on the Basic plan. Studio tier required.",
            )

    return user

def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency enforcing that the authenticated user possesses the ADMIN role.
    """
    user_role = str(getattr(current_user, "role", "") or "").lower()
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privileges required."
        )
    return current_user

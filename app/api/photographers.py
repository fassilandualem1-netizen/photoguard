import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.schemas.photographer import SocialLinksUpdate, SocialLinksResponse

logger = logging.getLogger("photoguard.photographers")

router = APIRouter(prefix="/api/v1/photographers", tags=["Photographers Profile"])

def get_target_photographer(current_user: User, db: Session) -> User:
    """
    Resolves the target photographer record.
    If the current user is an assistant, updates route to the main studio owner.
    """
    if current_user.parent_id is not None or str(getattr(current_user, "role", "")).lower() == UserRole.ASSISTANT.value:
        owner = db.query(User).filter(User.id == current_user.effective_owner_id).first()
        return owner or current_user
    return current_user

@router.get("/me/social-links", response_model=SocialLinksResponse, status_code=status.HTTP_200_OK)
@router.get("/me/social-links/", response_model=SocialLinksResponse, status_code=status.HTTP_200_OK)
def get_photographer_social_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches social links for the authenticated photographer or studio.
    """
    target = get_target_photographer(current_user, db)
    return SocialLinksResponse(
        contact_phone=target.contact_phone,
        tiktok_url=target.tiktok_url,
        instagram_url=target.instagram_url,
        telegram_url=target.telegram_url,
        youtube_url=target.youtube_url,
        message="Social links retrieved successfully."
    )

@router.put("/me/social-links", response_model=SocialLinksResponse, status_code=status.HTTP_200_OK)
@router.put("/me/social-links/", response_model=SocialLinksResponse, status_code=status.HTTP_200_OK)
def update_photographer_social_links(
    payload: SocialLinksUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates social links (contact_phone, tiktok_url, instagram_url, telegram_url, youtube_url)
    for the authenticated photographer or root studio.
    """
    target = get_target_photographer(current_user, db)

    try:
        if payload.contact_phone is not None:
            target.contact_phone = payload.contact_phone.strip() if payload.contact_phone.strip() else None
        if payload.tiktok_url is not None:
            target.tiktok_url = payload.tiktok_url.strip() if payload.tiktok_url.strip() else None
        if payload.instagram_url is not None:
            target.instagram_url = payload.instagram_url.strip() if payload.instagram_url.strip() else None
        if payload.telegram_url is not None:
            target.telegram_url = payload.telegram_url.strip() if payload.telegram_url.strip() else None
        if payload.youtube_url is not None:
            target.youtube_url = payload.youtube_url.strip() if payload.youtube_url.strip() else None

        db.commit()
        db.refresh(target)

        return SocialLinksResponse(
            contact_phone=target.contact_phone,
            tiktok_url=target.tiktok_url,
            instagram_url=target.instagram_url,
            telegram_url=target.telegram_url,
            youtube_url=target.youtube_url,
            message="Social links updated successfully."
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"Database error updating social links: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error updating social links: {str(exc)}"
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"Unexpected error updating social links: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error updating social links: {str(exc)}"
        )

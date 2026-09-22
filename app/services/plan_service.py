from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.plan_config import PlanConfiguration

DEFAULT_PLAN_LIMITS: Dict[str, dict] = {
    "basic": {
        "storage_quota_bytes": 5368709120,    # 5 GB
        "default_lifespan_days": 7,
        "max_lifespan_days": 7,
        "can_enable_downloads": False,
        "can_customize_branding": False,
        "can_extend_lifespan": False,
    },
    "studio": {
        "storage_quota_bytes": 26843545600,  # 25 GB
        "default_lifespan_days": 30,
        "max_lifespan_days": 365,
        "can_enable_downloads": True,
        "can_customize_branding": True,
        "can_extend_lifespan": True,
    }
}

def get_or_create_plan_config(db: Session, plan_name: str) -> PlanConfiguration:
    """
    Retrieves the PlanConfiguration for 'basic' or 'studio'.
    If missing, automatically seeds it from DEFAULT_PLAN_LIMITS.
    """
    normalized = plan_name.lower().strip() if plan_name else "basic"
    if normalized not in DEFAULT_PLAN_LIMITS:
        normalized = "basic"

    cfg = db.query(PlanConfiguration).filter(PlanConfiguration.plan_name == normalized).first()
    if not cfg:
        defaults = DEFAULT_PLAN_LIMITS[normalized]
        cfg = PlanConfiguration(
            plan_name=normalized,
            storage_quota_bytes=defaults["storage_quota_bytes"],
            default_lifespan_days=defaults["default_lifespan_days"],
            max_lifespan_days=defaults["max_lifespan_days"],
            can_enable_downloads=defaults["can_enable_downloads"],
            can_customize_branding=defaults["can_customize_branding"],
            can_extend_lifespan=defaults["can_extend_lifespan"],
        )
        try:
            db.add(cfg)
            db.commit()
            db.refresh(cfg)
        except Exception:
            db.rollback()
            # If concurrent creation occurred
            cfg = db.query(PlanConfiguration).filter(PlanConfiguration.plan_name == normalized).first()
            if not cfg:
                return PlanConfiguration(
                    plan_name=normalized,
                    **defaults
                )
    return cfg

def get_all_plan_configs(db: Session) -> List[PlanConfiguration]:
    """
    Ensures both Basic and Studio plan configs are instantiated and returns them.
    """
    basic_cfg = get_or_create_plan_config(db, "basic")
    studio_cfg = get_or_create_plan_config(db, "studio")
    return [basic_cfg, studio_cfg]

import logging
import sys
import json
import os
from datetime import datetime

class JSONAuditFormatter(logging.Formatter):
    """Custom JSON formatter for the server-side audit logging system."""
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "audit_data"):
            log_record["audit_data"] = record.audit_data
        return json.dumps(log_record)

def setup_logger():
    logger = logging.getLogger("PhotoGuard_Core")
    logger.setLevel(logging.DEBUG)
    
    if not logger.handlers:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        
        # Ensure log directory exists
        os.makedirs("logs", exist_ok=True)
        file_handler = logging.FileHandler(f"logs/photoguard_core_{datetime.now().strftime('%Y%m')}.log")
        file_handler.setLevel(logging.DEBUG)
        
        formatter = logging.Formatter('%(asctime)s | %(levelname)-8s | [%(filename)s:%(lineno)d] | %(message)s')
        console_handler.setFormatter(formatter)
        file_handler.setFormatter(formatter)
        
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)
        
    return logger

def setup_audit_logger():
    """Dedicated unified logger for tracking storage persistence and security events."""
    logger = logging.getLogger("PhotoGuard_StorageAudit")
    logger.setLevel(logging.INFO)
    
    if not logger.handlers:
        os.makedirs("logs", exist_ok=True)
        file_handler = logging.FileHandler(f"logs/storage_audit_{datetime.now().strftime('%Y%m%d')}.json")
        file_handler.setFormatter(JSONAuditFormatter())
        logger.addHandler(file_handler)
        
        # Also print to console for Render logging
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(JSONAuditFormatter())
        logger.addHandler(console_handler)

    return logger

log = setup_logger()
audit_log = setup_audit_logger()

"""add missing performance indexes

Revision ID: 20260929_perf_indexes
Revises: 20260929_brand_accent
Create Date: 2026-09-29 18:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260929_perf_indexes'
down_revision: Union[str, None] = '20260929_brand_accent'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 1. Indexes on payment_receipts
    if insp.has_table('payment_receipts'):
        existing_indexes = [idx['name'] for idx in insp.get_indexes('payment_receipts')]
        if 'ix_payment_receipts_photographer_id' not in existing_indexes:
            op.create_index('ix_payment_receipts_photographer_id', 'payment_receipts', ['photographer_id'])
        if 'ix_payment_receipts_status' not in existing_indexes:
            op.create_index('ix_payment_receipts_status', 'payment_receipts', ['status'])

    # 2. Indexes on albums
    if insp.has_table('albums'):
        existing_indexes = [idx['name'] for idx in insp.get_indexes('albums')]
        if 'ix_albums_expires_at' not in existing_indexes:
            op.create_index('ix_albums_expires_at', 'albums', ['expires_at'])
        if 'ix_albums_submitted_at' not in existing_indexes:
            op.create_index('ix_albums_submitted_at', 'albums', ['submitted_at'])

    # 3. Index on users
    if insp.has_table('users'):
        existing_indexes = [idx['name'] for idx in insp.get_indexes('users')]
        if 'ix_users_role' not in existing_indexes:
            op.create_index('ix_users_role', 'users', ['role'])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if insp.has_table('users'):
        existing_indexes = [idx['name'] for idx in insp.get_indexes('users')]
        if 'ix_users_role' in existing_indexes:
            op.drop_index('ix_users_role', table_name='users')

    if insp.has_table('albums'):
        existing_indexes = [idx['name'] for idx in insp.get_indexes('albums')]
        if 'ix_albums_submitted_at' in existing_indexes:
            op.drop_index('ix_albums_submitted_at', table_name='albums')
        if 'ix_albums_expires_at' in existing_indexes:
            op.drop_index('ix_albums_expires_at', table_name='albums')

    if insp.has_table('payment_receipts'):
        existing_indexes = [idx['name'] for idx in insp.get_indexes('payment_receipts')]
        if 'ix_payment_receipts_status' in existing_indexes:
            op.drop_index('ix_payment_receipts_status', table_name='payment_receipts')
        if 'ix_payment_receipts_photographer_id' in existing_indexes:
            op.drop_index('ix_payment_receipts_photographer_id', table_name='payment_receipts')

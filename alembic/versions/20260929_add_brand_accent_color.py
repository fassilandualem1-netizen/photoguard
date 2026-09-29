"""add brand_accent_color to users and albums

Revision ID: 20260929_brand_accent
Revises: 
Create Date: 2026-09-29 17:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260929_brand_accent'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    
    # 1. users table: brand_accent_color
    user_columns = [c['name'] for c in insp.get_columns('users')] if insp.has_table('users') else []
    if 'brand_accent_color' not in user_columns and insp.has_table('users'):
        op.add_column(
            'users',
            sa.Column('brand_accent_color', sa.String(length=50), nullable=True, server_default='#D97706')
        )

    # 2. albums table: brand_accent_color
    album_columns = [c['name'] for c in insp.get_columns('albums')] if insp.has_table('albums') else []
    if 'brand_accent_color' not in album_columns and insp.has_table('albums'):
        op.add_column(
            'albums',
            sa.Column('brand_accent_color', sa.String(length=50), nullable=True, server_default='#D97706')
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if insp.has_table('albums'):
        album_columns = [c['name'] for c in insp.get_columns('albums')]
        if 'brand_accent_color' in album_columns:
            op.drop_column('albums', 'brand_accent_color')

    if insp.has_table('users'):
        user_columns = [c['name'] for c in insp.get_columns('users')]
        if 'brand_accent_color' in user_columns:
            op.drop_column('users', 'brand_accent_color')

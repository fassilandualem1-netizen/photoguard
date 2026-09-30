"""add high priority compound indexes

Revision ID: 20260930_compound_indexes
Revises: 20260929_perf_indexes
Create Date: 2026-09-30 16:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260930_compound_indexes'
down_revision: Union[str, None] = '20260929_perf_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 1. Compound index on media_items(album_id, is_selected)
    if insp.has_table('media_items'):
        existing_indexes = [idx['name'] for idx in insp.get_indexes('media_items')]
        if 'ix_media_items_album_selected' not in existing_indexes:
            op.create_index(
                'ix_media_items_album_selected',
                'media_items',
                ['album_id', 'is_selected']
            )

    # 2. Compound index on albums(photographer_id, created_at)
    if insp.has_table('albums'):
        existing_indexes = [idx['name'] for idx in insp.get_indexes('albums')]
        if 'ix_albums_photographer_created' not in existing_indexes:
            op.create_index(
                'ix_albums_photographer_created',
                'albums',
                ['photographer_id', 'created_at']
            )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if insp.has_table('albums'):
        existing_indexes = [idx['name'] for idx in insp.get_indexes('albums')]
        if 'ix_albums_photographer_created' in existing_indexes:
            op.drop_index('ix_albums_photographer_created', table_name='albums')

    if insp.has_table('media_items'):
        existing_indexes = [idx['name'] for idx in insp.get_indexes('media_items')]
        if 'ix_media_items_album_selected' in existing_indexes:
            op.drop_index('ix_media_items_album_selected', table_name='media_items')

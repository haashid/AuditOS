"""add_jira_sync_to_findings

Revision ID: a1b2c3d4e5f6
Revises: e1bd50048ee7
Create Date: 2026-06-23

Adds jira_issue_key and jira_issue_url nullable columns to the
findings table to support the Jira Finding Sync connector (Part C
of the Final Build PRD). Both columns are nullable — existing
findings are unaffected and show null until explicitly pushed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e1bd50048ee7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add Jira sync columns to the findings table.
    # Both are nullable — no default needed; existing rows get NULL.
    op.add_column('findings',
        sa.Column('jira_issue_key', sa.String(50), nullable=True)
    )
    op.add_column('findings',
        sa.Column('jira_issue_url', sa.String(500), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('findings', 'jira_issue_url')
    op.drop_column('findings', 'jira_issue_key')

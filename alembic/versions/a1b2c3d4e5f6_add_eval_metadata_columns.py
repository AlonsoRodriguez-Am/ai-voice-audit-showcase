"""add eval metadata columns

Revision ID: a1b2c3d4e5f6
Revises: 8254e30078c7
Create Date: 2026-05-17 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '4411adc244ca'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Unique human-readable call UID (e.g. AUD-20260517-00142)
    op.add_column('evaluations',
        sa.Column('eval_call_uid', sa.String(64), nullable=True)
    )
    # LLM model name used for this evaluation
    op.add_column('evaluations',
        sa.Column('eval_model', sa.String(128), nullable=True)
    )
    # LLM provider used (ollama, openai, gemini, etc.)
    op.add_column('evaluations',
        sa.Column('eval_provider', sa.String(64), nullable=True)
    )
    # Full LLM params snapshot (temperature, ctx_size, top_p, etc.)
    op.add_column('evaluations',
        sa.Column('eval_params_json', JSONB, nullable=True)
    )
    # When the task was queued/started
    op.add_column('evaluations',
        sa.Column('eval_started_at', sa.TIMESTAMP, nullable=True)
    )
    # Partial transcript saved after STT step for checkpoint resume
    op.add_column('evaluations',
        sa.Column('partial_transcript', sa.Text, nullable=True)
    )
    # call_summary already exists in some installations, guard
    # (only add if not present — handled by try/except in task)


def downgrade() -> None:
    op.drop_column('evaluations', 'partial_transcript')
    op.drop_column('evaluations', 'eval_started_at')
    op.drop_column('evaluations', 'eval_params_json')
    op.drop_column('evaluations', 'eval_provider')
    op.drop_column('evaluations', 'eval_model')
    op.drop_column('evaluations', 'eval_call_uid')

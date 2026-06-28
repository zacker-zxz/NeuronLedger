"""
NeuronLedger — Database setup with SQLAlchemy + SQLite
"""

from sqlalchemy import create_engine, Column, String, Float, Text, Integer, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./neuronledger.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── DB Models ────────────────────────────────────────────────────────────────

class GraphModel(Base):
    __tablename__ = "graphs"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    node_count = Column(Integer, default=0)
    edge_count = Column(Integer, default=0)
    graph_data = Column(Text, nullable=False)   # JSON serialized graph
    created_at = Column(DateTime, default=datetime.utcnow)


class InferenceModel(Base):
    __tablename__ = "inferences"

    id = Column(String, primary_key=True)
    graph_id = Column(String, nullable=False)
    inference_type = Column(String, nullable=False)  # anomaly | cluster | trust | full
    result_data = Column(Text, nullable=False)        # JSON
    confidence = Column(Float, default=0.0)
    anomaly_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class LedgerEntryModel(Base):
    __tablename__ = "ledger"

    id = Column(String, primary_key=True)
    entry_index = Column(Integer, nullable=False)
    inference_id = Column(String, nullable=False)
    graph_id = Column(String, nullable=False)
    timestamp = Column(String, nullable=False)
    graph_state_hash = Column(String, nullable=False)
    input_hash = Column(String, nullable=False)
    output_hash = Column(String, nullable=False)
    model_version = Column(String, default="1.0.0")
    previous_hash = Column(String, default="0" * 64)
    merkle_root = Column(String, nullable=False)
    verification_signature = Column(String, nullable=False)
    is_verified = Column(Boolean, default=True)
    blockchain_tx_hash = Column(String, nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)

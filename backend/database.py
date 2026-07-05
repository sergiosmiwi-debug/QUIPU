from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

engine = create_engine(
    "sqlite:///./quipurecicla.db", connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    price: Mapped[float] = mapped_column(Float, default=0.0)
    material: Mapped[str] = mapped_column(String, default="desconocido")
    category: Mapped[str] = mapped_column(String, default="general")
    added_date: Mapped[date] = mapped_column(Date, default=date.today)
    expiry_date: Mapped[date] = mapped_column(Date)
    shelf_closed: Mapped[int] = mapped_column(Integer, default=365)
    shelf_opened: Mapped[int] = mapped_column(Integer, default=30)
    changes_on_open: Mapped[bool] = mapped_column(Boolean, default=False)
    opened_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class WasteLog(Base):
    __tablename__ = "waste_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[str] = mapped_column(String, index=True)
    product_name: Mapped[str] = mapped_column(String)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    price: Mapped[float] = mapped_column(Float, default=0.0)
    material: Mapped[str] = mapped_column(String, default="desconocido")
    wasted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from datetime import date, datetime, timedelta

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile

load_dotenv()
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Product, WasteLog, get_db
from shelf_life import estimate_price, get_shelf_life
from vision import scan_image

app = FastAPI(title="QuipuRecicla API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Schemas ----------

class ProductIn(BaseModel):
    name: str
    quantity: int = 1
    price: float = 0.0
    material: str = "desconocido"
    category: str = "otros"


# ---------- Helpers ----------

def compute_status(days_left: int) -> str:
    if days_left < 0:
        return "expired"
    if days_left <= 1:
        return "danger"
    if days_left <= 3:
        return "warning"
    return "fresh"


def serialize(p: Product) -> dict:
    days_left = (p.expiry_date - date.today()).days
    return {
        "id": p.id,
        "name": p.name,
        "quantity": p.quantity,
        "price": p.price,
        "material": p.material,
        "category": p.category,
        "added_date": p.added_date.isoformat(),
        "expiry_date": p.expiry_date.isoformat(),
        "opened_date": p.opened_date.isoformat() if p.opened_date else None,
        "shelf_closed": p.shelf_closed,
        "shelf_opened": p.shelf_opened,
        "changes_on_open": p.changes_on_open,
        "days_left": days_left,
        "status": compute_status(days_left),
    }


def require_device(x_device_id: str | None = Header(default=None)) -> str | None:
    return x_device_id


# ---------- Scan (NO guarda en DB: el frontend confirma y hace POST /products) ----------

@app.post("/scan/receipt")
async def scan_receipt(file: UploadFile = File(...)):
    try:
        items = scan_image(await file.read(), "ticket de compra")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error de visión: {e}")
    return {"items": items}


@app.post("/scan/fridge")
async def scan_fridge(file: UploadFile = File(...)):
    try:
        items = scan_image(await file.read(), "foto de refrigeradora o alacena")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error de visión: {e}")
    return {"items": items}


# ---------- Products ----------

@app.get("/products")
def list_products(
    device_id: str | None = Depends(require_device), db: Session = Depends(get_db)
):
    if not device_id:
        return []
    products = (
        db.query(Product)
        .filter(Product.device_id == device_id)
        .order_by(Product.expiry_date)
        .all()
    )
    return [serialize(p) for p in products]


@app.post("/products")
def create_products(
    items: list[ProductIn],
    device_id: str | None = Depends(require_device),
    db: Session = Depends(get_db),
):
    if not device_id:
        raise HTTPException(status_code=400, detail="Falta header X-Device-Id")
    created = []
    for item in items:
        closed, opened = get_shelf_life(item.name)
        price = item.price if item.price > 0 else estimate_price(item.name)
        product = Product(
            device_id=device_id,
            name=item.name,
            quantity=item.quantity,
            price=price,
            material=item.material or "desconocido",
            category=item.category or "otros",
            added_date=date.today(),
            expiry_date=date.today() + timedelta(days=closed),
            shelf_closed=closed,
            shelf_opened=opened,
            changes_on_open=closed != opened,
        )
        db.add(product)
        created.append(product)
    db.commit()
    return [serialize(p) for p in created]


def _get_owned(product_id: int, device_id: str | None, db: Session) -> Product:
    if not device_id:
        raise HTTPException(status_code=400, detail="Falta header X-Device-Id")
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.device_id == device_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@app.post("/products/{product_id}/open")
def open_product(
    product_id: int,
    device_id: str | None = Depends(require_device),
    db: Session = Depends(get_db),
):
    product = _get_owned(product_id, device_id, db)
    product.opened_date = date.today()
    # Recalcula el vencimiento desde la fecha de apertura
    new_expiry = date.today() + timedelta(days=product.shelf_opened)
    product.expiry_date = min(product.expiry_date, new_expiry)
    db.commit()
    return serialize(product)


@app.post("/products/{product_id}/consume")
def consume_product(
    product_id: int,
    device_id: str | None = Depends(require_device),
    db: Session = Depends(get_db),
):
    product = _get_owned(product_id, device_id, db)
    db.delete(product)
    db.commit()
    return {"ok": True}


@app.delete("/products/{product_id}")
def waste_product(
    product_id: int,
    device_id: str | None = Depends(require_device),
    db: Session = Depends(get_db),
):
    product = _get_owned(product_id, device_id, db)
    price = product.price if product.price > 0 else estimate_price(product.name)
    db.add(
        WasteLog(
            device_id=device_id,
            product_name=product.name,
            quantity=product.quantity,
            price=price,
            material=product.material,
            wasted_at=datetime.utcnow(),
        )
    )
    db.delete(product)
    db.commit()
    return {"ok": True}


# ---------- Dashboard ----------

PERIOD_DAYS = {"hoy": 1, "semana": 7, "mes": 30}


@app.get("/dashboard")
def dashboard(
    period: str = "todo",
    device_id: str | None = Depends(require_device),
    db: Session = Depends(get_db),
):
    if not device_id:
        return {"total_lost": 0, "waste": [], "status_counts": {}}

    query = db.query(WasteLog).filter(WasteLog.device_id == device_id)
    if period in PERIOD_DAYS:
        since = datetime.utcnow() - timedelta(days=PERIOD_DAYS[period])
        query = query.filter(WasteLog.wasted_at >= since)
    waste = query.order_by(WasteLog.wasted_at.desc()).all()

    products = db.query(Product).filter(Product.device_id == device_id).all()
    status_counts = {"fresh": 0, "warning": 0, "danger": 0, "expired": 0}
    for p in products:
        status_counts[compute_status((p.expiry_date - date.today()).days)] += 1

    return {
        "total_lost": round(sum(w.price * w.quantity for w in waste), 2),
        "waste": [
            {
                "id": w.id,
                "product_name": w.product_name,
                "quantity": w.quantity,
                "price": w.price,
                "material": w.material,
                "wasted_at": w.wasted_at.isoformat(),
            }
            for w in waste
        ],
        "status_counts": status_counts,
    }


@app.delete("/dashboard/waste/{waste_id}")
def delete_waste(
    waste_id: int,
    device_id: str | None = Depends(require_device),
    db: Session = Depends(get_db),
):
    if not device_id:
        raise HTTPException(status_code=400, detail="Falta header X-Device-Id")
    entry = (
        db.query(WasteLog)
        .filter(WasteLog.id == waste_id, WasteLog.device_id == device_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    db.delete(entry)
    db.commit()
    return {"ok": True}


@app.delete("/dashboard/reset")
def reset_waste(
    device_id: str | None = Depends(require_device),
    db: Session = Depends(get_db),
):
    if not device_id:
        raise HTTPException(status_code=400, detail="Falta header X-Device-Id")
    db.query(WasteLog).filter(WasteLog.device_id == device_id).delete()
    db.commit()
    return {"ok": True}


@app.get("/")
def health():
    return {"app": "QuipuRecicla API", "ok": True}

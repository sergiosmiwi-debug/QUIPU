"""Tabla de vida útil de ~70 productos peruanos, en días {closed, opened}.

Frutas y verduras frescas siempre closed == opened (no existe "abrirlas").
El matching es por substring sobre nombres normalizados sin tildes.
"""
import unicodedata


def normalize(text: str) -> str:
    """Quita tildes y pasa a minúsculas para matching robusto."""
    nfd = unicodedata.normalize("NFD", text.lower().strip())
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")


# clave normalizada -> (dias_cerrado, dias_abierto)
SHELF_LIFE: dict[str, tuple[int, int]] = {
    # Lácteos y huevos
    "leche": (7, 3),
    "yogur": (14, 5),
    "yogurt": (14, 5),
    "queso fresco": (7, 5),
    "queso": (21, 10),
    "mantequilla": (60, 30),
    "margarina": (90, 45),
    "crema de leche": (14, 3),
    "huevo": (28, 28),
    # Carnes y pescados
    "pollo": (2, 1),
    "carne molida": (2, 1),
    "carne": (3, 2),
    "res": (3, 2),
    "cerdo": (3, 2),
    "chuleta": (3, 2),
    "pescado": (2, 1),
    "pota": (2, 1),
    "mariscos": (1, 1),
    "camarones": (2, 1),
    "jamon": (14, 5),
    "jamonada": (14, 5),
    "hot dog": (30, 7),
    "salchicha": (30, 7),
    "tocino": (14, 7),
    "chorizo": (21, 7),
    # Frutas (closed == opened)
    "platano": (5, 5),
    "manzana": (21, 21),
    "naranja": (14, 14),
    "mandarina": (10, 10),
    "limon": (14, 14),
    "palta": (5, 5),
    "papaya": (5, 5),
    "mango": (6, 6),
    "uva": (7, 7),
    "fresa": (3, 3),
    "sandia": (7, 7),
    "melon": (7, 7),
    "pina": (5, 5),
    "maracuya": (10, 10),
    "granadilla": (10, 10),
    "chirimoya": (4, 4),
    "lucuma": (5, 5),
    # Verduras (closed == opened)
    "tomate": (7, 7),
    "cebolla": (30, 30),
    "papa": (30, 30),
    "camote": (21, 21),
    "yuca": (7, 7),
    "zanahoria": (21, 21),
    "lechuga": (7, 7),
    "espinaca": (5, 5),
    "brocoli": (7, 7),
    "coliflor": (7, 7),
    "zapallo": (30, 30),
    "zapallito italiano": (7, 7),
    "choclo": (5, 5),
    "aji": (14, 14),
    "rocoto": (14, 14),
    "pimiento": (10, 10),
    "pepino": (7, 7),
    "apio": (14, 14),
    "vainita": (7, 7),
    # Hierbas frescas
    "albahaca": (5, 5),
    "culantro": (5, 5),
    "perejil": (7, 7),
    "hierba buena": (7, 7),
    "hierbabuena": (7, 7),
    "oregano fresco": (7, 7),
    "cebolla china": (7, 7),
    "kion": (21, 21),
    # Abarrotes
    "arroz": (730, 180),
    "azucar": (730, 365),
    "sal": (1825, 1825),
    "aceite": (540, 120),
    "atun": (1095, 2),
    "conserva": (1095, 3),
    "menestra": (365, 2),
    "frejol": (365, 180),
    "frejoles": (365, 180),
    "lenteja": (365, 180),
    "garbanzo": (365, 180),
    "quinua": (365, 180),
    "avena": (365, 90),
    "fideo": (730, 180),
    "tallarin": (730, 180),
    "harina": (365, 90),
    "pan": (4, 4),
    "pan de molde": (7, 5),
    "tostada": (90, 30),
    "galleta": (180, 14),
    "cereal": (365, 60),
    "mermelada": (365, 30),
    "miel": (1095, 365),
    "cafe": (365, 90),
    "te": (730, 365),
    "cacao": (365, 90),
    "chocolate": (365, 60),
    "mayonesa": (180, 30),
    "ketchup": (365, 60),
    "mostaza": (365, 60),
    "aji no moto": (730, 365),
    "sillao": (730, 180),
    "vinagre": (1095, 365),
    "leche evaporada": (365, 3),
    "leche condensada": (365, 7),
    # Bebidas
    "gaseosa": (180, 3),
    "agua": (365, 5),
    "jugo": (240, 4),
    "nectar": (240, 4),
    "cerveza": (270, 1),
    "vino": (1095, 5),
    "pisco": (1825, 365),
    "chicha": (3, 3),
    # Congelados / otros
    "helado": (90, 30),
    "tofu": (7, 3),
    "tortilla": (30, 7),
    "wantan": (5, 3),
    "sopa instantanea": (365, 365),
}

DEFAULT_SHELF_LIFE = (365, 30)


def get_shelf_life(name: str) -> tuple[int, int]:
    """Busca por substring en el nombre normalizado. Claves más largas primero
    para que "queso fresco" gane a "queso" y "leche evaporada" a "leche"."""
    norm = normalize(name)
    for key in sorted(SHELF_LIFE, key=len, reverse=True):
        if key in norm:
            return SHELF_LIFE[key]
    return DEFAULT_SHELF_LIFE


# Precios estimados en soles (S/) para no mostrar S/ 0.00 en el dashboard
PRICE_ESTIMATES: dict[str, float] = {
    "leche": 4.5,
    "yogur": 6.0,
    "queso": 9.0,
    "mantequilla": 8.0,
    "huevo": 8.5,
    "pollo": 18.0,
    "carne": 22.0,
    "res": 25.0,
    "cerdo": 20.0,
    "pescado": 15.0,
    "jamon": 7.0,
    "hot dog": 6.5,
    "salchicha": 6.5,
    "tocino": 9.0,
    "platano": 2.5,
    "manzana": 4.0,
    "naranja": 3.5,
    "mandarina": 3.0,
    "limon": 2.5,
    "palta": 4.0,
    "papaya": 5.0,
    "mango": 3.5,
    "uva": 6.0,
    "fresa": 5.0,
    "sandia": 8.0,
    "pina": 4.5,
    "tomate": 3.0,
    "cebolla": 2.5,
    "papa": 3.0,
    "camote": 2.5,
    "zanahoria": 2.0,
    "lechuga": 2.5,
    "espinaca": 2.0,
    "brocoli": 4.0,
    "choclo": 3.0,
    "aji": 2.0,
    "albahaca": 1.5,
    "culantro": 1.5,
    "perejil": 1.0,
    "arroz": 5.0,
    "azucar": 4.5,
    "aceite": 12.0,
    "atun": 6.5,
    "frejol": 6.0,
    "lenteja": 5.5,
    "quinua": 8.0,
    "avena": 4.0,
    "fideo": 3.5,
    "tallarin": 3.5,
    "harina": 4.5,
    "pan": 3.0,
    "galleta": 2.5,
    "cereal": 12.0,
    "mermelada": 7.0,
    "miel": 15.0,
    "cafe": 12.0,
    "chocolate": 8.0,
    "mayonesa": 7.5,
    "gaseosa": 5.0,
    "agua": 2.5,
    "jugo": 4.5,
    "cerveza": 6.0,
    "vino": 25.0,
    "helado": 12.0,
}

DEFAULT_PRICE = 5.0


def estimate_price(name: str) -> float:
    norm = normalize(name)
    for key in sorted(PRICE_ESTIMATES, key=len, reverse=True):
        if key in norm:
            return PRICE_ESTIMATES[key]
    return DEFAULT_PRICE

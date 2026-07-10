"""Visión por IA con Groq (Llama 4 Scout — Maverick NO soporta imágenes)."""
import base64
import json
import os
import re

from groq import Groq

MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# Mapa explícito de traducciones al español peruano
TRANSLATION_MAP = """
basil / basilico -> albahaca
banana / banano -> plátano
aguacate / avocado -> palta
elote / corn / maíz tierno -> choclo
cilantro / coriander -> culantro
batata / sweet potato -> camote
zucchini / calabacín -> zapallito italiano
frijoles / judías / porotos / habichuelas -> frejoles
maracujá / passion fruit -> maracuyá
soda / refresco -> gaseosa
jitomate -> tomate
durazno / melocotón -> durazno
piña / ananá -> piña
fresa / frutilla -> fresa
papaya / lechosa -> papaya
mantequilla / manteca (láctea) -> mantequilla
cacahuate / maní / peanut -> maní
ejotes / green beans -> vainitas
chícharos / arvejas / peas -> arvejas
toronja / pomelo / grapefruit -> toronja
chile / pepper picante -> ají
bell pepper / pimentón -> pimiento
calabaza / pumpkin -> zapallo
yuca / cassava / mandioca -> yuca
milk -> leche
cheese -> queso
chicken -> pollo
beef -> carne de res
pork -> cerdo
fish -> pescado
shrimp -> camarones
egg / huevos -> huevos
rice -> arroz
bread -> pan
apple -> manzana
orange -> naranja
lemon / lime -> limón
grapes -> uvas
watermelon -> sandía
onion -> cebolla
potato -> papa
carrot -> zanahoria
lettuce -> lechuga
spinach -> espinaca
tuna -> atún
oats -> avena
"""

SCAN_PROMPT = f"""Eres un asistente que extrae alimentos de imágenes para una app peruana de inventario doméstico.

Analiza la imagen ({{kind}}) y devuelve SOLO un array JSON con los alimentos y bebidas que identifiques. Formato de cada elemento:
{{{{"name": "...", "quantity": 1, "price": 0.0, "material": "...", "category": "..."}}}}

REGLAS EN ORDEN DE PRIORIDAD:
1. SOLO alimentos y bebidas. Excluye productos de limpieza, higiene, mascotas u otros aunque aparezcan en el mismo ticket (detergente, shampoo, papel higiénico, lejía, etc.).
2. Si no hay ningún alimento reconocible, devuelve [] (array vacío).
3. Omite lo que no puedas leer o nombrar con seguridad. JAMÁS inventes productos.
4. Los nombres van SIEMPRE en español peruano. Usa este mapa de traducciones:
{TRANSLATION_MAP}
5. "material" es el material del ENVASE, uno de: plastico, vidrio, metal, carton, organico, general, desconocido.
   - Frutas y verduras sueltas sin envase: organico.
   - Si el envase SÍ es visible en la imagen (foto de refrigeradora/alacena), identifica su material real.
   - Usa "desconocido" SOLO si el envase no es visible en la imagen (siempre el caso en tickets impresos). NUNCA adivines el material a partir del nombre: para eso el sistema ya aplica una corrección automática después de tu respuesta.
6. "quantity": entero (default 1). "price": precio en soles si es legible en el ticket, si no 0.
7. "category": una palabra simple (lacteos, carnes, frutas, verduras, abarrotes, bebidas, snacks, panaderia, congelados, otros).

Devuelve SOLO el array JSON, sin texto adicional."""

# Palabras basura que descartan una fila del resultado
JUNK_KEYWORDS = [
    "ruc", "tel.", "telefono", "www", "http", ".com", "igv", "total",
    "subtotal", "efectivo", "vuelto", "cambio", "tarjeta", "visa",
    "mastercard", "gracias", "boleta", "factura", "ticket", "caja",
    "cajero", "cliente", "direccion", "av.", "jr.", "descuento",
    "detergente", "lejia", "shampoo", "jabon", "papel higienico",
    "pasta dental", "desodorante", "escoba", "servilleta",
]

VALID_MATERIALS = {
    "plastico", "vidrio", "metal", "carton", "organico", "general", "desconocido"
}


def _client() -> Groq:
    return Groq(api_key=os.environ["GROQ_API_KEY"])


def _parse_json_array(text: str) -> list:
    """Extrae el array JSON de la respuesta, tolerando fences ```json."""
    cleaned = re.sub(r"```(?:json)?", "", text)
    match = re.search(r"\[.*\]", cleaned, re.DOTALL)
    if not match:
        return []
    try:
        data = json.loads(match.group(0))
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _postfilter(items: list) -> list[dict]:
    """Descarta filas basura, normaliza campos y resuelve el material.

    La IA solo puede reportar "desconocido" cuando el envase no es visible
    (tickets impresos). En ese caso completamos el material automáticamente
    aquí: el usuario nunca debe tener que elegirlo a mano.
    """
    from shelf_life import estimate_price, guess_material, normalize

    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        if len(name) < 2:
            continue
        norm = normalize(name)
        if any(junk in norm for junk in JUNK_KEYWORDS):
            continue
        material = str(item.get("material", "desconocido")).strip().lower()
        if material not in VALID_MATERIALS:
            material = "desconocido"
        if material == "desconocido":
            material = guess_material(name)
        try:
            quantity = max(1, int(item.get("quantity", 1) or 1))
        except (TypeError, ValueError):
            quantity = 1
        try:
            price = float(item.get("price", 0) or 0)
        except (TypeError, ValueError):
            price = 0.0
        if price <= 0:
            price = estimate_price(name)
        result.append({
            "name": name,
            "quantity": quantity,
            "price": round(price, 2),
            "material": material,
            "category": str(item.get("category", "otros")).strip().lower() or "otros",
        })
    return result


def scan_image(image_bytes: bytes, kind: str) -> list[dict]:
    """kind: 'ticket de compra' o 'foto de refrigeradora/alacena'."""
    b64 = base64.b64encode(image_bytes).decode()
    prompt = SCAN_PROMPT.format(kind=kind)
    response = _client().chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    },
                ],
            }
        ],
        temperature=0.1,
        max_tokens=2048,
    )
    return _postfilter(_parse_json_array(response.choices[0].message.content or ""))

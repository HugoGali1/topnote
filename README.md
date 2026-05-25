# Top Note

Aplicación de recomendación olfativa que combina un catálogo masivo de
fragancias (vía Parfumo) con un perfumista LLM (Claude).

## Estructura

```
perfumes/
├── index.html                   # SPA React (CDN, sin build)
├── data/
│   ├── parfumo_data.csv         # dataset crudo (descargar de Kaggle)
│   └── catalog.json             # catálogo procesado (generado)
├── scripts/
│   ├── translations.py          # tablas EN -> ES + heurísticas
│   ├── ingest_parfumo.py        # CSV -> catalog.json
│   └── fetch_images.py          # rellena catalog.json con imágenes oficiales
└── README.md
```

## Setup inicial (una vez)

### 1. Descargar el dataset de Parfumo

Fuente: <https://www.kaggle.com/datasets/olgagmiufana1/parfumo-fragrance-dataset>

Requiere cuenta gratuita de Kaggle. Descarga el ZIP, extrae el archivo
CSV y déjalo en `data/parfumo_data.csv`.

> Alternativa por terminal con la CLI de Kaggle:
> ```powershell
> kaggle datasets download -d olgagmiufana1/parfumo-fragrance-dataset -p data --unzip
> ```

### 2. Generar el catálogo

```powershell
python scripts/ingest_parfumo.py
```

Opciones:

- `--min-votes 20` (default): descarta perfumes con menos de N valoraciones,
  para evitar entradas pobres. Subir para más calidad / menos volumen.
- `--limit 5000`: corta tras N perfumes (útil para iterar rápido).
- `--input PATH` / `--output PATH`: rutas alternativas.

Salida típica:

```
· Filas leídas       : 59325
· Descartadas (votos): 39800
· Descartadas (notas): 240
· Conservadas        : 19285
· Calculando similares_a (top-3) para 19285 perfumes…
✓ Listo. 19285 perfumes · 11.4 MB
```

### 3. (Opcional) Imágenes oficiales de perfumes

`catalog.json` no incluye imágenes por defecto. Para añadirlas hay un script
que las extrae de Parfumo (`og:image`):

```powershell
# Top 3000 por calidad (≈50 min a 1 req/s)
python scripts/fetch_images.py --limit 3000

# Todo el catálogo (≈8-14 horas para 31k perfumes — overnight)
python scripts/fetch_images.py
```

- Solo stdlib de Python ≥ 3.6 (sin pip install).
- Es **resumible**: re-ejecutar salta lo que ya tiene imagen.
- Checkpoint cada 100 perfumes — un Ctrl-C no rompe nada.
- Sé respetuoso: no bajes `--delay` por debajo de 0.5s.

**Para ejecutar en otra máquina** (recomendado si tu equipo principal no
puede dejarlo corriendo horas):

1. Copia `scripts/fetch_images.py` + `data/catalog.json` a esa máquina.
2. Asegúrate de tener Python ≥ 3.6.
3. Ejecuta: `python fetch_images.py --catalog catalog.json --limit 3000`
4. Cuando termine, copia el `catalog.json` actualizado de vuelta a
   `data/catalog.json`.

La UI muestra la imagen oficial cuando el campo `imagen` está poblado, y
hace fallback al SVG estilizado cuando no.

### 4. Servir la SPA

`index.html` necesita servirse vía HTTP para poder hacer `fetch('data/catalog.json')`
(no funciona abriéndolo con `file://`).

```powershell
python -m http.server 8000
# luego abre http://localhost:8000
```

La primera vez te pedirá tu API key de **Google Gemini** (`AIza...`) para
consultas al perfumista LLM. La consigues gratis en
<https://aistudio.google.com/apikey>. Se guarda solo en `localStorage` y
nunca viaja al repositorio.

> Free tier de Gemini 2.5 Flash: 1.500 req/día — más que de sobra para uso
> personal/portfolio.

## Flujo de búsqueda

1. **Prefiltro client-side** (en `index.html`):
   - aplica filtros duros (familia, género, temporada, año)
   - puntúa por keywords del query contra notas/acordes
   - ordena por score + prior de calidad (rating × log(votos))
   - toma top 80 candidatos
2. **Llamada al LLM** con esos 80 candidatos.
3. **Re-ranking** y selección de 3–5 finales con razonamiento.

Sin prefiltro no cabría el catálogo de ~20k entradas en el contexto.

## Schema del catálogo

```jsonc
{
  "id": "pf_…",
  "nombre": "Baccarat Rouge 540",
  "casa": "Maison Francis Kurkdjian",
  "año": 2014,
  "concentracion": "Eau de Parfum",
  "notas": {
    "salida":  ["azafrán", "jazmín"],
    "corazon": ["amaranto"],
    "fondo":   ["ámbar gris", "cedro"]
  },
  "familia":   "amaderada",
  "acordes":   ["amber", "sweet", "woody"],  // primeros 5 acordes Parfumo, lowercase
  "temporada": ["otoño", "invierno", "primavera"],
  "genero":    "unisex",
  "perfumistas": ["Francis Kurkdjian"],
  "rating":    9.0,
  "rating_count": 12345,
  "url":       "https://www.parfumo.com/…",
  "similares_a": ["pf_…", "pf_…", "pf_…"]
}
```

## Licencia

- Código: tuyo.
- Dataset Parfumo: scraping de un sitio público (verifica las condiciones
  de Parfumo para uso comercial; este proyecto asume uso personal/educativo).

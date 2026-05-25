# -*- coding: utf-8 -*-
"""
Tablas de traducción y heurísticas para normalizar el dataset Parfumo al
schema en español del catálogo Top Note.

- ACCORD_TO_FAMILY: mapea acordes Parfumo a las 7 familias de la UI.
- NOTE_TRANSLATIONS: EN -> ES para notas olfativas comunes (~280 entradas).
- SEASON_BY_FAMILY: temporadas heurísticas por familia.
- GENDER_PATTERNS: patrones para inferir género desde el nombre/concentración.
"""

import re

# ─── Familias de la app ──────────────────────────────────────────────────────
# Las 7 familias que ya usa la UI (FAMILIA_LABELS en index.html).
FAMILIES = {'amaderada', 'oriental', 'floral', 'cítrica', 'gourmand', 'chipre', 'fougère'}

# Acordes Parfumo (lowercase) -> familia. Orden de prioridad si hay varios:
# el primero que matchee gana.
ACCORD_TO_FAMILY = {
    # Amaderada
    'woody': 'amaderada',
    'wood': 'amaderada',
    'cedar': 'amaderada',
    'sandalwood': 'amaderada',
    'oud': 'amaderada',
    'patchouli': 'amaderada',
    # Oriental
    'oriental': 'oriental',
    'warm spicy': 'oriental',
    'spicy': 'oriental',
    'amber': 'oriental',
    'balsamic': 'oriental',
    'resinous': 'oriental',
    'smoky': 'oriental',
    'tobacco': 'oriental',
    'leather': 'oriental',
    'animalic': 'oriental',
    # Floral
    'floral': 'floral',
    'white floral': 'floral',
    'yellow floral': 'floral',
    'soft floral': 'floral',
    'rose': 'floral',
    'iris': 'floral',
    'tuberose': 'floral',
    'powdery': 'floral',
    'violet': 'floral',
    # Cítrica
    'citrus': 'cítrica',
    'fresh citrus': 'cítrica',
    'aquatic': 'cítrica',
    'marine': 'cítrica',
    'fresh': 'cítrica',
    'ozonic': 'cítrica',
    # Gourmand
    'gourmand': 'gourmand',
    'sweet': 'gourmand',
    'vanilla': 'gourmand',
    'caramel': 'gourmand',
    'chocolate': 'gourmand',
    'honey': 'gourmand',
    'coffee': 'gourmand',
    'fruity': 'gourmand',
    'tropical': 'gourmand',
    # Chipre
    'chypre': 'chipre',
    'mossy': 'chipre',
    'earthy': 'chipre',
    'green': 'chipre',
    # Fougère
    'fougere': 'fougère',
    'fougère': 'fougère',
    'aromatic': 'fougère',
    'lavender': 'fougère',
    'herbal': 'fougère',
}

# ─── Traducción de notas EN -> ES ────────────────────────────────────────────
NOTE_TRANSLATIONS = {
    # Cítricos / frutas
    'bergamot': 'bergamota', 'calabrian bergamot': 'bergamota de Calabria',
    'sicilian bergamot': 'bergamota siciliana',
    'lemon': 'limón', 'sicilian lemon': 'limón siciliano',
    'lime': 'lima', 'kaffir lime': 'lima kaffir',
    'orange': 'naranja', 'bitter orange': 'naranja amarga',
    'blood orange': 'naranja sanguina', 'sweet orange': 'naranja dulce',
    'mandarin orange': 'mandarina', 'mandarin': 'mandarina', 'tangerine': 'mandarina',
    'grapefruit': 'pomelo', 'pink grapefruit': 'pomelo rosa',
    'yuzu': 'yuzu', 'pomelo': 'pomelo', 'citron': 'cidra',
    'orange blossom': 'flor de naranjo', 'neroli': 'neroli', 'petitgrain': 'petitgrain',
    'pineapple': 'piña', 'apple': 'manzana', 'green apple': 'manzana verde',
    'red apple': 'manzana roja', 'pear': 'pera', 'peach': 'durazno',
    'apricot': 'albaricoque', 'plum': 'ciruela', 'cherry': 'cereza',
    'black cherry': 'cereza negra', 'cherry blossom': 'flor de cerezo',
    'raspberry': 'frambuesa', 'strawberry': 'fresa', 'blueberry': 'arándano',
    'blackberry': 'mora', 'blackcurrant': 'grosella negra', 'black currant': 'grosella negra',
    'cassis': 'casis', 'pomegranate': 'granada', 'fig': 'higo',
    'coconut': 'coco', 'banana': 'plátano', 'mango': 'mango',
    'passionfruit': 'maracuyá', 'passion fruit': 'maracuyá',
    'lychee': 'litchi', 'litchi': 'litchi', 'melon': 'melón', 'watermelon': 'sandía',
    'rhubarb': 'ruibarbo', 'date': 'dátil', 'dates': 'dátiles',
    'quince': 'membrillo', 'guava': 'guayaba', 'grape': 'uva',
    'red berries': 'frutos rojos', 'currant': 'grosella',
    # Florales
    'rose': 'rosa', 'damask rose': 'rosa de Damasco', 'turkish rose': 'rosa turca',
    'bulgarian rose': 'rosa búlgara', 'centifolia rose': 'rosa centifolia',
    'may rose': 'rosa de mayo', 'tea rose': 'rosa té',
    'jasmine': 'jazmín', 'sambac jasmine': 'jazmín sambac',
    'jasmine sambac': 'jazmín sambac', 'egyptian jasmine': 'jazmín egipcio',
    'tuberose': 'tuberosa', 'gardenia': 'gardenia',
    'lily': 'lirio', 'lily of the valley': 'lirio del valle',
    'lily-of-the-valley': 'lirio del valle', 'magnolia': 'magnolia',
    'peony': 'peonía', 'violet': 'violeta', 'violet leaf': 'hoja de violeta',
    'violet leaves': 'hojas de violeta',
    'iris': 'iris', 'orris': 'iris', 'orris root': 'raíz de iris',
    'orchid': 'orquídea', 'osmanthus': 'osmanthus', 'lotus': 'loto',
    'frangipani': 'frangipani', 'mimosa': 'mimosa', 'lavender': 'lavanda',
    'ylang-ylang': 'ylang-ylang', 'ylang ylang': 'ylang-ylang',
    'narcissus': 'narciso', 'hyacinth': 'jacinto', 'freesia': 'fresia',
    'heliotrope': 'heliotropo', 'honeysuckle': 'madreselva', 'geranium': 'geranio',
    'champaca': 'champaca', 'plumeria': 'plumeria',
    'white flowers': 'flores blancas', 'wisteria': 'glicina',
    # Especias
    'cardamom': 'cardamomo', 'cinnamon': 'canela', 'clove': 'clavo', 'cloves': 'clavo',
    'nutmeg': 'nuez moscada', 'saffron': 'azafrán',
    'pepper': 'pimienta', 'black pepper': 'pimienta negra', 'pink pepper': 'pimienta rosa',
    'white pepper': 'pimienta blanca', 'sichuan pepper': 'pimienta de Sichuan',
    'szechuan pepper': 'pimienta de Sichuan',
    'ginger': 'jengibre', 'coriander': 'cilantro', 'cumin': 'comino',
    'anise': 'anís', 'star anise': 'estrella de anís', 'fennel': 'hinojo',
    'caraway': 'alcaravea', 'turmeric': 'cúrcuma', 'paprika': 'pimentón',
    'allspice': 'pimienta de Jamaica', 'curry': 'curry',
    # Hierbas / aromáticas
    'mint': 'menta', 'peppermint': 'menta piperita', 'spearmint': 'hierbabuena',
    'basil': 'albahaca', 'thyme': 'tomillo', 'rosemary': 'romero',
    'sage': 'salvia', 'clary sage': 'salvia esclarea', 'oregano': 'orégano',
    'tarragon': 'estragón', 'tea': 'té', 'green tea': 'té verde',
    'black tea': 'té negro', 'matcha': 'matcha', 'mate': 'mate',
    'absinthe': 'absenta', 'wormwood': 'ajenjo',
    # Resinas / bálsamos
    'incense': 'incienso', 'frankincense': 'incienso', 'olibanum': 'incienso',
    'myrrh': 'mirra', 'benzoin': 'benjuí', 'labdanum': 'labdanum',
    'cistus': 'cisto', 'styrax': 'estoraque', 'elemi': 'elemí',
    'opoponax': 'opopónaco', 'opopanax': 'opopónaco', 'galbanum': 'galbanum',
    'amber': 'ámbar', 'ambergris': 'ámbar gris', 'ambroxan': 'ambroxan',
    'ambrette': 'ambreta', 'amberwood': 'amberwood', 'ambrarome': 'ambrarome',
    # Maderas
    'sandalwood': 'sándalo', 'mysore sandalwood': 'sándalo de Mysore',
    'australian sandalwood': 'sándalo australiano',
    'cedar': 'cedro', 'cedarwood': 'cedro', 'virginia cedar': 'cedro de Virginia',
    'virginian cedar': 'cedro de Virginia',
    'atlas cedar': 'cedro del Atlas',
    'oud': 'oud', 'agarwood': 'oud',
    'guaiac wood': 'guayaco', 'guaiacwood': 'guayaco', 'guaiac': 'guayaco',
    'rosewood': 'palo de rosa', 'brazilian rosewood': 'palo de Brasil',
    'cypress': 'ciprés', 'pine': 'pino', 'fir': 'abeto',
    'birch': 'abedul', 'birch tar': 'alquitrán de abedul',
    'cashmere wood': 'cachemira', 'cashmeran': 'cachemira',
    'oakmoss': 'musgo de roble', 'oak': 'roble', 'tree moss': 'musgo de árbol',
    'patchouli': 'pachulí', 'vetiver': 'vetiver',
    'haitian vetiver': 'vetiver de Haití', 'javanese vetiver': 'vetiver de Java',
    'papyrus': 'papiro', 'bamboo': 'bambú', 'mahogany': 'caoba',
    'ebony': 'ébano', 'gaiac wood': 'guayaco',
    # Dulces / gourmand
    'vanilla': 'vainilla', 'madagascar vanilla': 'vainilla de Madagascar',
    'tahitian vanilla': 'vainilla de Tahití', 'bourbon vanilla': 'vainilla bourbon',
    'tonka bean': 'haba tonka', 'tonka': 'haba tonka', 'coumarin': 'cumarina',
    'caramel': 'caramelo', 'honey': 'miel',
    'chocolate': 'chocolate', 'dark chocolate': 'chocolate negro', 'cocoa': 'cacao',
    'coffee': 'café', 'roasted coffee': 'café tostado', 'espresso': 'expreso',
    'praline': 'praliné', 'nougat': 'turrón',
    'almond': 'almendra', 'bitter almond': 'almendra amarga',
    'hazelnut': 'avellana', 'walnut': 'nuez', 'pistachio': 'pistacho',
    'milk': 'leche', 'cream': 'crema', 'sugar': 'azúcar',
    'cotton candy': 'algodón de azúcar', 'marshmallow': 'malvavisco',
    'rum': 'ron', 'cognac': 'coñac', 'whiskey': 'whisky', 'whisky': 'whisky',
    'wine': 'vino', 'champagne': 'champán',
    # Almizcle / cuero / animales
    'musk': 'almizcle', 'white musk': 'almizcle blanco',
    'civet': 'civeta', 'castoreum': 'castóreo',
    'leather': 'cuero', 'suede': 'gamuza',
    # Tabaco / humo
    'tobacco': 'tabaco', 'blond tobacco': 'tabaco rubio',
    'honey tobacco': 'tabaco con miel', 'tobacco leaf': 'hoja de tabaco',
    'smoke': 'humo', 'smoky notes': 'notas ahumadas', 'tar': 'alquitrán',
    'hay': 'heno', 'dry hay': 'heno seco',
    # Verdes / vegetales
    'grass': 'hierba', 'green notes': 'notas verdes',
    'green leaves': 'hojas verdes', 'tomato leaf': 'hoja de tomate',
    'cucumber': 'pepino', 'fig leaf': 'hoja de higo',
    'seaweed': 'algas', 'kelp': 'algas',
    # Marinas / minerales
    'sea notes': 'notas marinas', 'marine notes': 'notas marinas',
    'sea salt': 'sal marina', 'salt': 'sal', 'ocean': 'océano',
    'ozonic notes': 'notas ozónicas', 'aldehydes': 'aldehídos',
    'iso e super': 'iso e super', 'metallic notes': 'notas metálicas',
    'mineral notes': 'notas minerales', 'water notes': 'notas acuáticas',
    'water': 'agua', 'rain': 'lluvia',
    # Otros
    'amaranth': 'amaranto', 'amaranth wood': 'amaranto',
    'mushroom': 'agárico', 'fungus': 'agárico', 'truffle': 'trufa',
    'mossy notes': 'notas musgosas', 'powdery notes': 'notas pulverulentas',
    'soap': 'jabón', 'wax': 'cera', 'ink': 'tinta', 'paper': 'papel',
    'gunpowder': 'pólvora', 'rubber': 'goma', 'gasoline': 'gasolina',
}

# ─── Temporadas por familia (heurística) ─────────────────────────────────────
SEASON_BY_FAMILY = {
    'amaderada': ['otoño', 'invierno', 'primavera'],
    'oriental': ['otoño', 'invierno'],
    'floral': ['primavera', 'verano', 'otoño'],
    'cítrica': ['primavera', 'verano'],
    'gourmand': ['otoño', 'invierno'],
    'chipre': ['primavera', 'otoño'],
    'fougère': ['primavera', 'verano', 'otoño'],
}

# ─── Inferencia de género ────────────────────────────────────────────────────
# Se evalúa contra el nombre del perfume (lowercase). Primer match gana.
_GENDER_RE_FEM = re.compile(
    r'\b(for\s+women|pour\s+femme|for\s+her|femme|woman|women|donna|mujer|her|elle)\b',
    re.IGNORECASE,
)
_GENDER_RE_MASC = re.compile(
    r'\b(for\s+men|pour\s+homme|for\s+him|homme|man|men|uomo|hombre|him|lui)\b',
    re.IGNORECASE,
)
_GENDER_RE_UNISEX = re.compile(r'\b(unisex|shared|for\s+all)\b', re.IGNORECASE)


def infer_gender(name: str) -> str:
    if not name:
        return 'unisex'
    if _GENDER_RE_UNISEX.search(name):
        return 'unisex'
    fem = _GENDER_RE_FEM.search(name)
    masc = _GENDER_RE_MASC.search(name)
    if fem and not masc:
        return 'femenino'
    if masc and not fem:
        return 'masculino'
    return 'unisex'


# ─── Helpers ─────────────────────────────────────────────────────────────────
def translate_note(en: str) -> str:
    """Traduce una nota inglés -> español. Si no hay match, devuelve la nota
    original en minúsculas para que el catálogo siga siendo útil."""
    if not en:
        return ''
    key = en.strip().lower()
    return NOTE_TRANSLATIONS.get(key, key)


def family_from_accords(accords) -> str:
    """Devuelve la primera familia que matchee con la lista de acordes
    (lowercase). Si nada matchea, default 'amaderada'."""
    for a in accords:
        a = a.strip().lower()
        if a in ACCORD_TO_FAMILY:
            return ACCORD_TO_FAMILY[a]
    return 'amaderada'

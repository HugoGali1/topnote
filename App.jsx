import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Heart,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  X,
  Clock,
} from 'lucide-react';

/* ============================================================
   CATÁLOGO OLFATIVO — 30 fragancias
   ============================================================ */
const CATALOG = [
  /* === NICHO / LUJO ============================================ */
  {
    id: 'mfk_br540',
    nombre: 'Baccarat Rouge 540',
    casa: 'Maison Francis Kurkdjian',
    año: 2014,
    notas: {
      salida: ['azafrán', 'jazmín', 'almizcle blanco'],
      corazon: ['amaranto', 'absoluto de bergamota'],
      fondo: ['ámbar gris', 'cedro de Virginia', 'resinas'],
    },
    familia: 'amaderada',
    temporada: ['otoño', 'invierno', 'primavera'],
    ocasion: ['noche', 'cita', 'firma'],
    proyeccion: 'enorme',
    duracion_horas: 9,
    precio_eur_100ml: 420,
    tier_precio: 'lujo',
    genero: 'unisex',
    similares_a: ['alh_infini', 'lattafa_khamrah', 'mfk_grand_soir'],
    descripcion_corta:
      'Ámbar luminoso y dulce con halo de azafrán; firma icónica de proyección masiva.',
  },
  {
    id: 'mfk_grand_soir',
    nombre: 'Grand Soir',
    casa: 'Maison Francis Kurkdjian',
    año: 2016,
    notas: {
      salida: ['ámbar', 'bergamota'],
      corazon: ['benjuí', 'haba tonka', 'lavanda'],
      fondo: ['vainilla', 'almizcle', 'cedro'],
    },
    familia: 'oriental',
    temporada: ['otoño', 'invierno'],
    ocasion: ['noche', 'cita'],
    proyeccion: 'moderada',
    duracion_horas: 8,
    precio_eur_100ml: 285,
    tier_precio: 'lujo',
    genero: 'unisex',
    similares_a: ['pdm_layton', 'tf_tobacco_vanille', 'mfk_br540'],
    descripcion_corta:
      'Ámbar cálido envuelto en vainilla y benjuí; nocturno, sereno, sensual.',
  },
  {
    id: 'pdm_layton',
    nombre: 'Layton',
    casa: 'Parfums de Marly',
    año: 2016,
    notas: {
      salida: ['manzana', 'bergamota', 'lavanda', 'cardamomo'],
      corazon: ['geranio', 'jazmín', 'violeta', 'pimienta rosa'],
      fondo: ['vainilla', 'sándalo', 'guayaco', 'almizcle'],
    },
    familia: 'oriental',
    temporada: ['otoño', 'invierno', 'primavera'],
    ocasion: ['diario', 'oficina', 'noche', 'cita'],
    proyeccion: 'fuerte',
    duracion_horas: 10,
    precio_eur_100ml: 245,
    tier_precio: 'lujo',
    genero: 'unisex',
    similares_a: ['lattafa_khamrah', 'mfk_grand_soir', 'pdm_herod'],
    descripcion_corta:
      'Manzana especiada sobre corazón cremoso de vainilla y sándalo; versátil y de gran rendimiento.',
  },
  {
    id: 'pdm_herod',
    nombre: 'Herod',
    casa: 'Parfums de Marly',
    año: 2012,
    notas: {
      salida: ['canela', 'pimienta negra', 'incienso'],
      corazon: ['tabaco', 'osmanthus', 'labdanum'],
      fondo: ['vainilla', 'sándalo', 'cedro', 'pachulí'],
    },
    familia: 'oriental',
    temporada: ['otoño', 'invierno'],
    ocasion: ['noche', 'firma'],
    proyeccion: 'fuerte',
    duracion_horas: 9,
    precio_eur_100ml: 245,
    tier_precio: 'lujo',
    genero: 'masculino',
    similares_a: ['tf_tobacco_vanille', 'pdm_layton', 'xerjoff_naxos'],
    descripcion_corta:
      'Tabaco dulce y especiado con vainilla cremosa; masculino, refinado, otoñal.',
  },
  {
    id: 'pdm_delina',
    nombre: 'Delina',
    casa: 'Parfums de Marly',
    año: 2017,
    notas: {
      salida: ['ruibarbo', 'litchi', 'bergamota'],
      corazon: ['rosa turca', 'peonía', 'incienso'],
      fondo: ['ámbar gris', 'almizcle', 'vainilla', 'cachemira'],
    },
    familia: 'floral',
    temporada: ['primavera', 'verano', 'otoño'],
    ocasion: ['cita', 'oficina', 'diario'],
    proyeccion: 'moderada',
    duracion_horas: 8,
    precio_eur_100ml: 255,
    tier_precio: 'lujo',
    genero: 'femenino',
    similares_a: ['lancome_lvib', 'lattafa_yara', 'dior_jadore'],
    descripcion_corta:
      'Rosa fresca y luminosa con frutas exóticas; femenina, joven y elegante.',
  },
  {
    id: 'tf_tobacco_vanille',
    nombre: 'Tobacco Vanille',
    casa: 'Tom Ford',
    año: 2007,
    notas: {
      salida: ['tabaco rubio', 'especias'],
      corazon: ['vainilla', 'cacao', 'haba tonka'],
      fondo: ['frutos secos', 'madera', 'heno seco'],
    },
    familia: 'oriental',
    temporada: ['otoño', 'invierno'],
    ocasion: ['noche', 'firma'],
    proyeccion: 'fuerte',
    duracion_horas: 10,
    precio_eur_100ml: 295,
    tier_precio: 'lujo',
    genero: 'unisex',
    similares_a: ['xerjoff_naxos', 'lattafa_khamrah', 'pdm_herod'],
    descripcion_corta:
      'Tabaco rubio cremoso con vainilla y frutos secos; clásico moderno, cálido y reconfortante.',
  },
  {
    id: 'tf_oud_wood',
    nombre: 'Oud Wood',
    casa: 'Tom Ford',
    año: 2007,
    notas: {
      salida: ['agárico', 'cardamomo', 'pimienta rosa'],
      corazon: ['oud', 'palo de rosa', 'sándalo'],
      fondo: ['vetiver', 'haba tonka', 'ámbar'],
    },
    familia: 'amaderada',
    temporada: ['otoño', 'invierno'],
    ocasion: ['noche', 'firma', 'oficina'],
    proyeccion: 'moderada',
    duracion_horas: 8,
    precio_eur_100ml: 310,
    tier_precio: 'lujo',
    genero: 'unisex',
    similares_a: ['amouage_interlude', 'lattafa_bade_oud'],
    descripcion_corta:
      'Oud refinado y limpio sobre maderas cremosas; introspectivo, lujoso, contemporáneo.',
  },
  {
    id: 'tf_lost_cherry',
    nombre: 'Lost Cherry',
    casa: 'Tom Ford',
    año: 2018,
    notas: {
      salida: ['cereza negra', 'licor de cereza', 'almendra amarga'],
      corazon: ['rosa turca', 'jazmín sambac', 'pétalos de cereza'],
      fondo: ['haba tonka', 'sándalo', 'bálsamo de Perú', 'vetiver'],
    },
    familia: 'gourmand',
    temporada: ['otoño', 'invierno', 'primavera'],
    ocasion: ['cita', 'noche'],
    proyeccion: 'fuerte',
    duracion_horas: 9,
    precio_eur_100ml: 340,
    tier_precio: 'lujo',
    genero: 'unisex',
    similares_a: ['xerjoff_erba_pura', 'lattafa_yara', 'ysl_black_opium'],
    descripcion_corta:
      'Cereza confitada con almendra amarga y rosa; gourmand atrevido, sensual, distintivo.',
  },
  {
    id: 'creed_aventus',
    nombre: 'Aventus',
    casa: 'Creed',
    año: 2010,
    notas: {
      salida: ['piña', 'bergamota', 'grosella negra', 'manzana'],
      corazon: ['abedul', 'pachulí', 'jazmín', 'rosa'],
      fondo: ['almizcle', 'roble', 'ámbar gris', 'vainilla'],
    },
    familia: 'chipre',
    temporada: ['primavera', 'verano', 'otoño'],
    ocasion: ['oficina', 'diario', 'cita', 'firma'],
    proyeccion: 'fuerte',
    duracion_horas: 9,
    precio_eur_100ml: 380,
    tier_precio: 'lujo',
    genero: 'masculino',
    similares_a: ['armaf_cdni', 'lattafa_asad'],
    descripcion_corta:
      'Piña ahumada con abedul y pachulí; el referente moderno del éxito masculino.',
  },
  {
    id: 'xerjoff_erba_pura',
    nombre: 'Erba Pura',
    casa: 'Xerjoff',
    año: 2014,
    notas: {
      salida: ['cítricos sicilianos', 'frutas tropicales', 'naranja dulce'],
      corazon: ['flores blancas', 'vainilla'],
      fondo: ['ámbar', 'almizcle', 'pachulí'],
    },
    familia: 'gourmand',
    temporada: ['primavera', 'verano', 'otoño'],
    ocasion: ['diario', 'oficina', 'cita'],
    proyeccion: 'fuerte',
    duracion_horas: 9,
    precio_eur_100ml: 285,
    tier_precio: 'lujo',
    genero: 'unisex',
    similares_a: ['tf_lost_cherry', 'xerjoff_naxos', 'lattafa_yara'],
    descripcion_corta:
      'Frutas dulces sobre vainilla y ámbar; alegre, comestible, ampliamente complaciente.',
  },
  {
    id: 'xerjoff_naxos',
    nombre: 'Naxos',
    casa: 'Xerjoff',
    año: 2015,
    notas: {
      salida: ['lavanda', 'bergamota', 'limón'],
      corazon: ['canela', 'jazmín', 'miel'],
      fondo: ['tabaco', 'vainilla', 'haba tonka'],
    },
    familia: 'gourmand',
    temporada: ['otoño', 'invierno'],
    ocasion: ['noche', 'firma'],
    proyeccion: 'fuerte',
    duracion_horas: 9,
    precio_eur_100ml: 290,
    tier_precio: 'lujo',
    genero: 'unisex',
    similares_a: ['tf_tobacco_vanille', 'pdm_herod', 'lattafa_khamrah'],
    descripcion_corta:
      'Tabaco con miel, canela y vainilla; cálido, opulento, hipnótico para el frío.',
  },
  {
    id: 'amouage_interlude',
    nombre: 'Interlude Man',
    casa: 'Amouage',
    año: 2012,
    notas: {
      salida: ['bergamota', 'orégano', 'pimienta', 'cilantro'],
      corazon: ['ámbar', 'cisto', 'incienso', 'opopónaco'],
      fondo: ['agárico', 'cuero', 'sándalo', 'pachulí'],
    },
    familia: 'oriental',
    temporada: ['otoño', 'invierno'],
    ocasion: ['noche', 'firma'],
    proyeccion: 'enorme',
    duracion_horas: 12,
    precio_eur_100ml: 340,
    tier_precio: 'lujo',
    genero: 'masculino',
    similares_a: ['tf_oud_wood', 'pdm_herod', 'lattafa_bade_oud'],
    descripcion_corta:
      'Incienso ahumado, cuero y especias; intenso, oscuro, indomable.',
  },
  {
    id: 'kilian_angels_share',
    nombre: "Angels' Share",
    casa: 'Kilian',
    año: 2020,
    notas: {
      salida: ['coñac'],
      corazon: ['canela', 'haba tonka', 'roble'],
      fondo: ['vainilla', 'praliné', 'sándalo'],
    },
    familia: 'gourmand',
    temporada: ['otoño', 'invierno'],
    ocasion: ['noche', 'cita'],
    proyeccion: 'moderada',
    duracion_horas: 8,
    precio_eur_100ml: 285,
    tier_precio: 'lujo',
    genero: 'unisex',
    similares_a: ['lattafa_khamrah', 'tf_tobacco_vanille', 'xerjoff_naxos'],
    descripcion_corta:
      'Coñac añejado con haba tonka y roble; ebrio, cálido, sofisticadamente otoñal.',
  },

  /* === DESIGNER / PREMIUM ====================================== */
  {
    id: 'chanel_bleu_edp',
    nombre: 'Bleu de Chanel EDP',
    casa: 'Chanel',
    año: 2014,
    notas: {
      salida: ['toronja', 'limón', 'menta', 'pimienta rosa'],
      corazon: ['jengibre', 'nuez moscada', 'jazmín'],
      fondo: ['incienso', 'sándalo', 'cedro', 'pachulí'],
    },
    familia: 'amaderada',
    temporada: ['primavera', 'otoño', 'invierno'],
    ocasion: ['oficina', 'diario', 'cita'],
    proyeccion: 'moderada',
    duracion_horas: 8,
    precio_eur_100ml: 130,
    tier_precio: 'premium',
    genero: 'masculino',
    similares_a: ['ysl_y_edp', 'dior_sauvage_edp', 'armani_adgp'],
    descripcion_corta:
      'Cítricos especiados sobre maderas grises; sofisticado, versátil, profesional.',
  },
  {
    id: 'dior_sauvage_edt',
    nombre: 'Sauvage EDT',
    casa: 'Dior',
    año: 2015,
    notas: {
      salida: ['bergamota de Calabria', 'pimienta'],
      corazon: ['pimienta de Sichuan', 'lavanda', 'vetiver'],
      fondo: ['ambroxan', 'cedro', 'labdanum'],
    },
    familia: 'fougère',
    temporada: ['primavera', 'verano', 'otoño'],
    ocasion: ['diario', 'oficina', 'cita'],
    proyeccion: 'fuerte',
    duracion_horas: 8,
    precio_eur_100ml: 110,
    tier_precio: 'premium',
    genero: 'masculino',
    similares_a: ['armaf_ventana', 'ysl_y_edp', 'dior_sauvage_edp'],
    descripcion_corta:
      'Bergamota brillante y ambroxan intenso; fresco, masivo, contemporáneo.',
  },
  {
    id: 'dior_sauvage_edp',
    nombre: 'Sauvage EDP',
    casa: 'Dior',
    año: 2018,
    notas: {
      salida: ['bergamota', 'mandarina'],
      corazon: ['lavanda', 'pimienta de Sichuan', 'estrella de anís'],
      fondo: ['ambroxan', 'vainilla', 'sándalo'],
    },
    familia: 'fougère',
    temporada: ['otoño', 'invierno', 'primavera'],
    ocasion: ['diario', 'oficina', 'noche'],
    proyeccion: 'fuerte',
    duracion_horas: 9,
    precio_eur_100ml: 135,
    tier_precio: 'premium',
    genero: 'masculino',
    similares_a: ['dior_sauvage_edt', 'ysl_y_edp', 'armaf_ventana'],
    descripcion_corta:
      'Versión más dulce y especiada del Sauvage original; más cuerpo y duración.',
  },
  {
    id: 'ysl_y_edp',
    nombre: 'Y EDP',
    casa: 'Yves Saint Laurent',
    año: 2018,
    notas: {
      salida: ['manzana', 'bergamota', 'jengibre'],
      corazon: ['salvia', 'geranio', 'jazmín'],
      fondo: ['ámbar gris', 'cedro virginiano', 'haba tonka', 'vetiver'],
    },
    familia: 'fougère',
    temporada: ['primavera', 'otoño', 'invierno'],
    ocasion: ['oficina', 'cita', 'noche'],
    proyeccion: 'moderada',
    duracion_horas: 8,
    precio_eur_100ml: 105,
    tier_precio: 'premium',
    genero: 'masculino',
    similares_a: ['chanel_bleu_edp', 'dior_sauvage_edp', 'armaf_ventana'],
    descripcion_corta:
      'Manzana verde con salvia y maderas resinosas; maduro, limpio, urbano.',
  },
  {
    id: 'armani_adgp',
    nombre: 'Acqua di Giò Profondo',
    casa: 'Giorgio Armani',
    año: 2020,
    notas: {
      salida: ['notas marinas', 'bergamota', 'limón verde'],
      corazon: ['romero', 'lavanda', 'salvia esclarea', 'ciprés'],
      fondo: ['almizcle', 'pachulí', 'incienso', 'mineral'],
    },
    familia: 'cítrica',
    temporada: ['primavera', 'verano'],
    ocasion: ['oficina', 'diario'],
    proyeccion: 'moderada',
    duracion_horas: 7,
    precio_eur_100ml: 105,
    tier_precio: 'premium',
    genero: 'masculino',
    similares_a: ['versace_eros', 'dior_sauvage_edt', 'dg_light_blue'],
    descripcion_corta:
      'Acuático mineral con hierbas mediterráneas; fresco, limpio, profesional.',
  },
  {
    id: 'versace_eros',
    nombre: 'Eros EDT',
    casa: 'Versace',
    año: 2012,
    notas: {
      salida: ['menta', 'manzana verde', 'limón'],
      corazon: ['haba tonka', 'geranio', 'ambroxan'],
      fondo: ['vainilla de Madagascar', 'cedro', 'vetiver', 'musgo de roble'],
    },
    familia: 'fougère',
    temporada: ['otoño', 'invierno', 'primavera'],
    ocasion: ['noche', 'cita'],
    proyeccion: 'fuerte',
    duracion_horas: 8,
    precio_eur_100ml: 80,
    tier_precio: 'premium',
    genero: 'masculino',
    similares_a: ['dior_sauvage_edt', 'armaf_ventana'],
    descripcion_corta:
      'Menta dulce con vainilla y haba tonka; juvenil, llamativo, complaciente.',
  },
  {
    id: 'dg_the_one',
    nombre: 'The One for Men',
    casa: 'Dolce & Gabbana',
    año: 2008,
    notas: {
      salida: ['pomelo', 'cilantro', 'albahaca'],
      corazon: ['cardamomo', 'jengibre', 'flor de naranjo'],
      fondo: ['tabaco', 'ámbar', 'cedro'],
    },
    familia: 'oriental',
    temporada: ['otoño', 'invierno'],
    ocasion: ['oficina', 'cita'],
    proyeccion: 'moderada',
    duracion_horas: 7,
    precio_eur_100ml: 85,
    tier_precio: 'premium',
    genero: 'masculino',
    similares_a: ['tf_tobacco_vanille', 'chanel_bleu_edp', 'pdm_herod'],
    descripcion_corta:
      'Especias cálidas con tabaco y cítricos; íntimo, elegante, otoñal.',
  },
  {
    id: 'chanel_coco_mlle',
    nombre: 'Coco Mademoiselle EDP',
    casa: 'Chanel',
    año: 2001,
    notas: {
      salida: ['naranja', 'bergamota', 'mandarina'],
      corazon: ['rosa', 'jazmín', 'litchi'],
      fondo: ['pachulí', 'vetiver', 'haba tonka', 'almizcle blanco'],
    },
    familia: 'chipre',
    temporada: ['primavera', 'otoño', 'invierno'],
    ocasion: ['oficina', 'cita', 'diario'],
    proyeccion: 'fuerte',
    duracion_horas: 8,
    precio_eur_100ml: 140,
    tier_precio: 'premium',
    genero: 'femenino',
    similares_a: ['lancome_lvib', 'dior_jadore', 'pdm_delina'],
    descripcion_corta:
      'Cítricos sobre rosa y pachulí; femenino, sofisticado, atemporal.',
  },
  {
    id: 'lancome_lvib',
    nombre: 'La Vie Est Belle',
    casa: 'Lancôme',
    año: 2012,
    notas: {
      salida: ['grosella negra', 'pera'],
      corazon: ['iris', 'jazmín', 'flor de naranjo'],
      fondo: ['praliné', 'vainilla', 'haba tonka', 'pachulí'],
    },
    familia: 'gourmand',
    temporada: ['otoño', 'invierno', 'primavera'],
    ocasion: ['diario', 'cita', 'oficina'],
    proyeccion: 'fuerte',
    duracion_horas: 9,
    precio_eur_100ml: 110,
    tier_precio: 'premium',
    genero: 'femenino',
    similares_a: ['lattafa_yara', 'ysl_black_opium', 'tf_lost_cherry'],
    descripcion_corta:
      'Iris cremoso con praliné y vainilla; dulce, esponjoso, reconfortante.',
  },
  {
    id: 'ysl_black_opium',
    nombre: 'Black Opium',
    casa: 'Yves Saint Laurent',
    año: 2014,
    notas: {
      salida: ['pera', 'pimienta rosa', 'mandarina'],
      corazon: ['café tostado', 'jazmín sambac', 'flor de azahar'],
      fondo: ['vainilla', 'pachulí', 'cedro', 'almizcle'],
    },
    familia: 'gourmand',
    temporada: ['otoño', 'invierno'],
    ocasion: ['noche', 'cita'],
    proyeccion: 'fuerte',
    duracion_horas: 8,
    precio_eur_100ml: 115,
    tier_precio: 'premium',
    genero: 'femenino',
    similares_a: ['lancome_lvib', 'lattafa_khamrah', 'tf_lost_cherry'],
    descripcion_corta:
      'Café tostado con vainilla y jazmín; oscuro, adictivo, nocturno.',
  },
  {
    id: 'dior_jadore',
    nombre: "J'adore EDP",
    casa: 'Dior',
    año: 1999,
    notas: {
      salida: ['pera', 'melón', 'magnolia', 'durazno'],
      corazon: ['jazmín', 'lirio del valle', 'tuberosa', 'flor de ciruelo'],
      fondo: ['almizcle', 'vainilla', 'palo de Brasil', 'cedro'],
    },
    familia: 'floral',
    temporada: ['primavera', 'verano', 'otoño'],
    ocasion: ['oficina', 'diario', 'cita'],
    proyeccion: 'moderada',
    duracion_horas: 7,
    precio_eur_100ml: 125,
    tier_precio: 'premium',
    genero: 'femenino',
    similares_a: ['pdm_delina', 'chanel_coco_mlle'],
    descripcion_corta:
      'Bouquet de jazmín y flores blancas; clásico, femenino, eternamente elegante.',
  },
  {
    id: 'dg_light_blue',
    nombre: 'Light Blue',
    casa: 'Dolce & Gabbana',
    año: 2001,
    notas: {
      salida: ['limón siciliano', 'manzana verde', 'cedro'],
      corazon: ['campanilla', 'jazmín', 'bambú'],
      fondo: ['cedro blanco', 'ámbar', 'almizcle'],
    },
    familia: 'cítrica',
    temporada: ['primavera', 'verano'],
    ocasion: ['diario', 'oficina'],
    proyeccion: 'moderada',
    duracion_horas: 6,
    precio_eur_100ml: 80,
    tier_precio: 'premium',
    genero: 'femenino',
    similares_a: ['armani_adgp', 'dior_jadore'],
    descripcion_corta:
      'Limón siciliano y manzana verde; veraniego, ligero, costero.',
  },

  /* === ASEQUIBLES / ÁRABES / CLONES ============================ */
  {
    id: 'lattafa_khamrah',
    nombre: 'Khamrah',
    casa: 'Lattafa',
    año: 2022,
    notas: {
      salida: ['canela', 'nuez moscada', 'bergamota'],
      corazon: ['dátiles', 'praliné', 'haba tonka', 'mirra'],
      fondo: ['vainilla', 'benjuí', 'guayaco', 'almizcle'],
    },
    familia: 'gourmand',
    temporada: ['otoño', 'invierno'],
    ocasion: ['noche', 'cita', 'diario'],
    proyeccion: 'fuerte',
    duracion_horas: 9,
    precio_eur_100ml: 38,
    tier_precio: 'asequible',
    genero: 'unisex',
    similares_a: ['kilian_angels_share', 'tf_tobacco_vanille', 'xerjoff_naxos'],
    descripcion_corta:
      'Dátiles especiados con praliné y vainilla; gourmand exuberante a precio modesto.',
  },
  {
    id: 'lattafa_asad',
    nombre: 'Asad',
    casa: 'Lattafa',
    año: 2021,
    notas: {
      salida: ['piña', 'casis', 'manzana', 'bergamota'],
      corazon: ['abedul', 'pachulí', 'rosa'],
      fondo: ['almizcle', 'roble', 'ámbar gris'],
    },
    familia: 'chipre',
    temporada: ['primavera', 'verano', 'otoño'],
    ocasion: ['oficina', 'diario', 'cita'],
    proyeccion: 'moderada',
    duracion_horas: 7,
    precio_eur_100ml: 32,
    tier_precio: 'asequible',
    genero: 'masculino',
    similares_a: ['creed_aventus', 'armaf_cdni'],
    descripcion_corta:
      'Interpretación accesible del perfil Aventus; piña con humo ligero, gran calidad-precio.',
  },
  {
    id: 'lattafa_yara',
    nombre: 'Yara',
    casa: 'Lattafa',
    año: 2020,
    notas: {
      salida: ['orquídea', 'frambuesa'],
      corazon: ['gardenia', 'jazmín'],
      fondo: ['sándalo', 'vainilla', 'almizcle'],
    },
    familia: 'gourmand',
    temporada: ['primavera', 'otoño', 'invierno'],
    ocasion: ['diario', 'cita'],
    proyeccion: 'fuerte',
    duracion_horas: 8,
    precio_eur_100ml: 28,
    tier_precio: 'asequible',
    genero: 'femenino',
    similares_a: ['lancome_lvib', 'tf_lost_cherry', 'pdm_delina'],
    descripcion_corta:
      'Frambuesa dulce con flores cremosas y vainilla; muy juvenil y complaciente.',
  },
  {
    id: 'lattafa_bade_oud',
    nombre: "Bade'e Al Oud Amethyst",
    casa: 'Lattafa',
    año: 2021,
    notas: {
      salida: ['azafrán', 'frambuesa', 'agárico'],
      corazon: ['oud', 'rosa', 'pachulí'],
      fondo: ['ámbar', 'almizcle', 'cuero'],
    },
    familia: 'oriental',
    temporada: ['otoño', 'invierno'],
    ocasion: ['noche', 'firma'],
    proyeccion: 'fuerte',
    duracion_horas: 9,
    precio_eur_100ml: 45,
    tier_precio: 'asequible',
    genero: 'unisex',
    similares_a: ['tf_oud_wood', 'amouage_interlude'],
    descripcion_corta:
      'Oud con rosa y frambuesa; árabe denso, oscuro, intenso para el frío.',
  },
  {
    id: 'armaf_cdni',
    nombre: 'Club de Nuit Intense Man',
    casa: 'Armaf',
    año: 2015,
    notas: {
      salida: ['limón', 'piña', 'bergamota', 'manzana'],
      corazon: ['abedul', 'rosa', 'jazmín'],
      fondo: ['almizcle', 'ámbar', 'vainilla'],
    },
    familia: 'chipre',
    temporada: ['primavera', 'verano', 'otoño'],
    ocasion: ['oficina', 'diario', 'cita'],
    proyeccion: 'fuerte',
    duracion_horas: 9,
    precio_eur_100ml: 52,
    tier_precio: 'asequible',
    genero: 'masculino',
    similares_a: ['creed_aventus', 'lattafa_asad'],
    descripcion_corta:
      'Clon clásico de Aventus con piña ahumada; relación calidad-precio referente.',
  },
  {
    id: 'armaf_ventana',
    nombre: 'Ventana',
    casa: 'Armaf',
    año: 2020,
    notas: {
      salida: ['bergamota', 'pimienta', 'mandarina'],
      corazon: ['lavanda', 'geranio', 'pimienta de Sichuan'],
      fondo: ['ambroxan', 'cedro', 'haba tonka'],
    },
    familia: 'fougère',
    temporada: ['primavera', 'verano', 'otoño'],
    ocasion: ['diario', 'oficina'],
    proyeccion: 'moderada',
    duracion_horas: 7,
    precio_eur_100ml: 35,
    tier_precio: 'asequible',
    genero: 'masculino',
    similares_a: ['dior_sauvage_edt', 'versace_eros', 'ysl_y_edp'],
    descripcion_corta:
      'Fresco especiado con ambroxan; alternativa al Sauvage por mucho menos.',
  },
  {
    id: 'alh_infini',
    nombre: 'Infini Rouge',
    casa: 'Maison Alhambra',
    año: 2022,
    notas: {
      salida: ['azafrán', 'jazmín'],
      corazon: ['amaranto', 'cedro'],
      fondo: ['ámbar', 'almizcle', 'resinas'],
    },
    familia: 'amaderada',
    temporada: ['otoño', 'invierno', 'primavera'],
    ocasion: ['noche', 'cita', 'diario'],
    proyeccion: 'fuerte',
    duracion_horas: 8,
    precio_eur_100ml: 42,
    tier_precio: 'asequible',
    genero: 'unisex',
    similares_a: ['mfk_br540', 'mfk_grand_soir'],
    descripcion_corta:
      'Aproximación accesible a Baccarat Rouge 540; ámbar azafranado a fracción del precio.',
  },
];

/* ============================================================
   CONSTANTES UI
   ============================================================ */
const PLACEHOLDER_EXAMPLES = [
  'Algo dulce para invierno, parecido a Baccarat Rouge 540 pero más asequible y para uso diario...',
  'Una fragancia masculina elegante para la oficina; fresca pero con presencia...',
  'Perfume floral para una primera cita en primavera, sin ser empalagoso...',
  'Un oriental especiado para noches frías; algo memorable y poco común...',
];

const EXAMPLE_QUERIES = [
  'Dame algo como Sauvage pero más maduro y menos común',
  'Perfume de oficina elegante para hombre por debajo de 60 €',
  'Algo gourmand para invierno bajo 80 € que dure todo el día',
  'El clon más fiel de Aventus por debajo de 60 €',
  'Mi pareja usa Coco Mademoiselle; quiero algo distinto pero compatible',
];

const BUDGET_OPTIONS = [
  { label: 'Sin límite', value: null },
  { label: '≤ 50 €', value: 50 },
  { label: '≤ 100 €', value: 100 },
  { label: '≤ 200 €', value: 200 },
];

const SEASON_OPTIONS = ['primavera', 'verano', 'otoño', 'invierno'];
const OCCASION_OPTIONS = ['diario', 'oficina', 'noche', 'cita', 'firma'];
const GENDER_OPTIONS = ['masculino', 'femenino', 'unisex'];

const STORAGE_KEYS = {
  FAVORITES: 'topnote.favorites.v1',
  HISTORY: 'topnote.history.v1',
};

const FAMILIA_LABELS = {
  amaderada: 'Amaderada',
  oriental: 'Oriental',
  floral: 'Floral',
  'cítrica': 'Cítrica',
  gourmand: 'Gourmand',
  chipre: 'Chipre',
  'fougère': 'Fougère',
};

const TIER_LABELS = {
  asequible: 'Asequible',
  medio: 'Medio',
  premium: 'Premium',
  lujo: 'Lujo',
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ============================================================
   ALMACENAMIENTO
   ============================================================ */
async function loadStorage(key, fallback) {
  try {
    const v = await window.storage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
async function saveStorage(key, value) {
  try {
    await window.storage.setItem(key, JSON.stringify(value));
  } catch {
    /* silencio */
  }
}

/* ============================================================
   LLAMADA A LA IA
   ============================================================ */
async function getRecommendations(query, filters, catalog) {
  const compact = catalog.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    casa: p.casa,
    año: p.año,
    notas: p.notas,
    familia: p.familia,
    temporada: p.temporada,
    ocasion: p.ocasion,
    proyeccion: p.proyeccion,
    duracion: p.duracion_horas,
    precio: p.precio_eur_100ml,
    tier: p.tier_precio,
    genero: p.genero,
    similares_a: p.similares_a,
    desc: p.descripcion_corta,
  }));

  const prompt = `Eres un experto perfumista profesional. Analiza la petición del usuario y el catálogo de fragancias, y devuelve EXCLUSIVAMENTE un array JSON con las 3 a 5 fragancias más relevantes, ordenadas de mayor a menor relevancia.

Cada elemento del array debe tener exactamente este formato:
{ "id": "<id_exacto_del_catalogo>", "score": <numero_0_100>, "reasoning": "<2-3 frases en español natural explicando por qué encaja con la petición concreta>" }

Reglas:
- Considera notas olfativas, familia, temporada, ocasión, presupuesto, género y referencias a otros perfumes.
- Si el usuario menciona un perfume del catálogo, prioriza los que estén en su campo "similares_a" o tengan notas/familia equivalente.
- Si pide ahorro, clon o económico, prioriza opciones del tier "asequible" con perfil olfativo similar.
- Respeta los filtros (presupuesto máximo, estación, ocasión, género) cuando estén indicados.
- El reasoning debe ser específico y mencionar notas o aspectos concretos de ese perfume que justifican el match. Nada genérico.
- Responde SOLO el array JSON. Sin markdown, sin bloques de código, sin texto introductorio.

PETICIÓN DEL USUARIO:
"${query}"

FILTROS APLICADOS:
${JSON.stringify(filters)}

CATÁLOGO:
${JSON.stringify(compact)}`;

  const raw = await window.claude.complete(prompt);

  let cleaned = String(raw).trim();
  // limpia fences ```json ... ``` por si acaso
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  // si hay texto antes/después, intenta extraer el array
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) cleaned = m[0];

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('La respuesta del perfumista no se ha podido interpretar. Reintente la consulta.');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('El perfumista no ha devuelto recomendaciones. Reformule la consulta.');
  }
  // filtra resultados con id válido
  const valid = parsed.filter((r) => r && r.id && CATALOG.some((p) => p.id === r.id));
  if (valid.length === 0) {
    throw new Error('Las recomendaciones no coinciden con el catálogo. Reintente.');
  }
  return valid.slice(0, 5);
}

/* ============================================================
   FAMILIAS — tinte cromático del frame
   ============================================================ */
const FAMILY_TINT = {
  gourmand:   { from: '#FFF3E0', to: '#FBDCBE', accent: '#C77F3E', soft: '#FDE9D2' },
  oriental:   { from: '#FAF1DC', to: '#F0DDB0', accent: '#A2791B', soft: '#F6E8C7' },
  amaderada:  { from: '#F2EDE2', to: '#D9CFB6', accent: '#7B6940', soft: '#EAE3D0' },
  floral:     { from: '#FFEFF4', to: '#FBD0DD', accent: '#C25577', soft: '#FBDFE8' },
  'cítrica':  { from: '#FBFCEA', to: '#E9EFA8', accent: '#8FA033', soft: '#F2F5C8' },
  chipre:     { from: '#EFF6E9', to: '#CDE4C0', accent: '#557C49', soft: '#DDEAD0' },
  'fougère':  { from: '#E9F4F1', to: '#C7E2DC', accent: '#3F7F73', soft: '#D4E8E2' },
};
const getTint = (fam) => FAMILY_TINT[fam] || { from: '#F5F6F8', to: '#EEEFF2', accent: '#6B7480', soft: '#F0F1F4' };

/* ============================================================
   COMPONENTE RAÍZ
   ============================================================ */
function TopNote() {
  const [view, setView] = useState('search'); // 'search' | 'results' | 'archive'
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ budget: null, season: null, occasion: null, gender: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [lastQuery, setLastQuery] = useState('');
  const [lastFilters, setLastFilters] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [detail, setDetail] = useState(null); // { perfume, score, reasoning }
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      const f = await loadStorage(STORAGE_KEYS.FAVORITES, []);
      const h = await loadStorage(STORAGE_KEYS.HISTORY, []);
      setFavorites(f);
      setHistory(h);
    })();
  }, []);

  // bloqueo de scroll cuando hay modal
  useEffect(() => {
    if (detail) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = orig; };
    }
  }, [detail]);

  // ESC cierra modal
  useEffect(() => {
    if (!detail) return;
    const onKey = (e) => { if (e.key === 'Escape') setDetail(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail]);

  async function runQuery(q, f) {
    const useF = f || filters;
    setQuery(q);
    setFilters(useF);
    setLastQuery(q);
    setLastFilters(useF);
    setLoading(true);
    setError(null);
    setResults([]);
    setView('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const recs = await getRecommendations(q, useF, CATALOG);
      setResults(recs);
      const entry = { query: q, filters: useF, timestamp: Date.now() };
      const newHist = [entry, ...history.filter((h) => h.query !== q)].slice(0, 10);
      setHistory(newHist);
      await saveStorage(STORAGE_KEYS.HISTORY, newHist);
    } catch (err) {
      setError(err.message || 'No se ha podido completar la consulta.');
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = () => {
    if (!query.trim() || loading) return;
    runQuery(query.trim(), filters);
  };

  const onRetry = () => { if (lastQuery) runQuery(lastQuery, lastFilters); };

  const toggleFavorite = async (id) => {
    const newFavs = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    setFavorites(newFavs);
    await saveStorage(STORAGE_KEYS.FAVORITES, newFavs);
  };

  const onCardOpen = (data) => setDetail(data);
  const onCloseDetail = () => setDetail(null);

  const onSimilar = (perfume) => {
    setDetail(null);
    const q = `Recomiéndame fragancias similares a ${perfume.nombre} de ${perfume.casa}, con perfil olfativo equivalente; incluye opciones premium y alternativas más accesibles.`;
    runQuery(q, { budget: null, season: null, occasion: null, gender: null });
  };

  const onRunHistory = (h) => runQuery(h.query, h.filters);

  const onPickExample = (ex) => {
    setQuery(ex);
    // foco implícito al cambiar el value
  };

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh' }}>
      <ThemeStyles />
      <Header
        view={view}
        setView={setView}
        favoritesCount={favorites.length}
        historyCount={history.length}
        onToggleFilters={() => setShowFilters((s) => !s)}
      />

      {view === 'search' && (
        <SearchView
          query={query}
          setQuery={setQuery}
          onSubmit={onSubmit}
          loading={loading}
          error={error}
          onRetry={onRetry}
          filters={filters}
          setFilters={setFilters}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          onExample={onPickExample}
        />
      )}

      {view === 'results' && (
        <ResultsView
          query={lastQuery || query}
          filters={lastFilters || filters}
          results={results}
          loading={loading}
          error={error}
          onBack={() => setView('search')}
          onRetry={onRetry}
          onCardOpen={onCardOpen}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
        />
      )}

      {view === 'archive' && (
        <ArchiveView
          favorites={favorites}
          history={history}
          toggleFavorite={toggleFavorite}
          onCardOpen={onCardOpen}
          onRunHistory={onRunHistory}
          onGoSearch={() => setView('search')}
        />
      )}

      {detail && (
        <DetailModal
          {...detail}
          isFavorite={favorites.includes(detail.perfume.id)}
          onToggleFavorite={() => toggleFavorite(detail.perfume.id)}
          onSimilar={() => onSimilar(detail.perfume)}
          onClose={onCloseDetail}
        />
      )}
    </div>
  );
}

/* ============================================================
   ESTILOS GLOBALES — clonando el lenguaje visual del HTML original
   ============================================================ */
function ThemeStyles() {
  return (
    <style>{`
      :root {
        --bg:         #FFFFFF;
        --bg-soft:    #F5F6F8;
        --bg-card:    #FAFAFC;
        --ink:        #0A0F1F;
        --ink-mute:   #6B7480;
        --ink-soft:   #2A2F3F;
        --line:       #EEEFF2;
        --blue:       #4FB5E8;
        --blue-press: #2E9BD9;
        --blue-soft:  #E5F4FD;
      }

      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        margin: 0; padding: 0;
        background: var(--bg);
        color: var(--ink);
        font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        font-size: 15px;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
        font-feature-settings: "ss01", "cv11";
      }
      button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; }
      input { font: inherit; }

      /* Layout */
      .tn-main { max-width: 1400px; margin: 0 auto; padding: 0 40px; }

      /* ─── Header ───────────────────────────────────────────────── */
      .tn-header {
        position: sticky; top: 0; z-index: 50;
        background: rgba(255,255,255,0.85);
        backdrop-filter: saturate(1.4) blur(12px);
        -webkit-backdrop-filter: saturate(1.4) blur(12px);
        border-bottom: 1px solid var(--line);
      }
      .tn-head {
        max-width: 1400px; margin: 0 auto;
        display: flex; align-items: center; justify-content: space-between;
        padding: 18px 40px; gap: 24px;
      }
      .tn-brand {
        display: flex; align-items: center; gap: 9px;
        font-weight: 600; font-size: 17px; letter-spacing: -0.02em;
        color: var(--ink);
      }
      .tn-brand-dot {
        width: 10px; height: 10px; border-radius: 50%;
        background: var(--blue);
        box-shadow: 0 0 0 4px rgba(79,181,232,0.18);
      }
      .tn-nav { display: flex; gap: 2px; font-size: 14px; font-weight: 500; }
      .tn-nav button {
        padding: 8px 14px; border-radius: 8px; color: var(--ink-mute);
        transition: color 0.15s ease, background 0.15s ease;
      }
      .tn-nav button:hover { color: var(--ink); }
      .tn-nav button.on { color: var(--ink); background: var(--bg-soft); }
      .tn-nav button .pip {
        display: inline-block; margin-left: 6px;
        background: var(--blue); color: #fff;
        font-size: 10.5px; font-weight: 600;
        padding: 1px 6px; border-radius: 999px;
        vertical-align: 1px;
      }
      .tn-head-r { display: flex; align-items: center; gap: 10px; }
      .tn-iconbtn {
        width: 38px; height: 38px; border-radius: 10px;
        display: inline-flex; align-items: center; justify-content: center;
        color: var(--ink-mute);
        transition: background 0.15s ease, color 0.15s ease;
        position: relative;
      }
      .tn-iconbtn:hover { background: var(--bg-soft); color: var(--ink); }
      .tn-iconbtn.on { background: var(--blue-soft); color: var(--blue-press); }
      .tn-iconbtn .badge-num {
        position: absolute; top: 4px; right: 4px;
        min-width: 14px; height: 14px; padding: 0 3px;
        border-radius: 999px; background: var(--blue); color: #fff;
        font-size: 9.5px; font-weight: 700; line-height: 14px;
        display: flex; align-items: center; justify-content: center;
      }
      .tn-av {
        width: 34px; height: 34px; border-radius: 50%;
        background: linear-gradient(135deg, var(--blue), #A7DDFC);
        color: #fff; font-weight: 600; font-size: 12px; letter-spacing: 0.02em;
        display: flex; align-items: center; justify-content: center;
      }

      /* ─── Hero ─────────────────────────────────────────────────── */
      .tn-hero { padding: 96px 0 64px; display: grid; gap: 0; position: relative; }
      .tn-pill {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 6px 12px 6px 8px; border-radius: 999px;
        background: var(--bg-soft);
        font-size: 12.5px; color: var(--ink-mute); font-weight: 500;
        width: fit-content; align-self: flex-start;
      }
      .tn-pill .dot {
        width: 8px; height: 8px; border-radius: 50%; background: var(--blue);
        animation: tn-ping 1.8s infinite;
      }
      @keyframes tn-ping {
        0% { box-shadow: 0 0 0 0 rgba(79,181,232,0.5); }
        70% { box-shadow: 0 0 0 9px rgba(79,181,232,0); }
        100% { box-shadow: 0 0 0 0 rgba(79,181,232,0); }
      }
      .tn-title {
        font-size: clamp(64px, 8.5vw, 120px);
        line-height: 0.92; letter-spacing: -0.045em; font-weight: 600;
        margin-top: 28px; max-width: 14ch; text-wrap: balance;
      }
      .tn-title em { font-style: normal; color: var(--blue); }
      .tn-sub {
        color: var(--ink-mute); font-size: 17px; margin-top: 20px; max-width: 560px;
      }

      /* Composer */
      .tn-composer {
        margin-top: 44px; max-width: 820px;
        display: grid; grid-template-columns: 1fr auto;
        gap: 14px; align-items: center;
        border-bottom: 1.5px solid var(--ink);
        padding-bottom: 14px;
        transition: border-color 0.2s ease;
      }
      .tn-composer:focus-within { border-color: var(--blue); }
      .tn-composer input {
        width: 100%; border: 0; outline: 0; background: transparent;
        font-size: 22px; font-weight: 400; color: var(--ink);
        padding: 14px 0; letter-spacing: -0.01em;
      }
      .tn-composer input::placeholder { color: var(--ink-mute); }
      .tn-go {
        width: 54px; height: 54px; border-radius: 50%;
        background: var(--blue); color: #fff;
        display: inline-flex; align-items: center; justify-content: center;
        transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
        box-shadow: 0 6px 20px rgba(79,181,232,0.45);
      }
      .tn-go:hover:not(:disabled) { background: var(--blue-press); transform: translateX(3px); }
      .tn-go:disabled { background: var(--ink-mute); box-shadow: none; cursor: not-allowed; opacity: 0.55; }
      .tn-go.loading { animation: tn-pulse 1.5s ease-in-out infinite; }
      @keyframes tn-pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 6px 20px rgba(79,181,232,0.45); }
        50% { transform: scale(1.05); box-shadow: 0 6px 28px rgba(79,181,232,0.65); }
      }

      /* Tags */
      .tn-tags {
        margin-top: 22px;
        display: flex; flex-wrap: wrap; gap: 8px; max-width: 820px;
      }
      .tn-tag {
        font-size: 13.5px; color: var(--ink-mute); font-weight: 500;
        padding: 8px 14px; border-radius: 999px;
        background: var(--bg-soft);
        transition: background 0.15s ease, color 0.15s ease;
      }
      .tn-tag:hover { background: var(--blue-soft); color: var(--blue-press); }
      .tn-tag.act { background: var(--ink); color: #fff; }
      .tn-tag.icon { display: inline-flex; align-items: center; gap: 6px; }

      /* Filter panel */
      .tn-filters {
        margin-top: 24px; max-width: 820px;
        background: var(--bg-card); border: 1px solid var(--line); border-radius: 14px;
        padding: 20px 22px;
        animation: tn-fadeDown 0.25s ease-out;
      }
      @keyframes tn-fadeDown {
        from { opacity: 0; transform: translateY(-6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .tn-filter-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px 28px; }
      @media (min-width: 760px) { .tn-filter-grid { grid-template-columns: repeat(4, 1fr); } }
      .tn-flabel {
        font-size: 11px; font-weight: 600; color: var(--ink-mute);
        text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px;
      }
      .tn-fchips { display: flex; flex-wrap: wrap; gap: 6px; }
      .tn-fchip {
        font-size: 12.5px; padding: 6px 11px; border-radius: 999px;
        background: var(--bg); color: var(--ink-soft);
        border: 1px solid var(--line);
        transition: all 0.15s ease;
      }
      .tn-fchip:hover { border-color: var(--blue); color: var(--blue-press); }
      .tn-fchip.on {
        background: var(--ink); color: #fff; border-color: var(--ink);
      }
      .tn-clear {
        margin-top: 14px; font-size: 12.5px; color: var(--ink-mute);
        display: inline-flex; align-items: center; gap: 4px;
      }
      .tn-clear:hover { color: var(--ink); }

      /* Error banner */
      .tn-error {
        margin-top: 28px; max-width: 820px;
        border-radius: 12px; padding: 16px 20px;
        background: #FFF2EF; border: 1px solid #F2C5BA; color: #8C2D14;
        display: flex; align-items: center; justify-content: space-between; gap: 14px;
      }
      .tn-error b { font-weight: 600; }
      .tn-error button {
        font-size: 13px; font-weight: 500; color: #8C2D14;
        text-decoration: underline;
      }

      /* ─── Split section header ─────────────────────────────────── */
      .tn-split {
        margin-top: 96px; padding-top: 48px;
        border-top: 1px solid var(--line);
        display: flex; justify-content: space-between; align-items: baseline;
        gap: 18px; flex-wrap: wrap;
      }
      .tn-split h2 {
        font-size: 42px; font-weight: 600; letter-spacing: -0.025em; line-height: 1.05;
      }
      .tn-split h2 .count {
        color: var(--ink-mute); font-weight: 500;
        margin-left: 14px; font-size: 18px; vertical-align: 8px;
      }
      .tn-split .meta {
        font-size: 14px; color: var(--ink-mute);
        display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
      }
      .tn-split .meta b { color: var(--ink); font-weight: 500; }
      .tn-sort {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 9px 14px; border-radius: 10px;
        background: var(--bg-soft); font-size: 13.5px; font-weight: 500;
        color: var(--ink);
        transition: background 0.15s ease;
      }
      .tn-sort:hover { background: var(--blue-soft); color: var(--blue-press); }

      /* ─── Card grid ────────────────────────────────────────────── */
      .tn-grid {
        margin-top: 36px; padding-bottom: 64px;
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
      }
      .tn-card {
        cursor: pointer; display: flex; flex-direction: column; gap: 14px;
        position: relative;
        transition: transform 0.25s cubic-bezier(0.2, 0.7, 0.3, 1);
        text-align: left;
      }
      .tn-card:hover { transform: translateY(-4px); }

      .tn-frame {
        position: relative; aspect-ratio: 4 / 5;
        border-radius: 18px; overflow: hidden;
        box-shadow: 0 0 0 1px var(--line);
        display: flex; align-items: center; justify-content: center;
      }
      .tn-frame::after {
        content: ""; position: absolute; inset: 0; z-index: 1;
        background: radial-gradient(ellipse at 50% 110%, rgba(79,181,232,0.10), transparent 65%);
        pointer-events: none;
      }
      .tn-frame::before {
        content: ""; position: absolute; inset: 0; z-index: 0;
        background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 50%);
        pointer-events: none;
      }
      .tn-frame svg.tn-bottle {
        position: relative; z-index: 1;
        width: 50%; height: auto;
        filter: drop-shadow(0 10px 22px rgba(10,15,31,0.10));
      }

      .tn-badge {
        position: absolute; left: 14px; top: 14px; z-index: 3;
        background: rgba(255,255,255,0.92);
        -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
        border-radius: 999px; padding: 6px 11px 6px 8px;
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12.5px; font-weight: 600; letter-spacing: -0.005em;
        color: var(--ink);
        box-shadow: 0 2px 8px rgba(10,15,31,0.06);
      }
      .tn-badge .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--blue); }
      .tn-badge.top .dot { box-shadow: 0 0 0 3px rgba(79,181,232,0.28); }

      .tn-heart {
        position: absolute; right: 14px; top: 14px; z-index: 3;
        width: 34px; height: 34px; border-radius: 50%;
        background: rgba(255,255,255,0.92);
        -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
        display: inline-flex; align-items: center; justify-content: center;
        color: var(--ink-mute);
        box-shadow: 0 2px 8px rgba(10,15,31,0.06);
        transition: color 0.15s ease, background 0.15s ease, transform 0.15s ease;
      }
      .tn-heart:hover { color: var(--blue-press); transform: scale(1.06); }
      .tn-heart.on { color: #fff; background: var(--blue); }

      .tn-corner {
        position: absolute; left: 14px; bottom: 14px; z-index: 3;
        font-size: 10.5px; font-weight: 600; color: var(--ink);
        background: rgba(255,255,255,0.85);
        -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
        padding: 4px 9px; border-radius: 999px; letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      .tn-name {
        display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
      }
      .tn-who {
        font-size: 19px; font-weight: 600; letter-spacing: -0.015em;
        line-height: 1.15; color: var(--ink);
      }
      .tn-who small {
        display: block; font-size: 13px; font-weight: 500; color: var(--ink-mute);
        margin-top: 2px; letter-spacing: 0;
      }
      .tn-px {
        font-size: 18px; font-weight: 600; letter-spacing: -0.015em;
        color: var(--ink); white-space: nowrap;
      }
      .tn-notes {
        font-size: 13.5px; color: var(--ink-mute); line-height: 1.5; margin-top: -4px;
      }

      /* Skeleton */
      .tn-skel {
        background: linear-gradient(90deg, var(--bg-soft) 0%, #F0F1F4 50%, var(--bg-soft) 100%);
        background-size: 200% 100%;
        animation: tn-shimmer 1.4s linear infinite;
        border-radius: 8px;
      }
      @keyframes tn-shimmer {
        from { background-position: 200% 0; }
        to   { background-position: -200% 0; }
      }
      .tn-skel-frame {
        aspect-ratio: 4 / 5; border-radius: 18px; box-shadow: 0 0 0 1px var(--line);
      }
      .tn-skel-line { height: 14px; }
      .tn-skel-line.sm { width: 60%; height: 11px; }

      /* History list */
      .tn-hist {
        margin-top: 24px; padding-bottom: 64px;
        display: grid; gap: 10px; max-width: 980px;
      }
      .tn-hist button {
        display: flex; align-items: center; gap: 14px; width: 100%;
        padding: 14px 18px; border-radius: 12px;
        background: var(--bg-soft);
        text-align: left; transition: background 0.15s ease;
      }
      .tn-hist button:hover { background: var(--blue-soft); }
      .tn-hist .hi { color: var(--ink-mute); flex-shrink: 0; }
      .tn-hist .hq {
        flex: 1; font-size: 14.5px; color: var(--ink); font-weight: 500;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .tn-hist .hd { font-size: 12px; color: var(--ink-mute); white-space: nowrap; }

      /* Empty state */
      .tn-empty {
        margin-top: 36px; padding: 56px 28px;
        text-align: center; background: var(--bg-card);
        border: 1px dashed var(--line); border-radius: 16px;
      }
      .tn-empty p { color: var(--ink-mute); font-size: 16px; margin-bottom: 18px; }
      .tn-empty button {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 10px 18px; border-radius: 999px;
        background: var(--ink); color: #fff; font-size: 13.5px; font-weight: 500;
        transition: background 0.15s ease;
      }
      .tn-empty button:hover { background: #1F2540; }

      /* ─── Modal ────────────────────────────────────────────────── */
      .tn-modal-bg {
        position: fixed; inset: 0; z-index: 100;
        background: rgba(10,15,31,0.45);
        -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        padding: 24px;
        animation: tn-fadeIn 0.2s ease-out;
      }
      @keyframes tn-fadeIn { from { opacity: 0; } to { opacity: 1; } }
      .tn-modal {
        background: var(--bg); border-radius: 22px; overflow: hidden;
        width: 100%; max-width: 1080px; max-height: 92vh; overflow-y: auto;
        box-shadow: 0 30px 80px rgba(10,15,31,0.25);
        position: relative;
        animation: tn-modalUp 0.3s cubic-bezier(0.2, 0.7, 0.3, 1);
      }
      @keyframes tn-modalUp {
        from { opacity: 0; transform: translateY(20px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .tn-modal-close {
        position: absolute; top: 18px; right: 18px; z-index: 5;
        width: 38px; height: 38px; border-radius: 50%;
        background: rgba(255,255,255,0.85); color: var(--ink-mute);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 10px rgba(10,15,31,0.10);
        transition: color 0.15s ease, transform 0.15s ease;
      }
      .tn-modal-close:hover { color: var(--ink); transform: rotate(90deg); }

      .tn-modal-grid {
        display: grid; grid-template-columns: 1fr; gap: 0;
      }
      @media (min-width: 880px) {
        .tn-modal-grid { grid-template-columns: 0.85fr 1fr; min-height: 600px; }
      }
      .tn-modal-frame {
        position: relative; padding: 60px 40px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        min-height: 360px;
      }
      .tn-modal-frame::after {
        content: ""; position: absolute; inset: 0;
        background: radial-gradient(ellipse at 50% 110%, rgba(79,181,232,0.18), transparent 65%);
        pointer-events: none;
      }
      .tn-modal-frame svg.tn-bottle-lg { width: 200px; height: auto; position: relative; z-index: 1; }
      .tn-modal-info {
        padding: 36px 40px 40px;
        display: flex; flex-direction: column; gap: 18px;
      }
      .tn-modal-info h2 {
        font-size: 36px; font-weight: 600; letter-spacing: -0.025em; line-height: 1.05;
      }
      .tn-modal-house { font-size: 14px; color: var(--ink-mute); margin-top: -8px; }
      .tn-modal-desc { font-size: 15.5px; color: var(--ink-soft); line-height: 1.55; }

      .tn-modal-meta {
        display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 24px;
        padding: 18px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
      }
      .tn-modal-meta > div { display: flex; flex-direction: column; gap: 3px; }
      .tn-modal-meta .label {
        font-size: 11px; color: var(--ink-mute); text-transform: uppercase;
        letter-spacing: 0.08em; font-weight: 600;
      }
      .tn-modal-meta .value { font-size: 15px; color: var(--ink); font-weight: 500; }

      .tn-pyr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
      .tn-pyr-col { display: flex; flex-direction: column; gap: 6px; }
      .tn-pyr-h {
        font-size: 11px; color: var(--blue-press); text-transform: uppercase;
        letter-spacing: 0.08em; font-weight: 600;
        padding-bottom: 6px; border-bottom: 1px solid var(--line); margin-bottom: 4px;
      }
      .tn-pyr-col li { font-size: 13.5px; color: var(--ink-soft); list-style: none; line-height: 1.45; }

      .tn-reason {
        background: var(--blue-soft); border-radius: 14px; padding: 18px 20px;
      }
      .tn-reason .label {
        font-size: 11px; color: var(--blue-press); text-transform: uppercase;
        letter-spacing: 0.08em; font-weight: 600; margin-bottom: 8px;
        display: flex; align-items: center; gap: 6px;
      }
      .tn-reason p {
        font-size: 14.5px; color: var(--ink); line-height: 1.55;
      }

      .tn-modal-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
      .tn-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        padding: 12px 20px; border-radius: 12px; font-size: 14px; font-weight: 500;
        transition: all 0.18s ease;
      }
      .tn-btn-primary {
        background: var(--ink); color: #fff;
        box-shadow: 0 4px 14px rgba(10,15,31,0.20);
      }
      .tn-btn-primary:hover { background: #1F2540; transform: translateY(-1px); }
      .tn-btn-ghost {
        background: var(--bg-soft); color: var(--ink);
      }
      .tn-btn-ghost:hover { background: var(--blue-soft); color: var(--blue-press); }
      .tn-btn-ghost.on { background: var(--blue); color: #fff; }

      /* ─── Footer ───────────────────────────────────────────────── */
      .tn-footer {
        margin-top: 48px; padding: 28px 0 36px;
        border-top: 1px solid var(--line);
        display: flex; justify-content: space-between; align-items: center;
        font-size: 12.5px; color: var(--ink-mute); flex-wrap: wrap; gap: 10px;
      }
      .tn-footer .dot {
        display: inline-block; width: 6px; height: 6px; border-radius: 50%;
        background: var(--blue); margin: 0 8px; vertical-align: 2px;
      }

      /* ─── Responsive ───────────────────────────────────────────── */
      @media (max-width: 980px) {
        .tn-head { padding: 14px 24px; }
        .tn-main { padding: 0 24px; }
        .tn-grid { grid-template-columns: repeat(2, 1fr); gap: 18px; }
        .tn-split { flex-direction: column; align-items: flex-start; gap: 14px; }
        .tn-hero { padding: 48px 0 32px; }
        .tn-composer input { font-size: 18px; }
        .tn-title { font-size: clamp(48px, 11vw, 72px); }
      }
      @media (max-width: 560px) {
        .tn-grid { grid-template-columns: 1fr; }
        .tn-nav { display: none; }
        .tn-modal-info { padding: 24px 22px 30px; }
        .tn-modal-info h2 { font-size: 28px; }
        .tn-modal-meta { grid-template-columns: 1fr 1fr; gap: 12px 16px; }
        .tn-modal-frame { min-height: 280px; padding: 40px 20px; }
        .tn-modal-frame svg.tn-bottle-lg { width: 150px; }
      }

      /* Focus visible */
      *:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 4px; }
      .tn-composer input:focus-visible { outline: none; }

      /* Scrollbar */
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: var(--line); border-radius: 999px; border: 2px solid var(--bg); }
      ::-webkit-scrollbar-thumb:hover { background: var(--ink-mute); }
    `}</style>
  );
}

/* ============================================================
   HEADER
   ============================================================ */
function Header({ view, setView, favoritesCount, historyCount, onToggleFilters }) {
  return (
    <header className="tn-header">
      <div className="tn-head">
        <button className="tn-brand" onClick={() => setView('search')}>
          <span className="tn-brand-dot" />
          topnote
        </button>
        <nav className="tn-nav">
          <button className={view === 'search' ? 'on' : ''} onClick={() => setView('search')}>
            Buscar
          </button>
          <button className={view === 'results' ? 'on' : ''} onClick={() => setView('results')}>
            Resultados
          </button>
          <button className={view === 'archive' ? 'on' : ''} onClick={() => setView('archive')}>
            Guardados
            {favoritesCount > 0 && <span className="pip">{favoritesCount}</span>}
          </button>
        </nav>
        <div className="tn-head-r">
          <button className="tn-iconbtn" title="Filtros" onClick={onToggleFilters}>
            <SvgFilter />
          </button>
          <button className="tn-iconbtn" title="Historial" onClick={() => setView('archive')}>
            <Clock size={18} />
            {historyCount > 0 && <span className="badge-num">{historyCount}</span>}
          </button>
          <div className="tn-av">A</div>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   SEARCH VIEW
   ============================================================ */
const QUICK_TAGS = [
  { label: 'Dulce para invierno', q: 'Algo dulce y cálido para invierno' },
  { label: 'Como Sauvage pero más maduro', q: 'Algo como Sauvage pero más maduro y menos común' },
  { label: 'Oficina, bajo 60 €', q: 'Perfume elegante para oficina por debajo de 60 €' },
  { label: 'Gourmand bajo 80 €', q: 'Algo gourmand para invierno bajo 80 € que dure todo el día' },
  { label: 'Clon de Aventus barato', q: 'El clon más fiel de Aventus por debajo de 60 €' },
  { label: 'Floral primera cita', q: 'Perfume floral para una primera cita en primavera, sin ser empalagoso' },
];

const PLACEHOLDERS = [
  'Descríbelo. Dulce para invierno, parecido a Sauvage pero más asequible…',
  'Un perfume gourmand bajo 80 € que dure todo el día…',
  'Algo masculino para la oficina, fresco pero con presencia…',
  'Un oriental especiado para noches frías, poco común…',
];

function SearchView({ query, setQuery, onSubmit, loading, error, onRetry, filters, setFilters, showFilters, setShowFilters, onExample }) {
  const inputRef = useRef(null);
  const [phIdx, setPhIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 4500);
    return () => clearInterval(t);
  }, []);

  const activeQ = query.trim().toLowerCase();
  const activeFilterCount = Object.values(filters).filter((v) => v !== null).length;

  return (
    <main className="tn-main">
      <section className="tn-hero">
        <span className="tn-pill">
          <span className="dot" />
          IA · En línea
        </span>
        <h1 className="tn-title">
          Encuentra tu <em>aroma.</em>
        </h1>
        <p className="tn-sub">
          Describe lo que buscas en lenguaje natural. Cruzamos {CATALOG.length} fragancias del
          catálogo y devolvemos las más afines, con justificación.
        </p>

        <form
          className="tn-composer"
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={PLACEHOLDERS[phIdx]}
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            className={'tn-go' + (loading ? ' loading' : '')}
            disabled={!query.trim() || loading}
            aria-label="Buscar"
          >
            <SvgArrowRightThick />
          </button>
        </form>

        <div className="tn-tags">
          {QUICK_TAGS.map((t, i) => {
            const isActive = activeQ === t.q.toLowerCase();
            return (
              <button
                key={i}
                className={'tn-tag' + (isActive ? ' act' : '')}
                onClick={() => onExample(t.q)}
                type="button"
              >
                {t.label}
              </button>
            );
          })}
          <button
            className={'tn-tag icon' + (showFilters ? ' act' : '')}
            onClick={() => setShowFilters(!showFilters)}
            type="button"
            aria-expanded={showFilters}
          >
            <SvgFilter size={13} stroke={2} /> Filtros
            {activeFilterCount > 0 && (
              <span style={{
                marginLeft: 4, background: showFilters ? '#fff' : 'var(--blue)',
                color: showFilters ? 'var(--ink)' : '#fff',
                fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
              }}>{activeFilterCount}</span>
            )}
          </button>
        </div>

        {showFilters && (
          <FilterPanel filters={filters} setFilters={setFilters} />
        )}

        {error && (
          <div className="tn-error">
            <span><b>Error:</b> {error}</span>
            <button onClick={onRetry || onSubmit}>Reintentar →</button>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}

/* ============================================================
   FILTER PANEL
   ============================================================ */
function FilterPanel({ filters, setFilters }) {
  const set = (key, val) =>
    setFilters((f) => ({ ...f, [key]: f[key] === val ? null : val }));

  const clear = () => setFilters({ budget: null, season: null, occasion: null, gender: null });

  return (
    <div className="tn-filters">
      <div className="tn-filter-grid">
        <FilterGroup label="Presupuesto">
          {BUDGET_OPTIONS.map((o) => (
            <button
              key={o.label}
              className={'tn-fchip' + (filters.budget === o.value ? ' on' : '')}
              onClick={() => set('budget', o.value)}
            >{o.label}</button>
          ))}
        </FilterGroup>
        <FilterGroup label="Estación">
          {SEASON_OPTIONS.map((s) => (
            <button
              key={s}
              className={'tn-fchip' + (filters.season === s ? ' on' : '')}
              onClick={() => set('season', s)}
            >{cap(s)}</button>
          ))}
        </FilterGroup>
        <FilterGroup label="Ocasión">
          {OCCASION_OPTIONS.map((o) => (
            <button
              key={o}
              className={'tn-fchip' + (filters.occasion === o ? ' on' : '')}
              onClick={() => set('occasion', o)}
            >{cap(o)}</button>
          ))}
        </FilterGroup>
        <FilterGroup label="Género">
          {GENDER_OPTIONS.map((g) => (
            <button
              key={g}
              className={'tn-fchip' + (filters.gender === g ? ' on' : '')}
              onClick={() => set('gender', g)}
            >{cap(g)}</button>
          ))}
        </FilterGroup>
      </div>
      {Object.values(filters).some((v) => v !== null) && (
        <button className="tn-clear" onClick={clear}>
          × Limpiar filtros
        </button>
      )}
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div>
      <div className="tn-flabel">{label}</div>
      <div className="tn-fchips">{children}</div>
    </div>
  );
}

/* ============================================================
   RESULTS VIEW
   ============================================================ */
function ResultsView({ query, filters, results, loading, error, onBack, onRetry, onCardOpen, favorites, toggleFavorite }) {
  const activeF = [
    filters?.budget != null && `≤ ${filters.budget} €`,
    filters?.season && cap(filters.season),
    filters?.occasion && cap(filters.occasion),
    filters?.gender && cap(filters.gender),
  ].filter(Boolean);

  return (
    <main className="tn-main">
      <section className="tn-split" style={{ marginTop: 56 }}>
        <h2>
          {loading ? 'Buscando…' : 'Tus coincidencias'}
          {!loading && results.length > 0 && <span className="count">{results.length}</span>}
        </h2>
        <div className="meta">
          <span>Para <b>"{query}"</b></span>
          {activeF.length > 0 && (
            <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
              {activeF.map((f, i) => (
                <span key={i} style={{
                  background: 'var(--bg-soft)', padding: '3px 9px', borderRadius: 999,
                  fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)',
                }}>{f}</span>
              ))}
            </span>
          )}
          <button className="tn-sort" onClick={onBack}>
            <SvgArrowLeft size={14} /> Nueva búsqueda
          </button>
        </div>
      </section>

      {loading && <LoadingGrid />}

      {error && !loading && (
        <div className="tn-error" style={{ marginTop: 36, maxWidth: 'none' }}>
          <span><b>El perfumista no ha podido responder:</b> {error}</span>
          <button onClick={onRetry}>Reintentar →</button>
        </div>
      )}

      {!loading && !error && results.length > 0 && (
        <section className="tn-grid">
          {results.map((r, i) => {
            const p = CATALOG.find((x) => x.id === r.id);
            if (!p) return null;
            return (
              <PerfumeCard
                key={r.id}
                perfume={p}
                rank={i + 1}
                score={r.score}
                isFavorite={favorites.includes(r.id)}
                onToggleFavorite={() => toggleFavorite(r.id)}
                onOpen={() => onCardOpen({ perfume: p, score: r.score, reasoning: r.reasoning })}
              />
            );
          })}
        </section>
      )}

      <Footer />
    </main>
  );
}

/* ============================================================
   PERFUME CARD
   ============================================================ */
function PerfumeCard({ perfume, rank, score, isFavorite, onToggleFavorite, onOpen }) {
  const tint = getTint(perfume.familia);
  const initial = perfume.nombre.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || 'T';
  const notesSummary = [
    perfume.notas.salida[0],
    perfume.notas.corazon[0],
    perfume.notas.fondo[0],
  ].filter(Boolean).join(' · ');

  const isTop = rank === 1 && score != null;

  return (
    <article className="tn-card" onClick={onOpen}>
      <div className="tn-frame" style={{
        background: `linear-gradient(160deg, ${tint.from} 0%, ${tint.to} 100%)`,
      }}>
        {score != null && (
          <span className={'tn-badge' + (isTop ? ' top' : '')}>
            <span className="dot" />
            {score}% {isTop && '· top'}
          </span>
        )}
        <button
          className={'tn-heart' + (isFavorite ? ' on' : '')}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          aria-label={isFavorite ? 'Quitar de guardados' : 'Guardar'}
          aria-pressed={isFavorite}
        >
          <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={1.4} />
        </button>
        <span className="tn-corner">{FAMILIA_LABELS[perfume.familia] || perfume.familia}</span>

        <Bottle accent={tint.accent} body={tint.soft} initial={initial} />
      </div>

      <div className="tn-name">
        <div className="tn-who">
          {perfume.nombre}
          <small>{perfume.casa}</small>
        </div>
        <div className="tn-px">{perfume.precio_eur_100ml}&nbsp;€</div>
      </div>
      <p className="tn-notes">{notesSummary}</p>
    </article>
  );
}

/* ============================================================
   BOTELLA SVG — sustitutivo de imagen real
   ============================================================ */
function Bottle({ accent, body, initial, large = false }) {
  return (
    <svg
      className={large ? 'tn-bottle-lg' : 'tn-bottle'}
      viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* tapón */}
      <rect x="46" y="6" width="28" height="16" rx="3" fill={accent} opacity="0.85" />
      <rect x="46" y="6" width="28" height="4" rx="2" fill={accent} />
      {/* cuello */}
      <rect x="52" y="22" width="16" height="10" fill={accent} opacity="0.75" />
      {/* hombros */}
      <path d="M 30 36 Q 30 32 38 32 L 82 32 Q 90 32 90 36 L 90 50 L 30 50 Z" fill={accent} opacity="0.20" />
      {/* cuerpo */}
      <rect x="22" y="46" width="76" height="108" rx="8" fill={body} stroke={accent} strokeWidth="1.3" />
      {/* etiqueta */}
      <rect x="32" y="78" width="56" height="44" rx="2" fill="rgba(255,255,255,0.55)" stroke={accent} strokeWidth="0.8" strokeOpacity="0.5" />
      {/* inicial */}
      <text
        x="60" y="110"
        textAnchor="middle"
        fontFamily="Geist, serif"
        fontSize="32" fontWeight="600"
        fill={accent}
        letterSpacing="-0.04em"
      >{initial}</text>
      {/* brillo lateral */}
      <rect x="26" y="50" width="6" height="100" rx="3" fill="rgba(255,255,255,0.45)" />
    </svg>
  );
}

/* ============================================================
   LOADING GRID
   ============================================================ */
function LoadingGrid() {
  return (
    <section className="tn-grid">
      {[0,1,2,3].map((i) => (
        <div key={i} className="tn-card" style={{ cursor: 'default' }}>
          <div className="tn-skel tn-skel-frame" />
          <div className="tn-skel tn-skel-line" style={{ width: '70%' }} />
          <div className="tn-skel tn-skel-line sm" />
        </div>
      ))}
    </section>
  );
}

/* ============================================================
   ARCHIVE VIEW
   ============================================================ */
function ArchiveView({ favorites, history, toggleFavorite, onCardOpen, onRunHistory, onGoSearch }) {
  const saved = useMemo(
    () => favorites.map((id) => CATALOG.find((p) => p.id === id)).filter(Boolean),
    [favorites]
  );

  return (
    <main className="tn-main">
      <section className="tn-hero" style={{ padding: '64px 0 0' }}>
        <span className="tn-pill">
          <span className="dot" />
          Tu colección
        </span>
        <h1 className="tn-title">
          Tu <em>archivo.</em>
        </h1>
      </section>

      <section className="tn-split">
        <h2>
          Guardados
          <span className="count">{saved.length}</span>
        </h2>
        <div className="meta">
          <span>Tu lista personal · {CATALOG.length} fragancias en catálogo</span>
        </div>
      </section>

      {saved.length === 0 ? (
        <div className="tn-empty">
          <p>Aún no has guardado ningún perfume.</p>
          <button onClick={onGoSearch}>
            Hacer una búsqueda <SvgArrowRightThick size={14} />
          </button>
        </div>
      ) : (
        <section className="tn-grid">
          {saved.map((p) => (
            <PerfumeCard
              key={p.id}
              perfume={p}
              rank={0}
              score={null}
              isFavorite={true}
              onToggleFavorite={() => toggleFavorite(p.id)}
              onOpen={() => onCardOpen({ perfume: p, score: null, reasoning: null })}
            />
          ))}
        </section>
      )}

      <section className="tn-split">
        <h2>
          Historial
          <span className="count">{history.length}</span>
        </h2>
        <div className="meta">
          <span>Últimas 10 consultas · pulsa para repetir</span>
        </div>
      </section>

      {history.length === 0 ? (
        <div className="tn-empty">
          <p>Aún no has realizado ninguna búsqueda.</p>
          <button onClick={onGoSearch}>
            Hacer una búsqueda <SvgArrowRightThick size={14} />
          </button>
        </div>
      ) : (
        <ul className="tn-hist">
          {history.slice(0, 10).map((h, i) => (
            <li key={i}>
              <button onClick={() => onRunHistory(h)}>
                <Clock size={15} className="hi" />
                <span className="hq">{h.query}</span>
                <span className="hd">{formatDate(h.timestamp)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Footer />
    </main>
  );
}

/* ============================================================
   DETAIL MODAL
   ============================================================ */
function DetailModal({ perfume, score, reasoning, isFavorite, onToggleFavorite, onSimilar, onClose }) {
  const tint = getTint(perfume.familia);
  const initial = perfume.nombre.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || 'T';

  return (
    <div className="tn-modal-bg" onClick={onClose}>
      <div className="tn-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="tn-modal-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
        <div className="tn-modal-grid">
          <div className="tn-modal-frame" style={{
            background: `linear-gradient(160deg, ${tint.from} 0%, ${tint.to} 100%)`,
          }}>
            <Bottle accent={tint.accent} body={tint.soft} initial={initial} large />
            {score != null && (
              <div style={{ marginTop: 24, position: 'relative', zIndex: 2 }}>
                <span className="tn-badge top" style={{ position: 'static', boxShadow: '0 4px 12px rgba(10,15,31,0.08)' }}>
                  <span className="dot" /> {score}% match
                </span>
              </div>
            )}
          </div>

          <div className="tn-modal-info">
            <div>
              <span style={{
                display: 'inline-block',
                fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: tint.accent,
                marginBottom: 8,
              }}>
                {FAMILIA_LABELS[perfume.familia] || perfume.familia} · {TIER_LABELS[perfume.tier_precio]} · {cap(perfume.genero)}
              </span>
              <h2>{perfume.nombre}</h2>
              <div className="tn-modal-house">{perfume.casa} · {perfume.año}</div>
            </div>

            <p className="tn-modal-desc">{perfume.descripcion_corta}</p>

            <div className="tn-modal-meta">
              <div>
                <span className="label">Precio (100ml)</span>
                <span className="value">{perfume.precio_eur_100ml}&nbsp;€</span>
              </div>
              <div>
                <span className="label">Duración</span>
                <span className="value">{perfume.duracion_horas} h</span>
              </div>
              <div>
                <span className="label">Proyección</span>
                <span className="value">{cap(perfume.proyeccion)}</span>
              </div>
              <div>
                <span className="label">Estación</span>
                <span className="value">{perfume.temporada.map(cap).join(', ')}</span>
              </div>
            </div>

            <div>
              <div className="tn-flabel" style={{ marginBottom: 12 }}>Pirámide olfativa</div>
              <div className="tn-pyr-grid">
                <PyrCol label="Salida" notes={perfume.notas.salida} />
                <PyrCol label="Corazón" notes={perfume.notas.corazon} />
                <PyrCol label="Fondo" notes={perfume.notas.fondo} />
              </div>
            </div>

            {reasoning && (
              <div className="tn-reason">
                <div className="label">
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--blue-press)'
                  }} />
                  Por qué encaja
                </div>
                <p>{reasoning}</p>
              </div>
            )}

            <div className="tn-modal-actions">
              <button
                className={'tn-btn tn-btn-ghost' + (isFavorite ? ' on' : '')}
                onClick={onToggleFavorite}
              >
                <Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={1.6} />
                {isFavorite ? 'Guardado' : 'Guardar'}
              </button>
              <button className="tn-btn tn-btn-primary" onClick={onSimilar}>
                Ver similares <SvgArrowRightThick size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PyrCol({ label, notes }) {
  return (
    <div className="tn-pyr-col">
      <div className="tn-pyr-h">{label}</div>
      <ul style={{ padding: 0, margin: 0 }}>
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
   FOOTER
   ============================================================ */
function Footer() {
  return (
    <footer className="tn-footer">
      <div>
        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>topnote</span>
        <span className="dot" />
        consultoría olfativa asistida
      </div>
      <div>
        {CATALOG.length} fragancias · precios EU 2024–2025
      </div>
    </footer>
  );
}

/* ============================================================
   HELPERS — fecha + iconos secundarios
   ============================================================ */
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const date = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

/* ============================================================
   ICONOS LOCALES (los principales están en el wrapper HTML)
   ============================================================ */
const SvgFilter = ({ size = 18, stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M6 12h12M10 18h4" />
  </svg>
);

const SvgArrowRightThick = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);

const SvgArrowLeft = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

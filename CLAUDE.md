# WiseMotors — Contexto para Claude Code

> Handoff del 27-jul-2026. El plan estratégico completo está en `docs-plan-rediseno-2026.md`
> (léelo antes de decisiones de arquitectura). Este archivo es el estado operativo.

## Qué es esto

Marketplace de vehículos nuevos en Colombia (foco Medellín). Diferenciador: búsqueda en
lenguaje natural con IA para gente que NO sabe de carros. Modelo de negocio: leads a
WhatsApp (`WhatsAppLead`) para concesionarios. Stack: Next.js 14 App Router + TS +
Tailwind/Radix + Prisma 5 + PostgreSQL + Claude (Anthropic: Sonnet solo en la ingesta, Haiku en todo lo demás) + Cloudinary + Vercel.

**Contexto de mercado que debe permear todo:** en Colombia un Mercedes es lujo pleno y un
Corolla es casi gama alta. Los umbrales, comparaciones y puntajes se calibran contra lo
que SE VENDE EN COLOMBIA, nunca contra el catálogo mundial.

## Decisión de arquitectura en curso (giro 360)

Se está migrando de "vehículo = formulario de ~200 campos" (JSON string en
`Vehicle.specifications`) a "vehículo = conjunto de hechos con fuente y confianza":

- `AttributeDefinition` (153 filas seed) — registro de atributos: aplicabilidad por tren
  motriz (`appliesTo`), dirección (`higher/lower_better`), dimensión de cobertura, rangos
  físicos de validación, disponibilidad en CO. **Agregar un campo = insertar una fila.**
- `VehicleAttribute` — un hecho por fila: `valueNum/Text/Bool` + `confidence` +
  `sourceTier` (1 fabricante CO, 2 prensa, 3 comunidad) + `sourceUrl` + verificación humana.
  Índice `(attributeKey, valueNum)` → filtrar por spec en SQL.
- Cobertura por vehículo (`coverageGlobal`, `coverageByDimension`): distingue *faltante*
  de *no aplicable* (un EV sin cilindraje NO está incompleto). Regla de producto: ningún
  puntaje se muestra con cobertura de dimensión < 0.6 (`MIN_DIMENSION_COVERAGE`).
- `specifications` (JSON) queda como respaldo de solo lectura. NO borrarla aún.

Archivos clave nuevos:
- `lib/attributes/registry.ts` — el registro (keys = paths reales del JSON, ej. `combustion.maxTorque`)
- `lib/attributes/coverage.ts` — cálculo de cobertura
- `lib/comparison/cohorts.ts` — cohortes + percentiles winsorizados (ver abajo)
- `scripts/migrate-attributes.ts` — migración idempotente JSON→filas (dry-run por defecto, `--write` para aplicar)
- `scripts/seed-colombia.ts` — bandas de precio H2-2026 + percepción de 30 marcas CO

## Motor de comparación (el "problema del Bugatti")

Nunca comparar contra el catálogo completo. `lib/comparison/cohorts.ts`:
- Cohorte = (tipo carrocería × banda de precio vigente × fuelType), relajación progresiva
  si < 8 miembros (banda adyacente → trenes afines → segmentos afines → solo segmento).
  Cada relajación se registra y `descriptionEs` se muestra al usuario.
- Puntaje = percentil winsorizado p5/p95 dentro de la cohorte, invertido si
  `lower_better`. Muestra < 3 → no se puntúa. Probado: outlier de 1500HP mueve un p32 a p30.
- `PriceBand` con vigencia (`validTo: null` = activa). Recalibrar cada semestre con
  `seed-colombia.ts`, jamás editar en caliente ni hardcodear.
- `BrandPerception` (brand_perception_co): prestigio / confiabilidad / repuestos como ejes
  INDEPENDIENTES, curados a mano. Es criterio editorial, no fórmula.

## Estado (actualizado 28-jul-2026)

**Hecho el 27-jul:** bugs de búsqueda (`sanitizeWhereClause`, doors/seats 500,
case-sensitive, url trending, paginación), schema Prisma +4 modelos, registro,
cobertura, migración, seeds, motor de cohortes.

**Hecho el 28-jul:**
- **Fase 0 seguridad COMPLETA en código:** `lib/api-auth.ts` (`requireUser`/`requireAdmin`,
  rol releído de BD por petición) aplicado a leads (GET/PUT/DELETE + export), escrituras de
  vehicles/dealers/trending/upload. `/api/test/create-vehicle` eliminada. `JWT_SECRET` sin
  fallback (lanza si falta). Contraseña admin fuera del bundle (estaba en `useAdmin.ts` Y
  `AdminQuickAccess.tsx`); admin = `User.role`. `lib/admin-fetch.ts` inyecta el Bearer en
  las 14 llamadas del panel. `scripts/set-admin.js` otorga el rol. `.env.example` creado.
- **Scoring determinístico (backlog #2) HECHO:** `lib/ai/deterministic.ts` — router de
  perfiles es-CO (regex+diccionario, 10 perfiles) × percentiles winsorizados sobre el set
  de candidatos (importa la matemática pura de `cohorts.ts`, sin BD). `results.ts` ordena
  antes del rerank; el LLM recibe `det_score` real y la instrucción de respetarlo; el
  fallback usa el score real (murió el fake 90-85-80). Tests: `scripts/verify-scoring.ts`
  (11 checks, npx tsx). Cuando `VehicleAttribute` tenga datos, cambiar la fuente, no la fórmula.
- **Sistema de movimiento (parte del #6):** tokens `--motion-*` + `--wise-glow` en
  `globals.css`, glow reactivo al cursor (`.card-glow`, rAF, solo opacity), cascada
  `card-enter` con stagger 40ms (prop `index` en `VehicleCard`, pasada desde las 4 grillas),
  `AnimatedNumber` (viewport + ease-out, usado en precio de la ficha),
  `prefers-reduced-motion` global.

**28-jul tarde — BD NUEVA + INGESTA CON IA (backlog #5) FUNCIONANDO:**
- La BD anterior se perdió; hay Neon nuevo (`ep-morning-snow-axszv58y`, us-east-2) ya
  configurado en `.env`/`.env.local` con `JWT_SECRET` generado. Schema aplicado, 156
  definiciones + bandas + percepción sembradas. Falta replicar env vars en Vercel.
- Cuenta admin: adminwise@wisemotors.co con contraseña temporal (la tiene el equipo
  del 28-jul) — CAMBIARLA. El rol vive en User.role.
- **Pipeline de ingesta** (`lib/ingest/`): identidad canónica → fuentes por tier
  (prensa CO con búsqueda WordPress + Wikipedia + dominios de fabricante en
  `sources.ts`) → fetch educado (robots.txt, cache, UA de navegador porque los WAF
  bloquean UAs "Bot" con 403) → extracción function-calling CONTRA EL REGISTRO con
  cita textual obligatoria → reconciliación por tier con conflictos >10% marcados →
  validación física → precio de fuente o ESTIMADO con razonamiento (decisión de
  producto 28-jul: estimar se permite, marcado + aprobación humana; nunca supera 0.6
  de confianza). UI en `/admin/ingest` (`IngestStudio.tsx`): aceptar/rechazar/editar
  campo por campo, ver fuente/cita/alternativas, publicar.
- Publicación (`/api/admin/ingest/publish`): crea Vehicle + VehicleAttribute
  (verifiedBy = revisor) + specifications JSON compatible + cobertura calculada.
  Rechaza duplicados exactos con 409.
- **Probado E2E por la UI real:** Corolla Cross 2025 ingestado (25 hechos, 5
  conflictos detectados — mezcla de versiones híbrida/gasolina —, precio $133M de
  Autos de Primera) → publicado → la búsqueda "una SUV para la familia que no gaste
  mucho" lo devuelve #1 con razones. Scoring determinístico + rerank funcionando.
- **Ingesta v2 (sep-2026):** las fuentes ya no se adivinan. `lib/ingest/buscar-fuentes.ts`:
  Claude con `web_search` busca la página oficial CO + prensa CO; solo se aceptan URLs que
  salieron en los resultados. Cada fuente se descarga directo y, si falla / es PDF / no trae
  datos, se lee con `web_fetch` de Anthropic (Haiku). Las fichas técnicas PDF oficiales se
  extraen como documento. Toda cita de página HTML se verifica contra el texto (si no
  aparece, el dato muere). Probado: Onix RS 33 datos, CX-30 36, Dolphin 41, ~50 s.
  La ruta de ingesta tiene `maxDuration: 300`.
  **Ingesta POR ETAPAS (5-oct-2026)** — una sola petición de 300 s no alcanzaba (una ficha
  PDF completa tarda 2-3 min en extraerse). `lib/ingest/pipeline.ts` expone las etapas y el
  panel (`IngestStudio.tsx`) las encadena contra `/api/admin/ingest` con `etapa`, cada una
  en su propia petición de hasta 300 s y mostrando el avance: `preparar` (identidad +
  fuentes) → `fuente` / `documento` (UNA por petición, todas en paralelo) + `fotos` en
  paralelo → `faltantes` (2.ª búsqueda de datos CLAVE; corre siempre) → `fuente` con
  `soloKeys` → `cerrar` (reconciliación + precio → borrador). `runIngestPipeline` encadena
  lo mismo en un proceso (scripts). Extracción: `timeoutMs` 270 s y SIN reintento (con el
  tope por defecto de 120 s + 1 reintento las fichas largas se cortaban y empezaban de
  cero: de ahí los 221 s). Medir etapas: `INGESTA_TIEMPOS=1` (`lib/ingest/tiempos.ts`).
  Probado: Blazer de 0 → 82 datos, faltan 2 de 37 clave. NO volver a meter todo en una
  petición. Año: una fuente vieja solo se descarta si es de OTRA generación. Versión no
  pedida: la de entrada que supone la IA es una pista (puede ser de otro mercado).
- **Fotos en la ingesta (sep-2026):** `lib/ingest/fotos.ts` saca imágenes del HTML de las fuentes
  ya leídas (oficial primero); si hay < 4, Haiku busca una página de fotos (1 búsqueda). Haiku
  clasifica con visión (primero `queSeVe`, luego ángulo/estudio/calidad; si es el modelo lo decide
  el código con `queSeVe`). Probado: Haiku NO distingue izquierda/derecha → nunca voltea solo; el
  revisor usa "Voltear". Se recomiendan lado (portada), 3/4 delantero, 3/4 trasero e interior y se
  procesan en Cloudinary (`procesarFotoCarro`: quitar fondo + recortar, PNG transparente — se ve
  blanco en el catálogo y no deja rectángulo en el hero oscuro). Sin `CLOUDINARY_*` quedan con
  fondo original y se avisa. Revisión en `RevisionFotos.tsx`; publicar crea `VehicleImage`
  (portada = type 'cover' + isThumbnail) y borra de Cloudinary las descartadas.
- **Plan concesionarios:** su carpeta de fotos y fichas técnicas entra como fuente tier 1 por
  delante de la web (fotos → mismas candidatas de `buscarFotos`; fichas PDF → `extractFromPage`),
  y Haiku/Sonnet completan solo lo que falte.

**28/29-sep-2026:**
- **Registro recuperado:** el de julio solo recorrió los bloques tipados del schema viejo y
  perdió ~80 de los 140 campos acordados (`campos_seleccionados.md`). Bloque `recuperados`
  en `registry.ts` (249 atributos): tracción (`drivetrain.traction`), potencia/torque de EV
  (`electric.maxPower/maxTorque`, no existían), llantas, frenos, ISOFIX, techo, pantalla…
  Enums con `opciones`: la ingesta normaliza (`normalizarOpcion`: "4WD"→"4x4") o descarta.
  La cobertura cuenta solo `coAvailability: 'common'`.
- **Campos clave** (`lib/attributes/clave.ts`, 41, por tren motriz): los que alimentan ficha,
  tarjetas, comparador e índices. La ingesta hace una 2.ª búsqueda dirigida
  (`buscarFuentesPara` + extracción limitada a esas keys) si faltan; la revisión los
  muestra (`DatosClave.tsx`) con entrada manual y "no existe" (`specifications.meta.sinDato`);
  publicar sin ellos pide confirmación. "No lo tiene" confirmado por una persona = dato.
- **Documentos del concesionario:** PDF o foto de la ficha en el formulario de subida
  (multipart, ≤4 MB por el límite de Vercel). Se leen primero como tier 1 y ganan empates.
- **Fotos: seis vistas** (lateral=portada, frontal, trasera, 3/4 delantera, 3/4 trasera,
  interior). Las del concesionario se suben por vista y se procesan al elegirlas; la IA
  solo busca las vacías (`cubiertos`). Revisión por vistas con "Usar como…".
- **Concesionario** al publicar ('¿Quién lo vende?') → `VehicleDealer`.
- **Cola "Por revisar"** (`lib/auditoria.ts`): hechos sin revisor / confianza < 0.7 / tier 3,
  precios estimados y datos clave faltantes. `escribirHechos()` escribe hecho +
  specifications + cobertura en una transacción (lo usan completar y complementar).
- **Complementar con IA** (detalle del carro en el admin): se pega un texto (p. ej. una
  investigación hecha con otra IA) → `lib/ingest/complementar.ts` lo reparte con citas
  verificadas CONTRA EL TEXTO → propuesta nuevo/igual/distinto → el revisor aplica (tier 2, 0.85).
  El precio no entra por aquí.
- **Índices WiseMotors** (`lib/indices/`): Altura (por ciudad), Palmas, Hueco y Costo Real de
  Tenencia 5 años. Parámetros en `parametros_indices` con vigencia, sembrados en cada deploy
  desde `lib/indices/parametros.ts` (cambiar ahí el valor + fuente y desplegar). Un índice sin
  sus datos NO se muestra (nunca "nos falta" al comprador). Tests: `scripts/verify-indices.ts`.
- **Ficha:** sin sección de procedencia ni "Estimado" (decisión del usuario: verificar es
  trabajo del equipo, no del comprador). 3 similares (`lib/similares.ts`) con "Comparar con
  este" → `/compare?ids=a,b` (sin cuenta; el veredicto IA sí pide cuenta).
- **Carros DEMO:** `lib/db/vehiculos-demo.ts` los siembra UNA vez en el deploy (bandera
  `demo_cargado` en `estado_sistema`); `CARGAR_DEMO=no` los apaga.
- **Inicio:** solo los renders dibujados rotando, sin cifras (las fotos se pixelaban).

**3-oct-2026:**
- **Demanda (base de los informes para concesionarios y marcas):** cada búsqueda con IA se
  guarda en `busquedas` (`lib/demanda.ts` puro + `lib/demanda-servidor.ts`) con lo que la IA
  entendió y se agrupa por INTENCIÓN = necesidad (perfiles del router determinístico) ·
  carrocería · banda de presupuesto. Si la IA no saca carrocería/presupuesto, se leen del
  texto ("camioneta"→SUV salvo platón, "120 palos"). Sin nombre ni IP: sesión anónima con
  hash y ciudad aproximada de Vercel. Pestaña "Demanda" en el panel + CSV con SOLO
  agregados (nunca el texto libre: la gente escribe datos propios). Test: `verify-demanda.ts`.
- **Ficha:** sin "Ficha técnica completa". En su lugar, bloque para hablar con el
  concesionario. Botones verdes (`.pastilla--verde`, verde oscuro por contraste AA) =
  hablar con una persona: "Agendar prueba de manejo" (cabecera y abajo) y "Contactar al
  concesionario". Van directo al WhatsApp del concesionario si su teléfono es celular
  colombiano; si no, al de WiseMotors con el concesionario en el mensaje. El lead guarda
  `dealershipId` y `source` (`ficha_prueba` / `ficha_concesionario`).
- **Concesionarios con perfil tipo Google Maps:** `Dealer` tiene `mapsUrl`, `lat`, `lng`,
  `horario`. El admin pega el link de Google Maps y `/api/admin/ubicacion` lee las coordenadas
  (resuelve maps.app.goo.gl siguiendo redirecciones SOLO a dominios de Google:
  `lib/mapas-servidor.ts`). Mapa = Maps Embed API si hay `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY`,
  si no el embed clásico sin clave, SIN interacción (pointer-events: none). Regla de
  producto: nada saca a la persona de WiseMotors antes del lead (ni reseñas, ni llamar, ni
  fotos de Google); "Cómo llegar" solo aparece después de escribirle (perfil del concesionario).
  Distancia en línea recta calculada EN EL NAVEGADOR (`hooks/useMiUbicacion`, solo al tocar el
  botón; nunca llega al servidor). Páginas públicas `/concesionarios` y `/concesionarios/[id]`
  (sus carros + JSON-LD AutoDealer, en el sitemap). Test: `verify-mapas.ts`.
- **Contacto con varios concesionarios** (`components/concesionarios/Contacto.tsx`): si el carro
  lo vende uno (o ninguno), directo a WhatsApp; si son varios, `ListaContacto` (diálogo / hoja
  en el celular) ordenada por distancia con un botón verde por concesionario: puede escribirle
  a uno o a varios (un toque cada uno: el navegador bloquea abrir varios WhatsApp a la vez).
  `useContactar` abre WhatsApp DENTRO del toque (si no, el bloqueador de ventanas lo frena) y
  guarda el lead en paralelo, con concesionario y `source` (`ficha_*` / `perfil_*`).
- **Carros de un concesionario:** se eligen en su formulario (`FormConcesionario.tsx`:
  buscar, "Todos los Mazda") y se guardan en `VehicleDealer` (`lib/concesionarios.ts`
  `sincronizarCarros`). OJO: `Dealer.vehicles` ("DealerVehicles") es una relación VIEJA sin
  uso; conteos y borrado ya usan `vehicleDealers`.

**6-oct-2026 — Clases de vehículo (carro / pickup / van-camión):**
- Al subir se elige la clase (`IngestStudio`): limita las carrocerías que puede escoger la IA
  (`Van` y `Camión` son carrocerías nuevas; categoría nueva `Comercial`). La clase NO es una
  columna: sale de `Vehicle.type` con `claseDeTipo` (`lib/attributes/clase.ts`).
- Rangos físicos por clase: `RANGOS_POR_CLASE` en `registry.ts` (solo lo que cambia frente a
  un carro) + `rangoDe` / `fueraDeRango`. Los usan la reconciliación, la entrada a mano
  (`DatosClave`), la auditoría (`valorAuditado`) y Complementar. Nunca comparar contra
  `expectedMin/Max` directo.
- Campos nuevos: `weight.grossVehicleWeight` (PBV) y `cargoArea.length/width/height`.
- Datos clave por clase (`soloClases` / `noAplicaA` en `clave.ts`): pickup y van/camión piden
  carga útil, remolque, PBV y zona de carga; a van/camión no se le pide 0-100, NCAP, ISOFIX…
- Ficha: bloque "Para trabajar" en "Espacio y carga" para pickups y vans/camiones.
  Test: `scripts/verify-clase.ts`.

## Backlog en orden (del plan, secciones 8-9)

1. **Fase 0 — SEGURIDAD (pospuesta por decisión del usuario, pero es LEGALMENTE urgente):**
   `GET /api/whatsapp-leads` es PÚBLICO (datos personales, Ley 1581); contraseña admin
   hardcodeada en `hooks/useAdmin.ts` (literal en el bundle del cliente); 14 de 15 rutas
   API sin auth server-side (el patrón correcto ya existe en `/api/favorites`);
   `JWT_SECRET` con fallback inseguro; `/api/upload` y `/api/test/create-vehicle` abiertos.
2. Scoring determinístico: `lib/ai/scoring.ts` devuelve `det_score: 0` — el ranking
   depende 100% del LLM. Sustituir por Σ(percentil_cohorte × peso_perfil × confianza)
   usando `scoreVehicleInCohort`. El LLM pasa a ser explicador (top 30 → razones), no ranking.
3. UI de comparación: barras divergentes contra la MEDIANA de la cohorte
   (`cohortMedian` ya viene en `AttributeScore`), estado "no comparable" de primera clase
   (nunca un guion ni un cero), advertencia si se comparan gamas distintas.
4. Índices Colombia (plan §4): Índice Altura (derrateo ~1%/100m atmosféricos, turbos casi
   inmunes, EVs inmunes — Bogotá 2640m = -26%), Índice Palmas, Índice Hueco, Costo Real
   de Tenencia 5 años (parámetros SIEMPRE en tabla con vigencia, verificar normativa).
5. Ingesta con IA (plan §5): identidad canónica → fuentes por tier → extracción con
   function calling CONTRA EL REGISTRO (el LLM no inventa campos) → reconciliación
   multi-fuente → validación física (`expectedMin/Max`) → publicar + cola de auditoría.
   Regla dura: precio COP y versiones solo de tier 1; NUNCA estimar un precio.
6. Rediseño visual (plan §7): tarjetas de catálogo con aspect-ratio fijo que muestran los
   3 atributos más relevantes A LA BÚSQUEDA del usuario (`cardEligible` en el registro);
   ficha = bento de empaquetado adaptativo (módulo sin datos NO existe, no deja hueco);
   View Transitions catálogo↔ficha; solo animar transform/opacity; dark editorial con
   morado `#881cb7` como luz, no como relleno.

## Expectativa: sitio cerrado con lista de espera (desde 6-oct-2026)

- `middleware.ts` + `lib/acceso.ts`: mientras `SITIO_ABIERTO` no sea `1`, toda página
  muestra `app/espera` (rewrite, misma URL) y toda API responde 403, salvo
  `/api/espera*` y `/api/salud`. El equipo entra escribiendo el código en el campo del
  correo (`CODIGO_ACCESO`, por defecto `admin931`): deja la cookie `wm_acceso` (huella
  del código + `JWT_SECRET`, 90 días). Para lanzar: `SITIO_ABIERTO=1` en Vercel y redeploy.
- Las páginas del sitio viven en el grupo `app/(sitio)/` (menú y pie en su layout);
  `app/espera` queda fuera para mostrarse sola.
- Tabla `lista_espera` (nombre, correo, ciudad, autorización Ley 1581, código para
  invitar `?ref=`, `referidoPor`, `origen` = utm_source). Cada invitado adelanta 10
  puestos (`lib/lista-espera.ts`). CSV en el panel: botón "Lista de espera".
- Regla de la campaña: la página de espera no muestra ninguna función del producto.

## Convenciones y trampas del repo

- `AddVehicleForm.tsx` (63KB) y `EditVehicleForm.tsx` (77KB) son los formularios de 200
  campos: van a morir con la ingesta IA; no invertir esfuerzo en ellos.
- Tres taxonomías incoherentes conviven: `lib/constants.ts` (inglés), schema Zod
  (español: `Gasolina`, `Sedán`...), `lib/types.ts`. **La canónica es la del schema Zod /
  BD** — el registro nuevo (`FT` en `lib/attributes/registry.ts`) ya la usa. Unificar hacia ella.
- `getMarketStats()` en `lib/ai/features.ts` trae TODO el catálogo por búsqueda, sin
  caché — cuello de botella conocido.
- Tests (npx tsx, sin BD ni API): `scripts/verify-scoring.ts`, `verify-indices.ts`, `verify-clave.ts`, `verify-clase.ts`, `verify-demanda.ts`, `verify-mapas.ts`.
- Git: push directo a `main` (sin ramas ni PRs), decisión del usuario.
- Prueba local sin tocar producción: Postgres en Docker (`wise-pg`, puerto 55432) + la
  configuración `wisemotors-local-db` de `.claude/launch.json` (puerto 3007).
- Docs viejos engañosos: `BUSQUEDA_OBJETIVA_CAMPOS.md` describe código que ya no existe.
- Base de datos: Neon conectado por la integración de Vercel con prefijo `WISE`:
  `WISE_DATABASE_URL` (pooler, app) y `WISE_DATABASE_URL_UNPOOLED` (directa, schema).
  `lib/db/url.ts` las lee sin importar mayúsculas. En cada deploy de PRODUCCIÓN,
  `scripts/preparar-bd.ts` corre `prisma db push` (nunca con pérdida de datos: si
  la hay, el deploy falla) y siembra los datos base de `lib/db/semillas.ts` si
  faltan. En preview no toca la base. Local: `npm run db:preparar`.
- Variables de base: `lib/db/url.ts` las busca por el FINAL del nombre (…DATABASE_URL,
  …POSTGRES_PRISMA_URL…), sirva el prefijo que sea. Diagnóstico sin secretos: `GET /api/salud`.
- Admin inicial: con `ADMIN_EMAIL` + `ADMIN_PASSWORD` (≥10) en Vercel, el deploy (o el primer
  login con exactamente esas credenciales) crea esa cuenta como admin. Si ya existía, SOLO el
  login con esas credenciales exactas la reclama (rol admin + esa contraseña). Nunca asciende cuentas existentes ni cambia contraseñas
  (el registro no verifica correos). Otros admins: `scripts/set-admin.js`.
- Deploy Vercel `iad1`, funciones `maxDuration: 30s`. Env vars: `WISE_DATABASE_URL`(+`_UNPOOLED`),
  `JWT_SECRET`, `ANTHROPIC_API_KEY` (+ `ANTHROPIC_WORKSPACE_ID` si la clave no es
  de un workspace), `CLOUDINARY_*`, `NEXT_PUBLIC_APP_URL`.
- **Modelos (decisión del equipo, costo): NUNCA Opus.** Sonnet (`claude-sonnet-5`) SOLO en la ingesta
  (extracción, búsqueda de fuentes, identidad, precio). Todo el resto del producto en Haiku
  (`claude-haiku-4-5`): veredicto del comparador, leer páginas con web_fetch, datos DEMO.
  Toda la IA es Anthropic; OpenAI se eliminó del proyecto (sep-2026). Todo pasa por
  `MODELOS` en `lib/ai/claude.ts`. Ingesta: máx 4 fuentes, 25k caracteres por página, 3 búsquedas.
  No correr pruebas que gasten la clave de producción sin permiso del equipo.
- LLM: la ingesta (`lib/ingest/`) usa Claude vía `lib/ai/claude.ts` (`pedirJson` +
  esquema Zod, salida estructurada). La búsqueda también, en Haiku: `categorization.ts`
  clasifica (filtros vs. intención, cacheado 1 h). OBJETIVA ("con turbo") → TODOS los que
  cumplen, del más barato al más caro, sin podio ni rerank. SUBJETIVA/HÍBRIDA → `rerank.ts`
  ordena y explica los 30 mejores del orden determinístico y escoge el orden de las preguntas
  para afinar. Equipamiento se filtra contra el dato real (`lib/ai/filtros.ts`), nunca con
  `contains` sobre el JSON. "Camioneta" = SUV salvo que hable de platón/carga (regla en código).
  Afinar (`components/home/Afinador.tsx`): presupuesto / motor / tipo / caja / prioridad, una a
  la vez, solo si divide la lista, hasta que queden ≤3; filtra en el cliente, sin volver a la IA.
  Tracción, techo, cuero, ISOFIX, repuesto… se filtran contra el dato del registro; el
  afinador pregunta "¿tracción en las 4 ruedas?" si divide la lista.
  Sin clave o si Claude falla, el orden determinístico es el resultado.
  `features.ts` lee DATOS REALES en sus unidades (km/gal, mm, hp); faltante = NaN = mediana
  (nunca rellenar con valores inventados). La IA recibe cifras reales (`createCompactPayload`),
  no índices internos; `rerank.ts` descarta razones con jerga interna. Marca que no tenemos →
  `aviso` arriba de los resultados.
- Stakeholder que da feedback: Olarte. Público objetivo: compradores NO expertos —
  el copy nunca asume conocimiento técnico.

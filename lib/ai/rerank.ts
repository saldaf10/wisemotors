// Rerank final con Claude (Haiku): afina y explica el orden determinístico.
import { z } from 'zod/v4';
import { pedirJson } from './claude';
import { datosClave, millones } from '@/lib/vehiculo-datos';
import { DIMENSIONES, type Dimension } from './filtros';
import type { ScoredCandidate } from './scoring';
import type { VehicleFeatures } from './features';
import { createCompactPayload } from './scoring';

export interface FinalRecommendation {
  rank: number;
  match: number;
  reasons: string[];
  vehicle: {
    id: string;
    brand: string;
    model: string;
    year: number;
    price: number;
    fuelType: string;
    type: string;
    imageUrl: string | null;
    familia?: string | null;
    /** Aptitudes normalizadas (0-1) ya calculadas: la ficha del podio las dibuja. */
    features: VehicleFeatures;
  };
}

// Esquema del rerank: Claude devuelve un JSON validado, nunca texto suelto.
const RerankSchema = z.object({
  recommendations: z.array(
    z.object({
      id: z.string().describe('id del vehículo, EXACTAMENTE uno de la lista'),
      match: z.number().describe('Compatibilidad de 0 a 100 con lo que pidió'),
      reasons: z.array(z.string()).describe('2 o 3 razones cortas, con cifra o dato real cuando lo haya'),
    })
  ),
  preguntas: z
    .array(z.enum(DIMENSIONES as [Dimension, ...Dimension[]]))
    .describe('Orden en que conviene preguntarle al comprador para afinar, de la más útil a la menos. Omite lo que ya dijo.'),
});

export interface ResultadoRerank {
  recs: FinalRecommendation[];
  /** Orden de las preguntas para afinar; null si la IA no respondió. */
  preguntas: Dimension[] | null;
}

/** Cuántos candidatos (ya ordenados por el scoring determinístico) ve la IA. */
const MAX_CANDIDATOS_IA = 30;

export async function rerankWithLLM(
  candidates: ScoredCandidate[],
  subjectiveContext: string,
  originalPrompt: string
): Promise<ResultadoRerank> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Sin clave: el orden determinístico ES el resultado, para no romper la búsqueda.
    return { recs: createFallbackRecommendations(candidates), preguntas: null };
  }

  // Payload compacto: solo los mejores del orden base, JSON sin espacios.
  const compactCandidates = createCompactPayload(candidates.slice(0, MAX_CANDIDATOS_IA));

  const systemPrompt = `Eres el asesor de WiseMotors, un marketplace de carros nuevos en Colombia (Medellín). Ordenas los candidatos para lo que pidió el comprador y explicas por qué, en palabras de persona: tuteas (tú, nunca vos ni usted), frases cortas, cero jerga. El comprador NO sabe de carros.

REGLAS DURAS:
1. SOLO carros de la lista, con su id exacto. Devuelve los 10 más recomendables (o todos si hay menos), del mejor al peor.
2. Cada razón se apoya en un dato que ESTÁ en "datos", "precio", "tipo", "combustible" o "etiquetas" del carro, y cita la cifra ("rinde 45 km/gal", "baúl de 478 L", "$95 M"). Si un dato no está, NO lo afirmes: nada de "gasta poco", "es seguro" o "es cómodo" sin la cifra que lo muestre.
3. Nunca menciones "orden_base", puntajes, índices ni decimales internos. No afirmes nada del mundo que no esté en los datos (estaciones de carga, repuestos, reventa, fama de la marca).
   No hagas cuentas de veces ("el doble", "triple"): di las dos cifras ("$215 M frente a $95 M").
4. Respeta el "tipo" tal cual (un Hatchback no es un sedán ni una SUV). Si el comprador pidió un tipo y el carro no lo es, dilo con honestidad en la razón.
5. "orden_base" (0-100) es un orden calculado con los datos reales; la lista ya viene ordenada por él. Úsalo como punto de partida y mueve un carro solo si lo que pidió el comprador lo justifica claramente.
6. "match" (0-100) = qué tan bien encaja con LO QUE PIDIÓ. Si no cumple algo que pidió explícitamente, que baje de 60.
7. Razones distintas para cada carro, 2 o 3, de máximo 14 palabras cada una. Contexto local cuando aplique, cada cosa con su dato: lomas y Las Palmas → potencia, torque o 0 a 100; huecos y reductores → altura al piso; trancón y parqueo → largo; finca → altura y platón.
8. Eléctrico: no gasta gasolina; su dato es la autonomía en km, no km/gal. No compares km/gal con autonomía.
9. Versiones: los carros con el mismo "version_de" son versiones del MISMO carro (cambian equipo, motor o precio). Pon arriba la versión que mejor encaje con lo que pidió (presupuesto, equipo, motor) y las otras versiones de ese carro más abajo, nunca seguidas. En las razones de la versión elegida puedes decir por qué esa y no la otra, con el dato ("trae cámara de reversa y la GL no", "$8 M menos que la GS").

PREGUNTAS PARA AFINAR: el comprador verá preguntas de un toque para reducir la lista. Ordena de la más útil a la menos las que tengan sentido para ESTA búsqueda: "presupuesto" (rango de precio), "combustible" (gasolina, híbrido, eléctrico), "carroceria" (SUV, sedán, hatchback…), "caja" (automática o manual), "traccion" (si necesita tracción en las 4 ruedas: solo útil si habla de finca, trocha, lodo, montaña o destapado), "prioridad" (qué le importa más: comodidad, economía, seguridad, espacio o desempeño). Omite lo que ya dijo (si pidió "eléctrico", no preguntes combustible; si dio una cifra de precio, no preguntes presupuesto; \"barato\" o \"económico\" sin cifra NO es presupuesto: pregúntalo).`;

  const userPrompt = `Búsqueda del comprador: "${originalPrompt}"
Lo que más le importa: "${subjectiveContext}"

Candidatos:
${JSON.stringify(compactCandidates)}`;

  try {
    const result = await pedirJson({
      schema: RerankSchema,
      modelo: 'haiku',
      maxTokens: 2500,
      system: systemPrompt,
      prompt: userPrompt,
    });
    const recs = processLLMRerank(result.recommendations, candidates);
    return { recs: ensureMinimum(recs, candidates, 10), preguntas: Array.from(new Set(result.preguntas)) };
  } catch (error) {
    console.error('Error en el rerank con Claude:', error);
    // Fallback al scoring determinístico
    return { recs: ensureMinimum(createFallbackRecommendations(candidates), candidates, 10), preguntas: null };
  }
}

// Red de seguridad: una razón que filtra jerga interna no se le muestra al comprador.
const JERGA_INTERNA = /(\b0\.\d+|\b1\.0\b|orden[_ ]base|det_score|score|_norm|potholes|hill_climb|percentil|\burban\b)/i;
function razonPresentable(r: unknown): r is string {
  return typeof r === 'string' && r.trim().length > 0 && !JERGA_INTERNA.test(r);
}

// Procesar respuesta del LLM y crear recomendaciones finales
function processLLMRerank(
  llmRecommendations: any[],
  candidates: ScoredCandidate[]
): FinalRecommendation[] {
  const candidateMap = new Map(candidates.map(c => [c.id, c]));
  const recommendations: FinalRecommendation[] = [];

  // Procesar todas las recomendaciones que lleguen (hasta el límite de la función)
  const limit = Math.min(12, llmRecommendations.length);

  for (let i = 0; i < limit; i++) {
    const llmRec = llmRecommendations[i];
    const candidate = candidateMap.get(llmRec.id);

    if (!candidate) {
      console.warn(`Vehículo no encontrado: ${llmRec.id}`);
      continue;
    }
    if (recommendations.some(r => r.vehicle.id === candidate.id)) continue; // repetido

    // Ensure match is strictly a number
    const matchVal = typeof llmRec.match === 'number' ? llmRec.match : parseInt(llmRec.match) || 0;

    recommendations.push({
      rank: i + 1,
      match: Math.max(0, Math.min(100, Math.round(matchVal))),
      reasons: Array.isArray(llmRec.reasons) ? llmRec.reasons.filter(razonPresentable).slice(0, 3) : [],
      vehicle: {
        id: candidate.id,
        brand: candidate.brand,
        model: candidate.model,
        year: candidate.year,
        price: candidate.price,
        fuelType: candidate.fuelType,
        type: candidate.type,
        imageUrl: candidate.imageUrl,
        familia: candidate.familia,
        features: candidate.features
      }
    });
  }

  return recommendations;
}

// Asegurar que siempre haya N recomendaciones, completando desde mejores candidatos restantes
function ensureMinimum(recs: FinalRecommendation[], candidates: ScoredCandidate[], minCount: number): FinalRecommendation[] {
  const have = new Set(recs.map(r => r.vehicle.id));
  const missing = Math.max(0, minCount - recs.length);

  // Si ya tenemos suficientes, devolvemos las que hay (hasta el max buffer)
  if (missing === 0) return recs;

  const extras: FinalRecommendation[] = [];
  for (const c of candidates) {
    if (extras.length >= missing) break;
    if (have.has(c.id)) continue;

    // Usar el score determinístico real del candidato, no un número inventado
    const fallbackMatch = Math.max(1, Math.min(100, Math.round(c.score)));

    extras.push({
      rank: recs.length + extras.length + 1,
      match: Math.round(fallbackMatch), // Asignar un % aunque sea bajo
      reasons: generateFallbackReasons(c),
      vehicle: {
        id: c.id,
        brand: c.brand,
        model: c.model,
        year: c.year,
        price: c.price,
        fuelType: c.fuelType,
        type: c.type,
        imageUrl: c.imageUrl,
        familia: c.familia,
        features: c.features,
      }
    });
  }

  return [...recs, ...extras].map((r, i) => ({ ...r, rank: i + 1 }));
}

// Fallback usando solo scoring determinístico
function createFallbackRecommendations(candidates: ScoredCandidate[]): FinalRecommendation[] {
  // Los candidatos llegan ordenados por el scoring determinístico real
  // (percentiles winsorizados × pesos del perfil). Si el LLM no está, este
  // orden ES el resultado: correcto aunque sin prosa — degradación real,
  // no la ficción anterior del 90-85-80 inventado.
  return candidates.slice(0, 10).map((candidate, index) => ({
    rank: index + 1,
    match: Math.max(1, Math.min(100, Math.round(candidate.score))),
    reasons: generateFallbackReasons(candidate),
    vehicle: {
      id: candidate.id,
      brand: candidate.brand,
      model: candidate.model,
      year: candidate.year,
      price: candidate.price,
      fuelType: candidate.fuelType,
      type: candidate.type,
      imageUrl: candidate.imageUrl,
      familia: candidate.familia,
      features: candidate.features
    }
  }));
}

// Razones sin IA: las cifras reales más relevantes del carro, sin adjetivos inventados.
function generateFallbackReasons(candidate: ScoredCandidate): string[] {
  const datos = datosClave(candidate).map(d => `${d.etiqueta}: ${d.valor}${d.unidad ? ` ${d.unidad}` : ''}`);
  return [`${candidate.type} ${candidate.fuelType.toLowerCase()} de ${millones(candidate.price)}`, ...datos].slice(0, 3);
}

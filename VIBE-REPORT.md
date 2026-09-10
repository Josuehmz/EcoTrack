# Vibe Report — EcoTrack

2026-09-10 · **Agente:** Claude Opus 5 (el enunciado sugería Claude 3.5 Sonnet
o GPT-4o; ambos quedaron dos generaciones atrás).

## Cómo configuré las reglas del agente

El `.cursorrules` no describe mi estilo: describe **los errores que este
dominio castiga**. Cuatro bloques. *Stack fijo* (Next.js, TypeScript estricto,
Zod, Jest, pnpm), para que no proponga dependencias que mantendría yo. *Reglas
de código*: dominio en `lib/`, ninguna fórmula en un componente, sin guardas
inalcanzables. *Reglas del dominio*, las que cambiaron el resultado: no inventar
factores de emisión, el vehículo eléctrico no emite cero, lo que no se entienda
se devuelve al usuario, y **la IA extrae, el código calcula**. Y *reglas de
trato*: plan antes de código, diffs, "si mi instrucción produce un mal diseño,
dímelo".

La tercera sostiene el prototipo: si el LLM devuelve el total de CO₂e, obtengo
un número que no puedo auditar y que cambia entre llamadas. Aquí traduce "me
eché un tinto y cogí el TransMilenio" a actividades de un catálogo, y la
multiplicación la hace código versionado.

## Dificultades al delegar

**El entorno no negocia.** pnpm 11 bloqueó el script de build de esbuild y la
suite no arrancaba; hubo que cambiar de Vitest a Jest. Ninguna cantidad de
"vibe" resuelve eso: hay que leer el error.

**El código que se ve bien y no lo está.** Dos defectos que ninguna lectura
habría visto y sí encontraron las pruebas. La coma decimal: "1,5 km en moto" se
partía al fragmentar por comas y el viaje pasaba a 5 km, en silencio. Y "carne
de cerdo" contaba dos veces —como cerdo y como res— inflando el plato.

**Diagnostiqué un defecto que no existía.** Al probar el endpoint con `curl`
los acentos llegaban corruptos, y concluí que la normalización fallaba en
producción; alcancé a "arreglarla". No era el código: **Git Bash enviaba el
cuerpo en cp1252** y Next lo leía como UTF-8. Con el JSON en UTF-8 real
funcionaba desde el principio. Esa es la dificultad de fondo: al delegar uno
pierde el modelo mental de la cadena, y ya no sabe si el error está en el
código, en la herramienta o en cómo lo mide.

**La documentación del modelo también envejece.** Escribió `messages.parse` con
un helper de Zod que el SDK instalado no tenía; hubo que subir el SDK de 0.70 a
0.124 y Zod de 3 a 4.

## De escribir código a orquestar

Se siente como pasar de operario a editor, con una trampa: **la fluidez se
confunde con corrección**. El agente produce en minutos algo que se ve
terminado, y el trabajo real empieza ahí: decidir qué no delegar, dónde poner la
vara, qué prueba impide que el error vuelva. Escribí pocas líneas y tomé más
decisiones que nunca — unidades, qué se asume, qué se advierte. Lo que no se
delega es el criterio; sin él, el vibe coding produce prototipos que responden
200 y mienten con seguridad.

*(37 pruebas verdes, build limpio.)*

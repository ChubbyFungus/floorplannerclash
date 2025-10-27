/* eslint-env node */
import { performance } from 'node:perf_hooks'
import * as THREE from 'three'
import { PlacementV2 as PlacementEngine } from '../src/components/editor/Blueprint3D/placement-v2.js'

// Dev-only benchmark for the PlacementEngine.
// Creates 100 mixed items and measures total placement time.

function runBenchmark() {
  const scene = new THREE.Scene()
  const engine = new PlacementEngine(scene)

  // A small set of example item intents with varying sizes/orientation
  const intents = [
    { widthIn: 24, depthIn: 24 },
    { widthIn: 30, depthIn: 24, yawRad: Math.PI / 2 },
    { widthIn: 36, depthIn: 30, softClearLRFB: { F: 6 } },
    { widthIn: 18, depthIn: 24, yawRad: Math.PI / 4 },
  ]

  const start = performance.now()
  for (let i = 0; i < 100; i++) {
    const intent = intents[i % intents.length]
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        intent.widthIn * 0.5 * 0.0254,
        0.5,
        intent.depthIn * 0.5 * 0.0254
      ),
      new THREE.MeshBasicMaterial()
    )
    scene.add(mesh)
    const id = engine.register(mesh, intent)
    const pos = new THREE.Vector2(
      (i % 10) * engine.gridM,
      Math.floor(i / 10) * engine.gridM
    )
    engine.commit(id, pos)
  }
  const total = performance.now() - start
  console.log(
    `[placement-bench] placed 100 items in ${total.toFixed(2)} ms`
  )
  if (total > 75) {
    console.warn(
      '[placement-bench] Regression warning: placement benchmark exceeds 75ms'
    )
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmark()
}

export { runBenchmark }

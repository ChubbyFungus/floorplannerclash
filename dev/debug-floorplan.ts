import { buildFloorplanFromState } from '@/services/floorplanBuilder';
import { parseUtterance } from '@/nlp/parse';
import { frameManager, Frame as StateFrame } from '@/src/state/frame';
import { RoomState } from '@/types';

const promptArgIndex = process.argv.findIndex(arg => arg === '--prompt');
const prompt =
  promptArgIndex !== -1 && process.argv[promptArgIndex + 1]
    ? process.argv[promptArgIndex + 1]
    : `14x18 L shaped kitchen with high end materials and appliances. Large center Island black white and grey color scheme rangetop on island with vent overhead`;

async function run() {
  // Initialize a default RoomState
  const defaultRoomState: RoomState = {
    id: 'debug-room',
    version: '1.0',
    styleTemplateId: 'default',
    params: {},
    room: {
      widthIn: 12 * 12, // Default to 12 feet
      depthIn: 10 * 12, // Default to 10 feet
      heightIn: 9 * 12, // Default to 9 feet
      wallThicknessIn: 6,
      openings: [],
    },
    items: [],
    seed: 'debug',
  };

  // Use parseUtterance to extract information from the prompt
  const parseResult = parseUtterance(prompt);
  const framePatch = parseResult.framePatch;

  // Apply the framePatch to a temporary FrameManager to get a Frame
  frameManager.reset();
  frameManager.apply(framePatch);
  const frameFromPrompt = frameManager.getFrame();

  // Merge the frame information into the default RoomState
  const roomState: RoomState = {
    ...defaultRoomState,
    params: {
      ...defaultRoomState.params,
      roomType: frameFromPrompt.roomType,
      style: frameFromPrompt.style,
      layout: frameFromPrompt.layout,
      floorMaterial: frameFromPrompt.floorMaterial,
      appliances: frameFromPrompt.appliances,
      cabinets: frameFromPrompt.cabinets,
      countertops: frameFromPrompt.countertops,
    },
    room: {
      ...defaultRoomState.room,
      widthIn: frameFromPrompt.dimensions?.width ? frameFromPrompt.dimensions.width * 12 : defaultRoomState.room.widthIn,
      depthIn: frameFromPrompt.dimensions?.depth ? frameFromPrompt.dimensions.depth * 12 : defaultRoomState.room.depthIn,
    },
  };

  const floorplan = await buildFloorplanFromState(roomState);
  console.log('Room:', floorplan.room);
  console.table(
    floorplan.objects.map(obj => ({
      id: obj.id,
      type: obj.type,
      x: obj.position.x.toFixed(2),
      y: obj.position.y.toFixed(2),
      z: obj.position.z.toFixed(2),
      rotY: obj.rotation.y.toFixed(2),
      width: obj.dimensions.width,
      depth: obj.dimensions.depth,
      height: obj.dimensions.height,
    }))
  );
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});


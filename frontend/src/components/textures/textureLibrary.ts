import { TextureOption, SurfaceType } from "../../types";

// --- Floor Textures ---
const woodLight: TextureOption = {
  id: 'wood_light',
  name: 'Light Wood',
  src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 transparent pixel
};
const floorTile: TextureOption = {
  id: 'floor_tile',
  name: 'Floor Tile',
  src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 transparent pixel
}

// --- Countertop Textures ---
const marbleWhite: TextureOption = {
  id: 'marble_white',
  name: 'White Marble',
  src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 transparent pixel
};
const graniteBlack: TextureOption = {
  id: 'granite_black',
  name: 'Black Granite',
  src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 transparent pixel
}

// --- Backsplash Textures ---
const subwayTile: TextureOption = {
  id: 'subway_tile',
  name: 'Subway Tile',
  src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 transparent pixel
};

export const textureLibrary: { [key in SurfaceType]: TextureOption[] } = {
    floor: [woodLight, floorTile],
    countertop: [marbleWhite, graniteBlack],
    backsplash: [subwayTile],
}
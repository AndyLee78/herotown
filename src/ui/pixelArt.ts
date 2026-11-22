import type { ClassId, Gender, Hero } from '../core'

export const SPRITE_SIZE = 32
export const VIEW_WIDTH = 480
export const VIEW_HEIGHT = 300

export type Rgb = readonly [number, number, number]

type Plot = {
  px: (x: number, y: number, color: Rgb, alpha?: number) => void
  fill: (x: number, y: number, width: number, height: number, color: Rgb) => void
}

const skinTones: readonly (readonly [Rgb, Rgb])[] = [
  [[255, 224, 196], [232, 190, 158]],
  [[244, 198, 160], [214, 164, 126]],
  [[196, 136, 96], [162, 104, 70]],
  [[132, 86, 58], [104, 64, 42]],
]

const hairTones: readonly (readonly [Rgb, Rgb])[] = [
  [[46, 34, 28], [28, 20, 16]],
  [[92, 58, 36], [68, 40, 24]],
  [[150, 86, 42], [116, 60, 28]],
  [[214, 176, 92], [176, 138, 64]],
  [[168, 64, 48], [128, 42, 36]],
  [[176, 176, 184], [132, 132, 142]],
]

const clothByClass: Record<ClassId, { cloth: Rgb; shade: Rgb; trim: Rgb }> = {
  warrior: { cloth: [70, 96, 132], shade: [48, 68, 98], trim: [186, 154, 92] },
  rogue: { cloth: [52, 86, 64], shade: [32, 58, 42], trim: [40, 40, 44] },
  archer: { cloth: [92, 122, 72], shade: [64, 86, 48], trim: [150, 112, 64] },
  mage: { cloth: [92, 62, 138], shade: [64, 40, 104], trim: [214, 176, 92] },
  cleric: { cloth: [226, 220, 206], shade: [186, 176, 158], trim: [196, 154, 64] },
  bard: { cloth: [150, 86, 120], shade: [110, 58, 86], trim: [214, 176, 92] },
  dancer: { cloth: [176, 72, 96], shade: [132, 48, 70], trim: [236, 196, 140] },
}

export function paintCharacter(hero: Pick<Hero, 'id' | 'classId' | 'gender'>, frame: 0 | 1): Uint8ClampedArray<ArrayBuffer> {
  const buffer = new Uint8ClampedArray(SPRITE_SIZE * SPRITE_SIZE * 4)
  const plot = plotFor(buffer, SPRITE_SIZE)
  const roll = hashString(hero.id)
  const [skin, skinShade] = skinTones[roll % skinTones.length]
  const [hair, hairShade] = hairTones[Math.floor(roll / 7) % hairTones.length]
  drawCharacter(plot, hero.classId, hero.gender, frame, { skin, skinShade, hair, hairShade })
  return buffer
}

export function paintVillage(): Uint8ClampedArray<ArrayBuffer> {
  const buffer = new Uint8ClampedArray(VIEW_WIDTH * VIEW_HEIGHT * 4)
  const plot = plotFor(buffer, VIEW_WIDTH)
  drawVillage(plot)
  return buffer
}

type Look = { skin: Rgb; skinShade: Rgb; hair: Rgb; hairShade: Rgb }

function drawCharacter(plot: Plot, classId: ClassId, gender: Gender, frame: 0 | 1, look: Look) {
  const { cloth, shade, trim } = clothByClass[classId]
  const boot: Rgb = [54, 40, 32]
  const step = frame === 0 ? 0 : 1

  plot.fill(10, 28, 12, 3, [20, 28, 16])

  plot.fill(12, 22 + step, 3, 6, look.skinShade)
  plot.fill(17, 22 + (1 - step), 3, 6, look.skinShade)
  plot.fill(12, 27 + step, 3, 2, boot)
  plot.fill(17, 27 + (1 - step), 3, 2, boot)

  plot.fill(8, 18, 3, 6, cloth)
  plot.fill(21, 18, 3, 6, cloth)
  plot.px(8, 23, look.skin)
  plot.px(9, 23, look.skin)
  plot.px(22, 23, look.skin)
  plot.px(23, 23, look.skin)

  plot.fill(11, 16, 10, 9, cloth)
  plot.fill(18, 16, 3, 9, shade)
  plot.fill(14, 16, 4, 2, trim)

  if (classId === 'warrior') {
    plot.fill(7, 16, 4, 3, [150, 156, 164])
    plot.fill(21, 16, 4, 3, [120, 126, 136])
    plot.fill(25, 12, 2, 12, [198, 204, 210])
    plot.fill(24, 23, 4, 2, [92, 64, 40])
    plot.px(25, 11, [230, 230, 236])
  } else if (classId === 'rogue') {
    plot.fill(24, 18, 2, 6, [176, 180, 186])
    plot.fill(23, 23, 3, 2, [72, 52, 36])
  } else if (classId === 'archer') {
    plot.fill(24, 14, 6, 2, [120, 78, 42])
    plot.fill(28, 12, 2, 6, [198, 204, 210])
  } else if (classId === 'mage') {
    plot.fill(25, 8, 2, 16, [92, 64, 40])
    plot.fill(24, 6, 4, 3, [126, 214, 196])
    plot.px(25, 5, [210, 255, 244])
  } else if (classId === 'bard') {
    plot.fill(24, 16, 5, 6, [92, 58, 36])
    plot.fill(24, 15, 5, 2, [214, 176, 92])
  } else if (classId === 'dancer') {
    plot.fill(7, 20, 4, 2, trim)
    plot.fill(22, 20, 4, 2, trim)
  } else {
    plot.fill(24, 14, 4, 5, [196, 154, 64])
    plot.fill(25, 16, 2, 2, [255, 236, 180])
  }

  plot.fill(14, 14, 4, 2, look.skinShade)
  oval(plot, 16, 11, 6, 6, look.skin)
  plot.fill(19, 8, 2, 6, look.skinShade)

  plot.px(13, 11, [248, 248, 252])
  plot.px(14, 11, [248, 248, 252])
  plot.px(18, 11, [248, 248, 252])
  plot.px(19, 11, [248, 248, 252])
  plot.px(14, 11, [36, 28, 24])
  plot.px(18, 11, [36, 28, 24])

  if (classId === 'rogue') {
    oval(plot, 16, 9, 7, 5, cloth)
    plot.fill(9, 10, 3, 4, shade)
    plot.fill(20, 10, 3, 4, shade)
    plot.px(13, 11, [248, 248, 252])
    plot.px(18, 11, [248, 248, 252])
    plot.px(14, 11, [36, 28, 24])
    plot.px(19, 11, [36, 28, 24])
  } else if (gender === 'female') {
    plot.fill(10, 6, 12, 4, look.hair)
    plot.fill(9, 9, 3, 8, look.hair)
    plot.fill(20, 9, 3, 8, look.hairShade)
    plot.fill(11, 4, 10, 3, look.hairShade)
  } else {
    plot.fill(11, 5, 10, 5, look.hair)
    plot.fill(10, 8, 2, 3, look.hairShade)
    plot.fill(20, 8, 2, 3, look.hair)
  }

  if (classId === 'mage') {
    for (let row = 0; row < 6; row += 1) {
      plot.fill(16 - row, 1 + row, row * 2 + 1, 1, cloth)
    }
    plot.fill(13, 6, 7, 2, trim)
  } else if (classId === 'cleric') {
    plot.fill(12, 5, 8, 1, trim)
    plot.px(16, 4, trim)
  }
}

function drawVillage(plot: Plot) {
  const grass: Rgb = [58, 112, 50]
  const grassShade: Rgb = [48, 96, 42]
  const dirt: Rgb = [138, 98, 62]
  const dirtShade: Rgb = [112, 76, 46]

  for (let y = 0; y < VIEW_HEIGHT; y += 1) {
    for (let x = 0; x < VIEW_WIDTH; x += 1) {
      const fleck = ((x * 13) ^ (y * 29)) % 17 === 0
      plot.px(x, y, fleck ? grassShade : grass)
    }
  }

  plot.fill(28, 150, 424, 26, dirt)
  plot.fill(28, 150, 424, 3, dirtShade)
  plot.fill(214, 150, 28, 130, dirt)
  plot.fill(214, 150, 4, 130, dirtShade)

  for (let i = 0; i < 8; i += 1) {
    flower(plot, 40 + i * 52, 142)
    flower(plot, 56 + i * 48, 182)
  }

  tree(plot, 18, 210)
  tree(plot, 430, 214)
  tree(plot, 250, 36)
  tree(plot, 150, 48)

  building(plot, 36, 36, 120, 78, {
    wall: [142, 138, 128],
    mortar: [116, 112, 104],
    roof: [112, 58, 68],
    roofShade: [78, 38, 48],
    door: [78, 52, 36],
  })
  plot.fill(88, 58, 16, 10, [176, 48, 52])
  plot.fill(94, 52, 4, 16, [176, 48, 52])

  building(plot, 324, 36, 120, 78, {
    wall: [164, 122, 78],
    mortar: [128, 90, 54],
    roof: [164, 64, 48],
    roofShade: [120, 42, 36],
    door: [92, 58, 36],
  })
  plot.fill(352, 78, 10, 8, [246, 214, 140])
  plot.fill(406, 78, 10, 8, [246, 214, 140])
  plot.fill(376, 62, 14, 8, [92, 58, 36])

  building(plot, 186, 206, 96, 70, {
    wall: [176, 150, 112],
    mortar: [146, 118, 84],
    roof: [150, 112, 62],
    roofShade: [112, 78, 40],
    door: [96, 64, 40],
  })
  plot.fill(206, 236, 8, 8, [246, 214, 140])
  plot.fill(254, 236, 8, 8, [246, 214, 140])
  plot.fill(248, 198, 6, 14, [96, 96, 100])

  well(plot, 250, 132)
}

function building(
  plot: Plot,
  x: number,
  y: number,
  width: number,
  height: number,
  colors: { wall: Rgb; mortar: Rgb; roof: Rgb; roofShade: Rgb; door: Rgb },
) {
  const roofHeight = 22
  for (let row = 0; row < roofHeight; row += 1) {
    const inset = Math.floor(((roofHeight - row) * width) / 70)
    plot.fill(x + inset, y + row, width - inset * 2, 1, row % 5 === 0 ? colors.roofShade : colors.roof)
  }
  plot.fill(x, y + roofHeight, width, height - roofHeight, colors.wall)
  for (let row = roofHeight + 8; row < height; row += 8) {
    plot.fill(x, y + row, width, 1, colors.mortar)
  }
  plot.fill(x + Math.floor(width / 2) - 8, y + height - 24, 16, 24, colors.door)
  plot.fill(x + Math.floor(width / 2) - 2, y + height - 14, 2, 2, [212, 176, 92])
}

function tree(plot: Plot, x: number, y: number) {
  plot.fill(x + 4, y + 8, 4, 14, [92, 64, 40])
  oval(plot, x + 6, y + 6, 12, 9, [42, 104, 48])
  oval(plot, x + 2, y + 4, 6, 4, [78, 140, 70])
}

function flower(plot: Plot, x: number, y: number) {
  plot.px(x, y, [232, 92, 96])
  plot.px(x + 1, y + 1, [246, 214, 96])
}

function well(plot: Plot, x: number, y: number) {
  oval(plot, x, y, 14, 8, [96, 100, 104])
  oval(plot, x, y, 9, 5, [64, 124, 156])
  oval(plot, x - 2, y - 1, 3, 2, [168, 214, 224])
  plot.fill(x - 10, y - 16, 2, 16, [92, 64, 40])
  plot.fill(x + 8, y - 16, 2, 16, [92, 64, 40])
  plot.fill(x - 12, y - 18, 24, 3, [120, 84, 52])
}

function oval(plot: Plot, cx: number, cy: number, rx: number, ry: number, color: Rgb) {
  for (let y = -ry; y <= ry; y += 1) {
    for (let x = -rx; x <= rx; x += 1) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
        plot.px(cx + x, cy + y, color)
      }
    }
  }
}

function plotFor(buffer: Uint8ClampedArray<ArrayBuffer>, width: number): Plot {
  const px = (x: number, y: number, color: Rgb, alpha = 255) => {
    const column = Math.round(x)
    const row = Math.round(y)
    if (column < 0 || row < 0 || column >= width) {
      return
    }
    const index = (row * width + column) * 4
    if (index < 0 || index + 3 >= buffer.length) {
      return
    }
    buffer[index] = color[0]
    buffer[index + 1] = color[1]
    buffer[index + 2] = color[2]
    buffer[index + 3] = alpha
  }
  return {
    px,
    fill(x, y, w, h, color) {
      for (let row = 0; row < h; row += 1) {
        for (let column = 0; column < w; column += 1) {
          px(x + column, y + row, color)
        }
      }
    },
  }
}

function hashString(value: string): number {
  let hash = 0
  for (const char of value) {
    hash = (Math.imul(hash, 33) + char.charCodeAt(0)) >>> 0
  }
  return hash
}

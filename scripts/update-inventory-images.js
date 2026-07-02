const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const SOURCE_DIR = path.join(process.cwd(), 'inventorypics');
const DEST_DIR = path.join(process.cwd(), 'public', 'uploads', 'inventory');
const REPORT_PATH = path.join(process.cwd(), 'scripts', 'inventory-image-update-report.json');

const imageMappings = [
  {
    file: 'blackflyerbox.png',
    candidates: ['Black Flyer Box'],
    category: 'FLYER_BOX',
  },
  {
    file: 'black_signpost.png',
    candidates: ['Black Signpost', 'Black Sign Post'],
    category: 'SIGN',
  },
  {
    file: 'custom_signpost.png',
    candidates: ['Custom Signpost', 'Custom Sign Post'],
    category: 'SIGN',
  },
  {
    file: 'forleaserider.png',
    candidates: ['For Lease Rider', 'For Lease Sign Rider', 'Lease Rider'],
    category: 'RIDER',
  },
  {
    file: 'whiteflyerbox.png',
    candidates: ['White Flyer Box'],
    category: 'FLYER_BOX',
  },
  {
    file: 'white_signpost.HEIC',
    candidates: ['White Signpost', 'White Sign Post'],
    category: 'SIGN',
  },
];

async function findItemByCandidates(candidates) {
  for (const name of candidates) {
    const item = await prisma.inventoryItem.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (item) {
      return item;
    }
  }

  return null;
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Source folder not found: ${SOURCE_DIR}`);
  }

  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
  }

  const report = {
    updated: [],
    skipped: [],
  };

  for (const mapping of imageMappings) {
    const sourcePath = path.join(SOURCE_DIR, mapping.file);

    if (!fs.existsSync(sourcePath)) {
      report.skipped.push({
        file: mapping.file,
        reason: 'Source file missing',
      });
      continue;
    }

    const item = await findItemByCandidates(mapping.candidates);
    let targetItem = item;

    if (!targetItem) {
      // Auto-create item when inventory is empty or names don't match.
      targetItem = await prisma.inventoryItem.create({
        data: {
          name: mapping.candidates[0],
          category: mapping.category,
          description: 'Auto-created from inventorypics image import.',
          totalQuantity: 0,
          availableQuantity: 0,
          lowStockThreshold: 5,
          isActive: true,
          isOrderable: true,
          pricePerUnit: null,
        },
      });
    }

    const fileName = `${Date.now()}-${mapping.file}`;
    const destPath = path.join(DEST_DIR, fileName);
    fs.copyFileSync(sourcePath, destPath);

    const imageUrl = `/uploads/inventory/${fileName}`;

    await prisma.inventoryItem.update({
      where: { id: targetItem.id },
      data: { imageUrl },
    });

    report.updated.push({
      itemId: targetItem.id,
      itemName: targetItem.name,
      file: mapping.file,
      imageUrl,
    });
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Update complete. Report written to: ${REPORT_PATH}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

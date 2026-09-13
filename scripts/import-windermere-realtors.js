#!/usr/bin/env node
// One-off import of Windermere branch rosters as new brokerages + realtor accounts.
// No welcome emails are sent. Generates a unique random password per account and
// writes the full credential list to /tmp (NOT committed to the repo).

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'brennan@northshoresignco.com';
const CREDENTIALS_OUTPUT_PATH = '/tmp/windermere-import-credentials.csv';

const BROKERAGES = {
  ANACORTES: 'Windermere Anacortes',
  ARLINGTON: 'Windermere Arlington',
  SKAGIT_VALLEY: 'Windermere Skagit Valley',
  NORTH_CASCADES: 'Windermere North Cascades',
};

// [firstName, lastName, phone, email, brokerageKey|null]
const PEOPLE = [
  ['Josh', 'Scott', '360.708.1010', 'JJScott@windermere.com', 'SKAGIT_VALLEY'],
  ['Nate', 'Scott', '360.708.2354', 'NScott@windermere.com', 'ANACORTES'],

  // Anacortes
  ['Barb', 'Robinette', '360.298.8754', 'barbrobinette@windermere.com', 'ANACORTES'],
  ['Caroline', 'Baumann', '360.202.7327', 'Caroline@windermere.com', 'ANACORTES'],
  ['Cheryl', 'Frazier', '360.202.4789', 'CherylFrazier@windermere.com', 'ANACORTES'],
  ['Colleen', 'Craig', '360.770.9638', 'ColleenCraig@windermere.com', 'ANACORTES'],
  ['Courtney', 'Orrock', '360.391.6690', 'CourtneyOrrock@windermere.com', 'ANACORTES'],
  ['Cynthia', 'Aanestad', '360.610.0120', 'Aanestad@windermere.com', 'ANACORTES'],
  ['Debbie', 'Macy', '360.391.2422', 'DebbieMacy@windermere.com', 'ANACORTES'],
  ['Gina', 'Davis', '360.708.7794', 'GinaDavis@windermere.com', 'ANACORTES'],
  ['Jessica', 'Notaro', '360.202.1441', 'JessicaNotaro@windermere.com', 'ANACORTES'],
  ['John', 'Prosser', '360.202.3891', 'JProsser@windermere.com', 'ANACORTES'],
  ['Josh', 'Blee', '360.720.9959', 'JoshBlee@windermere.com', 'ANACORTES'],
  ['Julie', 'Birkle', '360.391.1096', 'JulieBirkle@windermere.com', 'ANACORTES'],
  ['Karen', 'Petersen', '360.202.0643', 'karenpetersen@windermere.com', 'ANACORTES'],
  ['Kathy', 'Rogers', '360.941.4400', 'KRogers@windermere.com', 'ANACORTES'],
  ['Kelly', 'Middleton', '360.399.0694', 'KellyM@windermere.com', 'ANACORTES'],
  ['Kevin', 'Goforth', '360.982.3800', 'KevinGoforth@windermere.com', 'ANACORTES'],
  ['Kimarie', 'Henning', '360.708.9740', 'KimarieHenning@windermere.com', 'ANACORTES'],
  ['Kristi', 'Gabrielse', '360.420.3119', 'KristiG@windermere.com', 'ANACORTES'],
  ['Margi', 'Houghton', '360.202.0041', 'Margi@windermere.com', 'ANACORTES'],
  ['Melissa', 'LeFave', '541.357.2778', 'MelissaLeFave@windermere.com', 'ANACORTES'],
  ['Morgan', 'Jones', '360.770.0338', 'MorganJones@windermere.com', 'ANACORTES'],
  ['Nicole', 'Johnston', '360.770.6032', 'Nicole.Johnston@windermere.com', 'ANACORTES'],
  ['Paul', 'Weisz', '360.391.7281', 'PaulWeisz@windermere.com', 'ANACORTES'],
  ['Peter', 'Allen', '331.442.1808', 'PeterAllen@windermere.com', 'ANACORTES'],
  ['Rebecca', 'Chamberlain', '360.421.5021', 'RebeccaC@windermere.com', 'ANACORTES'],
  ['Renee', 'Westlund', '360.610.3861', 'ReneeWestlund@windermere.com', 'ANACORTES'],
  ['Rob', 'Skelton', '360.488.3776', 'RobSkelton@windermere.com', 'ANACORTES'],
  ['Sarah', 'Jones', '360.333.2783', 'SarahJ@windermere.com', 'ANACORTES'],
  ['Travis', 'Mager', '360.298.0628', 'Travis@travismager.com', 'ANACORTES'],
  ['Tracy', 'Peterson-Foy', '360.708.1833', 'TracyPFoy@windermere.com', 'ANACORTES'],
  ['Wendy', 'Poulton', '360.840.3059', 'wendypoulton@windermere.com', 'ANACORTES'],

  // Arlington
  ['Matt', 'Bass', '678.938.4015', 'MattBass@windermere.com', 'ARLINGTON'],
  ['Allison', 'Blacker', '425.492.0981', 'ablacker@windermere.com', 'ARLINGTON'],
  ['Greg', 'Byrum', '425.359.3737', 'gregbyrum@windermere.com', 'ARLINGTON'],
  ['Jennifer', 'Leigh', '425.422.2691', 'jennifer@windermere.com', 'ARLINGTON'],
  ['Jill', 'Duskin', '425.344.7606', 'jillduskin@windermere.com', 'ARLINGTON'],
  ['Katie', 'Foster', '425.478.3351', 'katiefoster@windermere.com', 'ARLINGTON'],
  ['Kristen', 'Anderson', '360.770.8217', 'kanderson@windermere.com', 'ARLINGTON'],
  ['Paul', 'Migrala', '425.220.1735', 'garlic31@hotmail.com', 'ARLINGTON'],
  ['Phyllis', 'Rothwell', '425.631.6158', 'phyllis@windermere.com', 'ARLINGTON'],
  ['Rich', 'Demoors', '425.346.7143', 'rich_demoors@windermere.com', 'ARLINGTON'],
  ['Ryan', 'Nobach', '425.210.6626', 'ryannobach@windermere.com', 'ARLINGTON'],
  ['Sonya', 'Blacker', '360.435.1715', 'sonyablacker@live.com', 'ARLINGTON'],
  ['Ashley', 'Matteson', '206.853.3499', 'ashleymatteson@windermere.com', 'ARLINGTON'],
  ['Lauren', 'Brandt', '206.650.0243', 'laurenbrandt@windermere.com', 'ARLINGTON'],

  // North Cascades
  ['Becky', 'Elde', '360.770.9427', 'BeckyElde@windermere.com', 'NORTH_CASCADES'],
  ['Laurie', 'Gonzalez', '360.856.4901', 'northcascades@windermere.com', 'NORTH_CASCADES'],
  ['Mary', 'Bremer', '360.540.4677', 'MaryBremer@windermere.com', 'NORTH_CASCADES'],
  ['Nicole', 'Ganske', '360.941.8999', 'NicoleGanske@windermere.com', 'NORTH_CASCADES'],
  ['Tahlia', 'Honea', '360.333.5815', 'Tahlia@windermere.com', 'NORTH_CASCADES'],

  // Skagit Valley
  ['Geri', 'Cole', '360.391.1614', 'GeriCole@windermere.com', 'SKAGIT_VALLEY'],
  ['Linda', 'Eastman', '360.202.4075', 'LEastman@windermere.com', 'SKAGIT_VALLEY'],
  ['Jennifer', 'Eddleman', '360.333.4048', 'Jenneddleman@windermere.com', 'SKAGIT_VALLEY'],
  ['Jim', 'Glackin', '360.428.2828', 'JGlackin@windermere.com', 'SKAGIT_VALLEY'],
  ['Dawn', 'Hardman', '360.540.0058', 'DawnHardman@windermere.com', 'SKAGIT_VALLEY'],
  ['Balisa', 'Koetje', '360.421.4111', 'Balisa@windermere.com', 'SKAGIT_VALLEY'],
  ['Cory', 'Kiehn', '360.441.1760', 'CoryKiehn@windermere.com', 'SKAGIT_VALLEY'],
  ['Lynnette', 'Lyman', '360.770.4807', 'Lynnettelyman@windermere.com', 'SKAGIT_VALLEY'],
  ['Melanie', 'McDaniel', '360.318.5638', 'MelanieMcDaniel@windermere.com', 'SKAGIT_VALLEY'],
  ['Racquel', 'McDermott', '360.420.1830', 'Racquel@windermere.com', 'SKAGIT_VALLEY'],
  ['Elizabeth', 'Miller', '360.420.3607', 'ElizabethM@windermere.com', 'SKAGIT_VALLEY'],
  ["Megan", "O'Bryan", '360.708.5817', 'MeganOBryan@windermere.com', 'SKAGIT_VALLEY'],
  ['Dave', 'Patterson', '360.708.5030', 'DPatterson@windermere.com', 'SKAGIT_VALLEY'],
  ['Jamie', 'Phillips', '360.540.5264', 'Yantis2@windermere.com', 'SKAGIT_VALLEY'],
  ['Jennifer', 'Pascual', '360.420.5762', 'Jenniferpascual@windermere.com', 'SKAGIT_VALLEY'],
  ['Spencer', 'Roozen', '360.708.0634', 'Roozen@windermere.com', 'SKAGIT_VALLEY'],
  ['Carson', 'Rose', '425.923.5312', 'Carsonrose@windermere.com', 'SKAGIT_VALLEY'],
  ['Donna', 'Rowell', '360.708.7984', 'DRowell@windermere.com', 'SKAGIT_VALLEY'],
  ['Alison', 'Tinsley', '206.915.6989', 'Alisontinsley@windermere.com', 'SKAGIT_VALLEY'],
  ['Shelly', 'Tveit', '360.420.2565', 'ShellyTveit@windermere.com', 'SKAGIT_VALLEY'],
  ['Loren', 'Wohlgemuth', '360.428.3012', 'wpmskagit@windermere.com', 'SKAGIT_VALLEY'],

  // No office listed on the sheet — created without a brokerage assignment.
  ['Ana', 'Dreabon Robillard', '360.588.6038', 'dreabon@windermere.com', null],
];

function generatePassword() {
  return crypto.randomBytes(9).toString('base64url'); // ~12 chars, url-safe
}

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    console.error(`Admin account ${ADMIN_EMAIL} not found — cannot own new brokerages. Aborting.`);
    process.exit(1);
  }

  const brokerageIdByKey = {};
  for (const [key, name] of Object.entries(BROKERAGES)) {
    let brokerage = await prisma.brokerage.findFirst({ where: { name } });
    if (!brokerage) {
      brokerage = await prisma.brokerage.create({
        data: { name, adminId: admin.id, billingType: 'AGENT' },
      });
      console.log(`Created brokerage: ${name}`);
    } else {
      console.log(`Brokerage already exists: ${name}`);
    }
    brokerageIdByKey[key] = brokerage.id;
  }

  const credentialRows = ['firstName,lastName,email,password,brokerage'];
  let created = 0;
  let skipped = 0;

  for (const [firstName, lastName, phone, rawEmail, brokerageKey] of PEOPLE) {
    const email = rawEmail.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`Skipping (already exists): ${email}`);
      skipped += 1;
      continue;
    }

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 12);
    const brokerageId = brokerageKey ? brokerageIdByKey[brokerageKey] : null;
    const brokerageName = brokerageKey ? BROKERAGES[brokerageKey] : null;

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        role: 'REALTOR',
        brokerageId,
        brokerageName,
        emailVerifiedAt: new Date(), // pre-verified since these are manually onboarded, no verification email sent
      },
    });

    credentialRows.push(`${firstName},${lastName},${email},${password},${brokerageName || ''}`);
    created += 1;
    console.log(`Created: ${firstName} ${lastName} <${email}> (${brokerageName || 'no brokerage'})`);
  }

  fs.writeFileSync(CREDENTIALS_OUTPUT_PATH, credentialRows.join('\n') + '\n', { mode: 0o600 });
  console.log(`\nDone. Created ${created}, skipped ${skipped} (already existed).`);
  console.log(`Full credential list (plaintext passwords) written to: ${CREDENTIALS_OUTPUT_PATH}`);
  console.log('This file is NOT part of the git repo — copy it somewhere safe and delete it from /tmp when done.');
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

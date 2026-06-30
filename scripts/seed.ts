import { createClient, User } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables manually from .env.local to avoid extra package dependencies
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const equalsIdx = trimmed.indexOf('=');
      if (equalsIdx !== -1) {
        const key = trimmed.substring(0, equalsIdx).trim();
        let value = trimmed.substring(equalsIdx + 1).trim();
        // Remove surrounding quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    });
  }
} catch {
  console.warn('Warning: Could not read .env.local file. Proceeding with environment defaults.');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Wards and coordinate bounds in Pune
const wards = [
  { name: 'Koregaon Park', lat: 18.535, lng: 73.893 },
  { name: 'Shivajinagar', lat: 18.530, lng: 73.847 },
  { name: 'Kothrud', lat: 18.508, lng: 73.820 },
  { name: 'Hadapsar', lat: 18.506, lng: 73.927 },
  { name: 'Baner', lat: 18.559, lng: 73.787 }
];

const categories = [
  { name: 'pothole', dept: 'PWD (Roads & Highways)', minSev: 2, maxSev: 5 },
  { name: 'streetlight', dept: 'Electricity & Lighting Board', minSev: 1, maxSev: 3 },
  { name: 'water', dept: 'Water Supply Department', minSev: 3, maxSev: 5 },
  { name: 'garbage', dept: 'Municipal Solid Waste Dept', minSev: 2, maxSev: 4 },
  { name: 'road_damage', dept: 'Public Works Department (PWD)', minSev: 3, maxSev: 5 }
];

// Seed placeholder infrastructure photos
const photoTemplates = [
  'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?w=800&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1598462039050-b2f0a597a70a?w=800&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?w=800&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=800&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&auto=format&fit=crop&q=60'
];

const issueTitles: Record<string, string[]> = {
  pothole: [
    'Deep potholes blocking traffic lane',
    'Dangerous crater on main road exit',
    'Tarmac erosion causing swerving accidents',
    'Pothole cluster near pedestrian crossing',
    'Sunken asphalt hazard on highway link'
  ],
  streetlight: [
    'Entire street lane in darkness',
    'Flickering lamp post near intersection',
    'Broken lighting column at school zone',
    'Corroded wiring cover exposed at base',
    'Delayed timer lighting up after midnight only'
  ],
  water: [
    'Water pipe rupture flooding pavements',
    'Leaking sewage valve emitting foul odor',
    'Continuous water wastage from storage outlet',
    'Blocked storm drain causing heavy pooling',
    'Sidewalk erosion from continuous under-drip'
  ],
  garbage: [
    'Illegal construction waste dumping in park',
    'Overflown garbage container on sidewalk',
    'Uncollected organic waste blocking lane',
    'Plastic debris choking storm pipe inlets',
    'Unauthorized commercial rubbish dumping'
  ],
  road_damage: [
    'Severe cracks on bridge approach ramp',
    'Sunken divider tiles causing lane block',
    'Landslide debris blocking highway exit',
    'Missing speed bump markers causing bumps',
    'Eroded surface aggregate causing slips'
  ]
};

const issueDescriptions: Record<string, string[]> = {
  pothole: [
    'There is a deep, water-logged pothole in the middle lane of the road. Cars are swerving dangerously into oncoming traffic to avoid it.',
    'A cluster of potholes has developed over the past week, making this stretch of road extremely hazardous for two-wheelers.',
    'Eroded road surface near the bus stop has created a large, sharp-edged trench that could easily damage car suspensions.'
  ],
  streetlight: [
    'The streetlight has been out for several nights, leaving the walkway completely dark. Residents feel unsafe walking here after dusk.',
    'The light bulb is flickering rapidly, causing a distraction for drivers and leaving the pedestrian path poorly illuminated.',
    'The concrete cover at the base of the pole is cracked, and wires are exposed to rain water.'
  ],
  water: [
    'Clean drinking water is bursting from a pipe under the pavement, creating a mini-geyser and flooding the nearby shop entrances.',
    'Foul smelling water is leaking continuously onto the road, creating unhygienic conditions near the vegetable market.',
    'A main supply valve is stuck open, wasting thousands of liters of clean water into the storm drain.'
  ],
  garbage: [
    'A large pile of plastic waste and organic garbage has been dumped on the corner of the park, attracting stray animals.',
    'The local trash collector has not emptied this bin for 4 days. Waste is overflowing onto the main sidewalk.',
    'Renovation debris and sharp concrete blocks have been dumped overnight, blocking half of the active pedestrian path.'
  ],
  road_damage: [
    'A section of the road divider is crumbling, scattering loose gravel across the high-speed lane.',
    'Soil erosion underneath the asphalt has caused a 2-meter section of the service road to cave in.',
    'The Speed breaker is completely unmarked and has lost its paint, making it invisible to drivers at night.'
  ]
};

async function seed() {
  console.log('--- Starting CivicLens Database Seeding ---');

  // 1. Fetch existing users or create dummy authenticated users to satisfy foreign key constraints
  console.log('Fetching existing users from auth...');
  let authUsers: User[] = [];
  try {
    const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
    if (!listErr && userList?.users) {
      authUsers = userList.users;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Could not list users, attempting to create new ones directly:', msg);
  }

  const requiredUsersCount = 6;
  if (authUsers.length < requiredUsersCount) {
    const needed = requiredUsersCount - authUsers.length;
    console.log(`Only ${authUsers.length} users found. Provisioning ${needed} dummy authenticated users...`);
    for (let i = authUsers.length; i < requiredUsersCount; i++) {
      try {
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email: `citizen.hero.${i + 1}@civiclens.gov`,
          password: 'password123',
          email_confirm: true
        });
        if (!createErr && newUser?.user) {
          authUsers.push(newUser.user);
          console.log(`Created user: citizen.hero.${i + 1}@civiclens.gov (${newUser.user.id})`);
        } else {
          console.error(`Failed to create dummy user ${i + 1}:`, createErr);
        }
      } catch (err) {
        console.error(`Error creating dummy user ${i + 1}:`, err);
      }
    }
  }

  if (authUsers.length === 0) {
    console.error('Fatal Error: No users could be retrieved or created in auth.users. Cannot proceed with seeding.');
    process.exit(1);
  }

  const reporterIds = authUsers.map(u => u.id);
  console.log(`References established for ${reporterIds.length} authenticated users.`);

  // We will assign points to the top 3 users as required
  console.log('Seeding top 3 CivicHero user profiles...');
  const heroData = [
    { user_id: reporterIds[0], points: 340, reports_count: 14, verifications_count: 22, badge_level: 'Local Champion' },
    { user_id: reporterIds[1], points: 210, reports_count: 8, verifications_count: 15, badge_level: 'Civic Guardian' },
    { user_id: reporterIds[2], points: 95, reports_count: 4, verifications_count: 11, badge_level: 'Active Citizen' },
    { user_id: reporterIds[3] || reporterIds[0], points: 35, reports_count: 2, verifications_count: 5, badge_level: 'Helper' },
    { user_id: reporterIds[4] || reporterIds[0], points: 15, reports_count: 1, verifications_count: 2, badge_level: 'Newcomer' }
  ];

  const { error: heroErr } = await supabase
    .from('civic_hero_points')
    .upsert(heroData);

  if (heroErr) {
    console.error('Failed to seed civic hero points:', heroErr);
  } else {
    console.log('CivicHero profiles successfully seeded.');
  }

  // 2. Map target category distribution count
  // 15 potholes, 8 streetlights, 7 water leaks, 8 garbage, 7 road damages
  const categoryCounts = {
    pothole: 15,
    streetlight: 8,
    water: 7,
    garbage: 8,
    road_damage: 7
  };

  // Status distributions: 20 open, 12 in_progress, 13 resolved
  const statuses = [
    ...Array(20).fill('open'),
    ...Array(12).fill('in_progress'),
    ...Array(13).fill('resolved')
  ];
  // Shuffle statuses to spread them randomly
  statuses.sort(() => Math.random() - 0.5);

  const issuesToInsert: Record<string, unknown>[] = [];
  const verificationsToInsert: Record<string, unknown>[] = [];

  let statusIndex = 0;

  // Compile issues dataset
  categories.forEach((cat) => {
    const targetCount = categoryCounts[cat.name as keyof typeof categoryCounts];
    
    for (let c = 0; c < targetCount; c++) {
      const id = randomUUID();
      const ward = wards[Math.floor(Math.random() * wards.length)];
      
      // Randomize coordinate within ward boundary
      const lat = ward.lat + (Math.random() - 0.5) * 0.008;
      const lng = ward.lng + (Math.random() - 0.5) * 0.008;

      const severity = Math.floor(Math.random() * (cat.maxSev - cat.minSev + 1)) + cat.minSev;
      const status = statuses[statusIndex++];
      
      const createdDaysAgo = Math.floor(Math.random() * 30);
      const createdAt = new Date(Date.now() - createdDaysAgo * 24 * 60 * 60 * 1000);
      
      let resolvedAt: Date | null = null;
      if (status === 'resolved') {
        const resolutionDays = Math.floor(Math.random() * 15) + 1;
        resolvedAt = new Date(createdAt.getTime() + resolutionDays * 24 * 60 * 60 * 1000);
      }

      const titles = issueTitles[cat.name] || [];
      const title = titles[c % titles.length] || `Civic issue in ${ward.name}`;
      const descs = issueDescriptions[cat.name] || [];
      const description = descs[c % descs.length] || `A detailed description of the reported issue.`;

      const hasPhoto = Math.random() > 0.3;
      const photo_urls = hasPhoto ? [photoTemplates[c % photoTemplates.length]] : [];

      const reporter_id = reporterIds[Math.floor(Math.random() * reporterIds.length)];

      issuesToInsert.push({
        id,
        title,
        description,
        category: cat.name,
        severity,
        status,
        lat,
        lng,
        location: `POINT(${lng} ${lat})`,
        photo_urls,
        upvotes: 0, // Will be incremented by verifications
        reporter_id,
        ward_name: `${ward.name} Ward`,
        ai_confidence: Number((0.85 + Math.random() * 0.14).toFixed(2)),
        suggested_department: cat.dept,
        created_at: createdAt.toISOString(),
        resolved_at: resolvedAt ? resolvedAt.toISOString() : null
      });

      // Generate 2-4 verifications for each issue
      const numVerifications = Math.floor(Math.random() * 3) + 2; // 2, 3, or 4
      const votingUsers = [...reporterIds].sort(() => Math.random() - 0.5).slice(0, numVerifications);
      
      let confirmCount = 0;
      let disputeCount = 0;

      votingUsers.forEach((voterId) => {
        // High chance of confirm verdict, low chance of dispute
        const verdict = Math.random() > 0.25 ? 'confirm' : 'dispute';
        if (verdict === 'confirm') confirmCount++;
        else disputeCount++;

        verificationsToInsert.push({
          id: randomUUID(),
          issue_id: id,
          user_id: voterId,
          verdict,
          note: verdict === 'confirm' ? 'Verified nearby resident.' : 'Visual check shows differences.',
          created_at: new Date(createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
        });
      });

      // Update issue consensus attributes based on verification tallies
      issuesToInsert[issuesToInsert.length - 1].upvotes = confirmCount;
      if (confirmCount >= 3 && confirmCount > disputeCount) {
        issuesToInsert[issuesToInsert.length - 1].verified_at = new Date(createdAt.getTime() + 12 * 60 * 60 * 1000).toISOString();
      }
    }
  });

  // 3. Insert issues into Supabase sequentially to log progress
  console.log(`Prepared ${issuesToInsert.length} issues and ${verificationsToInsert.length} verifications.`);
  
  let insertedCount = 0;
  for (let i = 0; i < issuesToInsert.length; i++) {
    const issue = issuesToInsert[i];
    console.log(`Inserting issue ${i + 1}/${issuesToInsert.length}: ${issue.title} in ${issue.ward_name}...`);
    
    const { error } = await supabase
      .from('issues')
      .insert(issue);
      
    if (error) {
      console.error(`Failed to insert issue ${issue.title}:`, error);
    } else {
      insertedCount++;
    }
  }

  // 4. Insert verifications in bulk
  console.log('Inserting verifications in bulk...');
  const { error: verifyBulkErr } = await supabase
    .from('verifications')
    .insert(verificationsToInsert);

  if (verifyBulkErr) {
    console.error('Failed to insert verifications bulk data:', verifyBulkErr);
  } else {
    console.log(`Verifications successfully bulk inserted.`);
  }

  console.log(`--- Seeding complete. Successfully inserted ${insertedCount}/${issuesToInsert.length} issues. ---`);
}

seed().catch((err) => {
  console.error('Unhandled seed error:', err);
  process.exit(1);
});

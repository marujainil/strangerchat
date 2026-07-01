/**
 * StrangerChat — Database seed.
 * Seeds premium plans, a starter country list, interests, and an admin user.
 *
 *   npm run seed
 *
 * Admin credentials can be overridden via SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 */
import { PrismaClient, PlanInterval, Role, AuthProvider } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PLANS = [
  {
    code: 'monthly',
    name: 'Monthly',
    interval: PlanInterval.MONTHLY,
    priceInr: 69,
    durationDays: 30,
    features: [
      'All advanced filters (country, gender, age, language, interest)',
      'Unlimited filtered matching',
      'Premium matching priority',
      'Verified badge eligibility',
      'Ad-free experience',
    ],
  },
  {
    code: 'half_yearly',
    name: '6 Months',
    interval: PlanInterval.HALF_YEARLY,
    priceInr: 299,
    durationDays: 180,
    features: [
      'Everything in Monthly',
      'Save 28% vs monthly',
      'Priority support',
    ],
  },
  {
    code: 'yearly',
    name: 'Yearly',
    interval: PlanInterval.YEARLY,
    priceInr: 699,
    durationDays: 365,
    features: [
      'Everything in 6 Months',
      'Save 16% vs 6-month',
      'Best value',
      'Early access to new features',
    ],
  },
];

// ISO-2 code, name, dial code, flag emoji
const COUNTRIES: [string, string, string, string][] = [
  ['IN', 'India', '+91', '🇮🇳'],
  ['US', 'United States', '+1', '🇺🇸'],
  ['GB', 'United Kingdom', '+44', '🇬🇧'],
  ['CA', 'Canada', '+1', '🇨🇦'],
  ['AU', 'Australia', '+61', '🇦🇺'],
  ['DE', 'Germany', '+49', '🇩🇪'],
  ['FR', 'France', '+33', '🇫🇷'],
  ['IT', 'Italy', '+39', '🇮🇹'],
  ['ES', 'Spain', '+34', '🇪🇸'],
  ['BR', 'Brazil', '+55', '🇧🇷'],
  ['MX', 'Mexico', '+52', '🇲🇽'],
  ['JP', 'Japan', '+81', '🇯🇵'],
  ['KR', 'South Korea', '+82', '🇰🇷'],
  ['CN', 'China', '+86', '🇨🇳'],
  ['RU', 'Russia', '+7', '🇷🇺'],
  ['ID', 'Indonesia', '+62', '🇮🇩'],
  ['PK', 'Pakistan', '+92', '🇵🇰'],
  ['BD', 'Bangladesh', '+880', '🇧🇩'],
  ['NG', 'Nigeria', '+234', '🇳🇬'],
  ['ZA', 'South Africa', '+27', '🇿🇦'],
  ['EG', 'Egypt', '+20', '🇪🇬'],
  ['TR', 'Turkey', '+90', '🇹🇷'],
  ['SA', 'Saudi Arabia', '+966', '🇸🇦'],
  ['AE', 'United Arab Emirates', '+971', '🇦🇪'],
  ['SG', 'Singapore', '+65', '🇸🇬'],
  ['MY', 'Malaysia', '+60', '🇲🇾'],
  ['PH', 'Philippines', '+63', '🇵🇭'],
  ['TH', 'Thailand', '+66', '🇹🇭'],
  ['VN', 'Vietnam', '+84', '🇻🇳'],
  ['NL', 'Netherlands', '+31', '🇳🇱'],
  ['SE', 'Sweden', '+46', '🇸🇪'],
  ['PL', 'Poland', '+48', '🇵🇱'],
  ['UA', 'Ukraine', '+380', '🇺🇦'],
  ['AR', 'Argentina', '+54', '🇦🇷'],
  ['CO', 'Colombia', '+57', '🇨🇴'],
];

const INTERESTS = [
  'Music', 'Gaming', 'Movies', 'Travel', 'Sports', 'Technology',
  'Art', 'Books', 'Food', 'Fitness', 'Photography', 'Fashion',
  'Anime', 'Coding', 'Dancing', 'Singing', 'Pets', 'Nature',
  'Crypto', 'Startups', 'Languages', 'Memes', 'Philosophy', 'Science',
];

async function main() {
  console.log('🌱 Seeding database...');

  // Plans
  for (const p of PLANS) {
    await prisma.plan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        interval: p.interval,
        priceInr: p.priceInr,
        durationDays: p.durationDays,
        features: p.features,
        active: true,
      },
      create: { ...p, active: true },
    });
  }
  console.log(`✓ ${PLANS.length} plans`);

  // Countries
  for (const [code, name, dialCode, flagEmoji] of COUNTRIES) {
    await prisma.country.upsert({
      where: { code },
      update: { name, dialCode, flagEmoji, enabled: true },
      create: { code, name, dialCode, flagEmoji, enabled: true },
    });
  }
  console.log(`✓ ${COUNTRIES.length} countries`);

  // Interests
  for (const name of INTERESTS) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await prisma.interest.upsert({
      where: { slug },
      update: { label: name, enabled: true },
      create: { slug, label: name, enabled: true },
    });
  }
  console.log(`✓ ${INTERESTS.length} interests`);

  // Admin user
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@strangerchat.app';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: Role.ADMIN, isVerified: true },
    create: {
      email: adminEmail,
      passwordHash,
      provider: AuthProvider.EMAIL,
      role: Role.ADMIN,
      displayName: 'Administrator',
      isVerified: true,
    },
  });
  console.log(`✓ admin user: ${adminEmail} (password: ${adminPassword})`);

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

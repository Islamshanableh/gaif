/* eslint-disable no-restricted-syntax */
const { PrismaClient } = require('@prisma/client');
const axios = require('axios').default;

const prisma = new PrismaClient();

const subscriptions = [
  {
    price: 0,
    type: 'TIER_1',
    validForDays: 365,
    numOfIdentifications: 5,
    chargePerMonth: 0.0,
    chargePerYear: 0.0,
    planTranslations: [
      {
        title: 'Free',
        description: 'Up to 20 identifications/month',

        languageId: 1,
        products: [],
      },
    ],
  },
  {
    price: 6,
    type: 'TIER_2',
    validForDays: 30,
    numOfIdentifications: 30,
    chargePerMonth: 6.0,
    chargePerYear: 72.0,
    planTranslations: [
      {
        title: 'Silver',
        description: 'Up to 30 identifications/month Advanced item information',

        languageId: 1,
        products: [
          {
            platform: 'ANDROID',
            productId: 'silver_monthly_plan:silver-monthly-plan',
          },
          {
            platform: 'IOS',
            productId: 'Silver_Plan_Monthly',
          },
          {
            platform: 'ANDROID',
            productId: 'silver_yearly_plan:silver-yearly-plan',
          },
          {
            platform: 'IOS',
            productId: 'Silver_Plan_Yearly',
          },
        ],
      },
    ],
  },
  {
    price: 12,
    type: 'TIER_3',
    validForDays: 30,
    numOfIdentifications: 50,
    chargePerMonth: 12.0,
    chargePerYear: 144.0,
    planTranslations: [
      {
        title: 'Gold',
        description:
          'Up to 50 identifications/month Advanced item information Marketplace',

        languageId: 1,
        products: [
          {
            platform: 'ANDROID',
            productId: 'gold_monthly_plan:gold-monthly-plan',
          },
          {
            platform: 'IOS',
            productId: 'Gold_Monthly_Plan',
          },
          {
            platform: 'ANDROID',
            productId: 'gold_yearly_plan:gold-yearly-plan',
          },
          {
            platform: 'IOS',
            productId: 'Gold_Yearly_Plan',
          },
        ],
      },
    ],
  },
  {
    price: 80,
    type: 'TIER_4',
    validForDays: 30,
    numOfIdentifications: 1000,
    chargePerMonth: 80.0,
    chargePerYear: 960.0,
    planTranslations: [
      {
        title: 'Premium',
        description:
          'Unlimited identifications, Advanced item information Marketplace',

        languageId: 1,
        products: [
          {
            platform: 'ANDROID',
            productId: 'premium_monthly_plan:premium-monthly-plan',
          },
          {
            platform: 'IOS',
            productId: 'Premium_Monthly_Plan',
          },
          {
            platform: 'ANDROID',
            productId: 'premium_yearly_plan:premium-yearly-plan',
          },
          {
            platform: 'IOS',
            productId: 'Premium_Yearly_Plan',
          },
        ],
      },
    ],
  },
];

async function getCountries() {
  try {
    const countries = await axios.get('https://restcountries.com/v3.1/all');
    return countries.data;
  } catch (error) {
    console.error(
      'ERROR: while fetching countries from https://restcountries.com/v3.1/all',
    );
  }
}

async function main() {
  console.log(`Start seeding ...`);

  const _countries = await getCountries();

  // await prisma.subscriptionPlanTranslation.deleteMany({});
  // await prisma.purchasedSubscriptionPlan.deleteMany({});
  // await prisma.subscriptionPlan.deleteMany({});

  const enLang = await prisma.language.upsert({
    where: { name: 'English' },
    update: {},
    create: {
      name: 'English',
      code: 'en',
      nativeName: 'English',
      direction: 'LTR',
    },
  });

  await prisma.language.upsert({
    where: { name: 'Hebrew' },
    update: {},
    create: {
      name: 'Hebrew',
      code: 'he',
      nativeName: 'Hebrew',
      direction: 'RTL',
    },
  });

  await prisma.language.upsert({
    where: { code: 'ar' },
    update: {},
    create: {
      name: 'Arabic',
      code: 'ar',
      nativeName: 'العربية',
      direction: 'RTL',
    },
  });

  _countries.push({
    cca3: 'OTT',
    cca2: 'OT',
    ccn3: 'OT',
    name: {
      common: 'Palestine Under Ottoman Empire',
    },
  });

  _countries.push({
    cca3: 'BMP',
    cca2: 'BP',
    ccn3: 'BP',
    name: {
      common: 'Palestine Under British Mandate',
    },
  });

  for await (const el of _countries)
    await prisma.country.upsert({
      where: { cca3: el.cca3 },
      update: {
        cca3: el.cca3,
        cca2: el.cca2,
        ccn3: el.ccn3,
        translations: {
          deleteMany: {},
          create: {
            name: el.name.common,
            language: {
              connect: {
                id: enLang.id,
              },
            },
          },
        },
      },
      create: {
        cca3: el.cca3,
        cca2: el.cca2,
        ccn3: el.ccn3,
        translations: {
          create: {
            name: el.name.common,
            language: {
              connect: {
                id: enLang.id,
              },
            },
          },
        },
      },
    });

  for await (const sub of subscriptions) {
    const {
      price,
      type,
      validForDays,
      numOfIdentifications,
      chargePerMonth,
      chargePerYear,
      planTranslations,
    } = sub;
    await prisma.subscriptionPlan.create({
      data: {
        price,
        type,
        validForDays,
        numOfIdentifications,
        chargePerMonth,
        chargePerYear,
        planTranslations: {
          create: planTranslations?.map(translation => {
            const { products } = translation;
            delete translation?.products;
            return {
              ...translation,
              products: {
                create: products,
              },
            };
          }),
        },
      },
    });
  }

  console.log(`Seeding finished...`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
